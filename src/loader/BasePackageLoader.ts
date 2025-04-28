import path from 'path';
import { cloneDeep } from 'lodash';
import { LRUCache } from 'mnemonist';
import { PackageCache } from '../cache/PackageCache';
import { CurrentBuildClient } from '../current';
import { PackageDB } from '../db';
import { InvalidResourceError } from '../errors';
import { FindResourceInfoOptions, PackageInfo, PackageStats, ResourceInfo } from '../package';
import { RegistryClient } from '../registry';
import { LogFunction } from '../utils';
import { VirtualPackage } from '../virtual';
import { LoadStatus, PackageLoader } from './PackageLoader';

const DEFAULT_RESOURCE_CACHE_SIZE = 200;

export enum SafeMode {
  OFF = 'OFF',
  FREEZE = 'FREEZE',
  CLONE = 'CLONE'
}

const CERTIFICATE_MESSAGE =
  '\n\nSometimes this error occurs in corporate or educational environments that use proxies and/or SSL ' +
  'inspection.\nTroubleshooting tips:\n' +
  '  1. If a non-proxied network is available, consider connecting to that network instead.\n' +
  '  2. Set NODE_EXTRA_CA_CERTS as described at https://bit.ly/3ghJqJZ (RECOMMENDED).\n' +
  '  3. Disable certificate validation as described at https://bit.ly/3syjzm7 (NOT RECOMMENDED).\n';

export type BasePackageLoaderOptions = {
  log?: LogFunction;
  resourceCacheSize?: number;
  safeMode?: SafeMode;
};

export class BasePackageLoader implements PackageLoader {
  private log: LogFunction;
  private virtualPackages: Map<string, VirtualPackage>;
  private resourceCache?: LRUCache<string, any>;
  private safeMode: SafeMode;

  constructor(
    private packageDB: PackageDB,
    private packageCache: PackageCache,
    private registryClient: RegistryClient,
    private currentBuildClient: CurrentBuildClient,
    options: BasePackageLoaderOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.virtualPackages = new Map<string, VirtualPackage>();
    const resourceCacheSize = options.resourceCacheSize ?? DEFAULT_RESOURCE_CACHE_SIZE;
    if (resourceCacheSize > 0) {
      this.resourceCache = new LRUCache<string, any>(resourceCacheSize);
    }
    this.safeMode = options.safeMode ?? SafeMode.OFF;
  }

  async loadPackage(name: string, version: string): Promise<LoadStatus> {
    let packageLabel = `${name}#${version}`;

    const originalVersion = version;
    version = await this.registryClient.resolveVersion(name, version);
    if (version !== originalVersion) {
      this.log('info', `Resolved ${packageLabel} to concrete version ${version}`);
      packageLabel = `${name}#${version}`;
    }

    // If it's already loaded, then there's nothing to do
    if (this.getPackageLoadStatus(name, version) === LoadStatus.LOADED) {
      this.log('info', `${packageLabel} already loaded`);
      return LoadStatus.LOADED;
    }

    // If it's a "dev" version, but it wasn't found in the cache, fall back to using the current version
    if (version === 'dev' && !this.packageCache.isPackageInCache(name, version)) {
      this.log(
        'info',
        `Falling back to ${name}#current since ${packageLabel} is not locally cached. To avoid this, add ${packageLabel} to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.`
      );
      version = 'current';
      packageLabel = `${name}#${version}`;
    }

    let downloadErrorMessage: string;
    // If it's a "current" version, download the latest version from the build server (if applicable)
    if (isCurrentVersion(version)) {
      const branch = version.indexOf('$') !== -1 ? version.split('$')[1] : undefined;
      if (await this.isCurrentVersionMissingOrStale(name, branch)) {
        try {
          const tarballStream = await this.currentBuildClient.downloadCurrentBuild(name, branch);
          await this.packageCache.cachePackageTarball(name, version, tarballStream);
        } catch (e) {
          downloadErrorMessage = `Failed to download most recent ${packageLabel} from current builds`;
          if (/certificate/.test(e?.message)) {
            downloadErrorMessage += CERTIFICATE_MESSAGE;
          }
        }
      }
    }
    // Else if it isn't "current" and isn't in the cache, download it from the registry
    else if (!this.packageCache.isPackageInCache(name, version)) {
      try {
        const tarballStream = await this.registryClient.download(name, version);
        await this.packageCache.cachePackageTarball(name, version, tarballStream);
      } catch (e) {
        downloadErrorMessage = `Failed to download ${packageLabel} from the registry`;
        if (/certificate/.test(e?.message)) {
          downloadErrorMessage += CERTIFICATE_MESSAGE;
        }
      }
    }

    // Finally attempt to load it from the cache
    let stats: PackageStats;
    try {
      stats = this.loadPackageFromCache(name, version);
    } catch {
      this.log(
        'error',
        `Failed to load ${packageLabel}${downloadErrorMessage ? `: ${downloadErrorMessage}` : ''}`
      );
      return LoadStatus.FAILED;
    }
    if (downloadErrorMessage) {
      // Loading succeeded despite a download error. This might happen if a current build is stale,
      // but the download fails, in which case the stale build will be loaded instead.
      this.log('warn', `${downloadErrorMessage}. Using most recent cached package instead.`);
    }
    this.log('info', `Loaded ${stats.name}#${stats.version} with ${stats.resourceCount} resources`);
    return LoadStatus.LOADED;
  }

