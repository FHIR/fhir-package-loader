import path from 'path';
import { CurrentBuildClient } from '../current';
import { PackageDB } from '../db';
import { InvalidResourceError } from '../errors';
import { PackageInfo, PackageStats, ResourceInfo } from '../package';
import { RegistryClient } from '../registry';
import { LogFunction } from '../utils';
import { PackageCache } from '../cache/PackageCache';
import { PackageLoadStatus, PackageLoader } from './PackageLoader';

export type BasePackageLoaderOptions = {
  log?: LogFunction;
};

export class BasePackageLoader implements PackageLoader {
  private log: LogFunction;
  constructor(
    private packageDB: PackageDB,
    private packageCache: PackageCache,
    private registryClient: RegistryClient,
    private currentBuildClient: CurrentBuildClient,
    options: BasePackageLoaderOptions = {}
  ) {
    this.log = options.log ?? (() => {});
  }

  async loadPackage(name: string, version: string): Promise<PackageLoadStatus> {
    let packageLabel = `${name}#${version}`;

    // If it's already loaded, then there's nothing to do
    if (this.getPackageLoadStatus(name, version) === PackageLoadStatus.LOADED) {
      this.log('info', `${packageLabel} already loaded`);
      return PackageLoadStatus.LOADED;
    }

    // If it's a "dev" version, but it wasn't found in the cache, fall back to using the current version
    if (version === 'dev') {
      this.log(
        'info',
        `Falling back to ${name}#current since ${packageLabel} is not locally cached. To avoid this, add ${packageLabel} to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.`
      );
      version = 'current';
      packageLabel = `${name}#${version}`;
    }

    // If it's a "current" version, download the latest version from the build server (if applicable)
    if (isCurrentVersion(version)) {
      const branch = version.indexOf('$') !== -1 ? version.split('$')[1] : undefined;
      if (await this.isCurrentVersionMissingOrStale(name, branch)) {
        try {
          const tarballStream = await this.currentBuildClient.downloadCurrentBuild(name, branch);
          await this.packageCache.cachePackageTarball(name, version, tarballStream);
        } catch (e) {
          this.log('error', `Failed to download ${packageLabel} from current builds`);
        }
      }
    }
    // Else if it isn't "current" and isn't in the cache, download it from the registry
    else if (!this.packageCache.isPackageInCache(name, version)) {
      try {
        const tarballStream = await this.registryClient.download(name, version);
        await this.packageCache.cachePackageTarball(name, version, tarballStream);
      } catch (e) {
        this.log('error', `Failed to download ${packageLabel} from registry`);
      }
    }

    // Finally attempt to load it from the cache
    let stats: PackageStats;
    try {
      stats = this.loadPackageFromCache(name, version);
    } catch (e) {
      this.log('error', `Failed to load ${name}#${version}`);
      return PackageLoadStatus.FAILED;
    }
    this.log('info', `Loaded ${packageLabel} with ${stats.resourceCount} resources`);
    return PackageLoadStatus.LOADED;
  }

  // async loadLocalPackage(
  //   name: string,
  //   version: string,
  //   packagePath: string,
  //   strict: boolean
  // ): Promise<PackageLoadStatus> {
  //   return PackageLoadStatus.FAILED;
  // }

  private loadPackageFromCache(name: string, version: string) {
    // Ensure the package is cached
    if (!this.packageCache.isPackageInCache(name, version)) {
      // TODO: More specific error?
      throw new Error(`${name}#${version} cannot be loaded from the package cache`);
    }

    // Get the cached package path and package.json path
    const packagePath = this.packageCache.getPackagePath(name, version);
    const packageJSONPath = this.packageCache.getPackageJSONPath(name, version);

    // Register the package information
    const info: PackageInfo = {
      name,
      version,
      packagePath: path.resolve(packagePath),
      packageJSONPath: path.resolve(packageJSONPath)
    };
    this.packageDB.savePackageInfo(info);

    // Load the resources within the package
    this.loadResourcesFromCache(name, version);

    return this.packageDB.getPackageStats(name, version);
  }

  private loadResourcesFromCache(packageName: string, packageVersion: string) {
    this.packageCache.getResourcePaths(packageName, packageVersion).forEach(resourcePath => {
      try {
        this.loadResourceFromCache(resourcePath, packageName, packageVersion);
      } catch (e) {
        // swallow this error because some JSON files will not be resources
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
    packageVersion?: string
  ) {
    // We require at least a resourceType in order to know it is FHIR
    if (typeof resourceJSON.resourceType !== 'string' || resourceJSON.resourceType === '') {
      throw new InvalidResourceError(resourcePath, 'resource does not specify its resourceType');
    }

    const info: ResourceInfo = { resourceType: resourceJSON.resourceType };
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
    if (resourceJSON.resourceType === 'StructureDefinition') {
      if (typeof resourceJSON.kind === 'string') {
        info.sdKind = resourceJSON.kind;
      }
      if (typeof resourceJSON.derivation === 'string') {
        info.sdDerivation = resourceJSON.derivation;
      }
      if (typeof resourceJSON.type === 'string') {
        info.sdType = resourceJSON.type;
      }
      if (typeof resourceJSON.baseDefinition === 'string') {
        info.sdBaseDefinition = resourceJSON.baseDefinition;
      }
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
      } catch (e) {
        // do nothing -- will fall back to stale if we couldn't determine staleness
      }
    }
    return isStale;
  }

  getPackageLoadStatus(name: string, version: string): PackageLoadStatus {
    const pkg = this.packageDB.findPackageInfo(name, version);
    if (pkg) {
      return PackageLoadStatus.LOADED;
    }
    return PackageLoadStatus.NOT_LOADED;
  }

  findPackageInfo(name: string, version: string): PackageInfo {
    return this.packageDB.findPackageInfo(name, version);
  }

  findResourceInfos(key: string): ResourceInfo[] {
    return this.packageDB.findResourceInfos(key);
  }

  findResourceInfo(key: string): ResourceInfo {
    return this.packageDB.findResourceInfo(key);
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