  async loadVirtualPackage(pkg: VirtualPackage): Promise<LoadStatus> {
    // Ensure package.json has at least the name and version
    const packageJSON = pkg.getPackageJSON();
    if (
      packageJSON?.name == null ||
      packageJSON.name.trim() === '' ||
      packageJSON.version == null ||
      packageJSON.version.trim() == ''
    ) {
      this.log(
        'error',
        `Failed to load virtual package ${packageJSON?.name ?? '<unknown>'}#${packageJSON?.version ?? '<unknown>'} because the provided packageJSON did not have a valid name and/or version`
      );
      return LoadStatus.FAILED;
    }

    // If it's already loaded, then there's nothing to do
    if (this.getPackageLoadStatus(packageJSON.name, packageJSON.version) === LoadStatus.LOADED) {
      this.log('info', `Virtual package ${packageJSON.name}#${packageJSON.version} already loaded`);
      return LoadStatus.LOADED;
    }

    // Store the virtual package by its name#version key
    const packageKey = `${packageJSON.name}#${packageJSON.version}`;
    this.virtualPackages.set(packageKey, pkg);

    // Save the package info
    const info: PackageInfo = {
      name: packageJSON.name,
      version: packageJSON.version,
      packagePath: `virtual:${packageKey}`,
      packageJSONPath: `virtual:${packageKey}:package.json`
    };
    this.packageDB.savePackageInfo(info);

    // Register the resources
    try {
      await pkg.registerResources((key: string, resource: any, allowNonResources?: boolean) => {
        this.loadResource(
          `virtual:${packageKey}:${key}`,
          resource,
          packageJSON.name,
          packageJSON.version,
          allowNonResources
        );
      });
    } catch (e) {
      this.log(
        'error',
        `Virtual package ${packageKey} threw an exception while registering resources, so it was only partially loaded.`
      );
      if (e.stack) {
        this.log('debug', e.stack);
      }
      return LoadStatus.FAILED;
    }

    const stats = this.packageDB.getPackageStats(packageJSON.name, packageJSON.version);
    this.log('info', `Loaded virtual package ${packageKey} with ${stats.resourceCount} resources`);
    return LoadStatus.LOADED;
  }

  private loadPackageFromCache(name: string, version: string) {
    // Ensure the package is cached
    if (!this.packageCache.isPackageInCache(name, version)) {
      throw new Error(`${name}#${version} cannot be loaded from the package cache`);
    }

    // Get the cached package path and package.json path
    const packagePath = this.packageCache.getPackagePath(name, version);

    // Register the package information
    const info: PackageInfo = {
      name,
      version
    };

    const packageJSONPath = this.packageCache.getPackageJSONPath(name, version);
    info.packagePath = path.resolve(packagePath);
    info.packageJSONPath = path.resolve(packageJSONPath);

    this.packageDB.savePackageInfo(info);

    // Load the resources within the package
    this.loadResourcesFromCache(name, version);

    return this.packageDB.getPackageStats(name, version);
  }

  private loadResourcesFromCache(packageName: string, packageVersion: string) {
    this.packageCache
      .getPotentialResourcePaths(packageName, packageVersion)
      .forEach(resourcePath => {
        try {
          this.loadResourceFromCache(resourcePath, packageName, packageVersion);
        } catch {
          // swallow this error because some JSON files will not be resources
          // and don't log it if it is package.json (since every package should have one)
          if (path.basename(resourcePath) !== 'package.json') {
            this.log('debug', `JSON file at path ${resourcePath} was not FHIR resource`);
          }
        }
      });
  }

  private loadResourceFromCache(resourcePath: string, packageName: string, packageVersion: string) {
    const resourceJSON = this.packageCache.getResourceAtPath(resourcePath);
    this.loadResource(resourcePath, resourceJSON, packageName, packageVersion);
  }

  private loadResource(
    resourcePath: string,
    resourceJSON: any,
    packageName?: string,
    packageVersion?: string,
    allowNonResources = false
  ) {
    // We require at least a resourceType in order to know it is FHIR
    let resourceType = resourceJSON.resourceType;
    if (typeof resourceType !== 'string' || resourceType === '') {
      if (allowNonResources) {
        // SUSHI needs to support registering instances of logical models, but some code expects resourceType
        resourceType = 'Unknown';
      } else {
        throw new InvalidResourceError(resourcePath, 'resource does not specify its resourceType');
      }
    }

    const info: ResourceInfo = { resourceType };
    if (typeof resourceJSON.id === 'string') {
      info.id = resourceJSON.id;
    }
    if (typeof resourceJSON.url === 'string') {
      info.url = resourceJSON.url;
    }
    if (typeof resourceJSON.name === 'string') {
      info.name = resourceJSON.name;
    }
    if (typeof resourceJSON.version === 'string') {
      info.version = resourceJSON.version;
    }
    if (resourceType === 'StructureDefinition') {
      if (typeof resourceJSON.kind === 'string') {
        info.sdKind = resourceJSON.kind;
      }
      // In R4, some things don't have derivation (e.g. Resource) so default to specialization
      if (typeof resourceJSON.derivation === 'string') {
        info.sdDerivation = resourceJSON.derivation;
      } else {
        info.sdDerivation = 'specialization';
      }
      if (typeof resourceJSON.type === 'string') {
        info.sdType = resourceJSON.type;
      }
      if (typeof resourceJSON.baseDefinition === 'string') {
        info.sdBaseDefinition = resourceJSON.baseDefinition;
      }
      info.sdAbstract = resourceJSON.abstract === true;
      const imposeProfiles: string[] = [];
      const characteristics: string[] = [];
      resourceJSON.extension?.forEach((ext: any) => {
        if (
          ext?.url === 'http://hl7.org/fhir/StructureDefinition/structuredefinition-imposeProfile'
        ) {
          imposeProfiles.push(ext.valueCanonical);
        } else if (
          ext?.url ===
          'http://hl7.org/fhir/StructureDefinition/structuredefinition-type-characteristics'
        ) {
          characteristics.push(ext.valueCode);
        } else if (
          // logical-target is a temporary alternate representation for can-be-target because
          // FHIR missed can-be-target in early versions of its characteristics value set
          ext?.url === 'http://hl7.org/fhir/tools/StructureDefinition/logical-target' &&
          ext.valueBoolean
        ) {
          characteristics.push('can-be-target');
        }
      });
      if (imposeProfiles.length) {
        info.sdImposeProfiles = imposeProfiles;
      }
      if (characteristics.length) {
        info.sdCharacteristics = characteristics;
      }
      info.sdFlavor = getSDFlavor(resourceJSON);
    }
    if (packageName) {
      info.packageName = packageName;
    }
    if (packageVersion) {
      info.packageVersion = packageVersion;
    }
    info.resourcePath = resourcePath;

    this.packageDB.saveResourceInfo(info);
  }

  private async isCurrentVersionMissingOrStale(name: string, branch?: string) {
    let isStale = true;
    const version = branch ? `current$${branch}` : 'current';
    const packageJSONPath = this.packageCache.getPackageJSONPath(name, version);
    if (packageJSONPath) {
      try {
        const packageJSON = this.packageCache.getResourceAtPath(packageJSONPath);
        const cachedPackageDate = packageJSON.date;
        if (cachedPackageDate) {
          const packageLabel = `${name}#${version}`;
          const latestBuildDate = await this.currentBuildClient.getCurrentBuildDate(name, branch);
          isStale = cachedPackageDate !== latestBuildDate;
          if (isStale) {
            this.log(
              'debug',
              `Cached package date for ${packageLabel} (${formatDate(
                cachedPackageDate
              )}) does not match last build date (${formatDate(latestBuildDate)})`
            );
            this.log(
              'info',
              `Cached package ${packageLabel} is out of date and will be replaced by the most recent current build.`
            );
          } else {
            this.log(
              'debug',
              `Cached package date for ${packageLabel} (${formatDate(
                cachedPackageDate
              )}) matches last build date (${formatDate(
                latestBuildDate
              )}), so the cached package will be used`
            );
          }
        }
      } catch {
        // do nothing -- will fall back to stale if we couldn't determine staleness
      }
    }
    return isStale;
  }

  private getResourceAtPath(resourcePath: string): any {
    let resource = this.resourceCache?.get(resourcePath);
    if (!resource) {
      if (/^virtual:/.test(resourcePath)) {
        const [, packageKey, resourceKey] = resourcePath.match(/^virtual:([^:]+):(.*)$/);
        if (packageKey && resourceKey) {
          const pkg = this.virtualPackages.get(packageKey);
          resource =
            resourceKey === 'package.json'
              ? pkg?.getPackageJSON()
              : pkg?.getResourceByKey(resourceKey);
        }
      } else {
        resource = this.packageCache.getResourceAtPath(resourcePath);
      }
      if (this.safeMode === SafeMode.FREEZE) {
        resource = deepFreeze(resource);
      }
      this.resourceCache?.set(resourcePath, resource);
    }
    return this.safeMode === SafeMode.CLONE ? cloneDeep(resource) : resource;
  }

  getPackageLoadStatus(name: string, version: string): LoadStatus {
    const pkg = this.packageDB.findPackageInfo(name, version);
    if (pkg) {
      return LoadStatus.LOADED;
    }
    return LoadStatus.NOT_LOADED;
  }

  findPackageInfos(name: string): PackageInfo[] {
    return this.packageDB.findPackageInfos(name);
  }

  findPackageInfo(name: string, version: string): PackageInfo {
    return this.packageDB.findPackageInfo(name, version);
  }

  findPackageJSONs(name: string): any[] {
    return this.findPackageInfos(name)
      .filter(info => info.packageJSONPath)
      .map(info => {
        return this.getResourceAtPath(info.packageJSONPath);
      });
  }

  findPackageJSON(name: string, version: string) {
    const info = this.findPackageInfo(name, version);
    if (info?.packageJSONPath) {
      return this.getResourceAtPath(info.packageJSONPath);
    }
  }

  findResourceInfos(key: string, options?: FindResourceInfoOptions): ResourceInfo[] {
    return this.packageDB.findResourceInfos(key, options);
  }

  findResourceInfo(key: string, options?: FindResourceInfoOptions): ResourceInfo {
    return this.packageDB.findResourceInfo(key, options);
  }

  findResourceJSONs(key: string, options?: FindResourceInfoOptions): any[] {
    return this.findResourceInfos(key, options)
      .filter(info => info.resourcePath)
      .map(info => {
        return this.getResourceAtPath(info.resourcePath);
      });
  }

  findResourceJSON(key: string, options?: FindResourceInfoOptions) {
    const info = this.findResourceInfo(key, options);
    if (info?.resourcePath) {
      return this.getResourceAtPath(info.resourcePath);
    }
  }

  exportDB(): Promise<{ mimeType: string; data: Buffer }> {
    return this.packageDB.exportDB();
  }

  optimize() {
    this.packageDB.optimize();
  }

  clear() {
    this.packageDB.clear();
  }
}

function isCurrentVersion(version: string) {
  return /^current(\$.+)?$/.test(version);
}

/**
 * Takes a date in format YYYYMMDDHHmmss and converts to YYYY-MM-DDTHH:mm:ss
 * @param {string} date - The date to format
 * @returns {string} the formatted date
 */
function formatDate(date: string): string {
  return date
    ? date.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
    : '';
}

function getSDFlavor(resourceJSON: any) {
  if (resourceJSON.resourceType === 'StructureDefinition') {
    if (
      resourceJSON.type === 'Extension' &&
      resourceJSON.baseDefinition !== 'http://hl7.org/fhir/StructureDefinition/Element'
    ) {
      return 'Extension';
    } else if (resourceJSON.derivation === 'constraint') {
      return 'Profile';
    } else if (/type/.test(resourceJSON.kind)) {
      return 'Type';
    } else if (resourceJSON.kind === 'resource') {
      return 'Resource';
    } else if (resourceJSON.kind === 'logical') {
      return 'Logical';
    }
  }
}

// See: https://www.geeksforgeeks.org/how-to-deep-freeze-an-object-in-javascript/
function deepFreeze(obj: any) {
  Object.keys(obj).forEach(property => {
    if (
      typeof obj[property] === 'object' &&
      obj[property] !== null &&
      !Object.isFrozen(obj[property])
    ) {
      deepFreeze(obj[property]);
    }
  });
  return Object.freeze(obj);
}
