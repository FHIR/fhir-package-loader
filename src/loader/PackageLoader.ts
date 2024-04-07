import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { CurrentBuildClient } from '../current';
import { PackageDB } from '../db';
import { InvalidPackageError, InvalidResourceError } from '../errors';
import { PackageInfo, PackageStats, ResourceInfo } from '../package';
import { RegistryClient } from '../registry';
import { LogFunction } from '../utils';

export type PackageLoaderOptions = {
  log?: LogFunction;
  fhirPackageCache?: string;
};

export enum PackageLoadStatus {
  LOADED = 'LOADED',
  NOT_LOADED = 'NOT_LOADED',
  FAILED = 'FAILED'
}

export class PackageLoader {
  private log: LogFunction;
  private fhirPackageCache: string;
  constructor(
    private packageDB: PackageDB,
    private registryClient: RegistryClient,
    private currentBuildClient: CurrentBuildClient,
    options: PackageLoaderOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.fhirPackageCache =
      options.fhirPackageCache ?? path.join(os.homedir(), '.fhir', 'packages');
  }

  clear() {
    this.packageDB.clear();
  }

  getPackageLoadStatus(name: string, version: string): PackageLoadStatus {
    const pkg = this.packageDB.findPackageInfo(name, version);
    if (pkg) {
      return PackageLoadStatus.LOADED;
    }
    return PackageLoadStatus.NOT_LOADED;
  }

  isPackageInFHIRCache(name: string, version: string): boolean {
    return fs.existsSync(path.join(this.fhirPackageCache, `${name}#${version}`));
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
          await this.currentBuildClient.downloadCurrentBuild(name, branch, this.fhirPackageCache);
        } catch (e) {
          this.log('error', `Failed to download ${packageLabel} from current builds`);
        }
      }
    }
    // Else if it isn't "current" and isn't in the cache, download it from the registry
    else if (!this.isPackageInFHIRCache(name, version)) {
      try {
        await this.registryClient.download(name, version, this.fhirPackageCache);
      } catch (e) {
        this.log('error', `Failed to download ${packageLabel} from registry`);
      }
    }

    // Finally attempt to load it from the cache
    let stats: PackageStats;
    try {
      stats = await this.loadPackageAtPath(
        path.join(this.fhirPackageCache, `${name}#${version}`),
        name,
        version
      );
    } catch (e) {
      this.log('error', `Failed to load ${name}#${version}`);
      return PackageLoadStatus.FAILED;
    }
    this.log('info', `Loaded ${packageLabel} with ${stats.resourceCount} resources`);
    return PackageLoadStatus.LOADED;
  }

  async loadPackageAtPath(packagePath: string, overrideName?: string, overrideVersion?: string) {
    // Check that we have a valid package
    const packageContentDir = path.join(packagePath, 'package');
    try {
      if (!(await fs.stat(packageContentDir)).isDirectory()) {
        throw new Error(); // will be caught directly below
      }
    } catch (e) {
      throw new InvalidPackageError(
        packagePath,
        `${packageContentDir} does not exist or is not a directory`
      );
    }

    // Load the package.json file
    const packageJSONPath = path.join(packageContentDir, 'package.json');
    let packageJSON = null;
    try {
      packageJSON = await fs.readJSON(packageJSONPath);
    } catch {
      throw new InvalidPackageError(
        packagePath,
        `${packageJSONPath} does not exist or is not a valid JSON file`
      );
    }

    // Get the name and version from the package.json file (or use overrides if applicable)
    const name = overrideName ?? packageJSON.name;
    if (name == null) {
      throw new InvalidPackageError(packagePath, `${packageJSONPath} is missing the name property`);
    }
    const version = overrideVersion ?? packageJSON.version;
    if (version == null) {
      throw new InvalidPackageError(
        packagePath,
        `${packageJSONPath} is missing the version property`
      );
    }

    // Register the package information
    const info: PackageInfo = {
      name,
      version,
      packagePath: path.resolve(packagePath),
      packageJSONPath: path.resolve(packageJSONPath)
    };
    this.packageDB.savePackageInfo(info);

    // Load the resources within the package
    await this.loadResourcesAtPath(packageContentDir, name, version);

    return this.packageDB.getPackageStats(name, version);
  }

  async loadResourcesAtPath(folderPath: string, packageName?: string, packageVersion?: string) {
    const files = await fs.readdir(folderPath);
    return Promise.all(
      files.map(async f => {
        const filePath = path.join(folderPath, f);
        if (/\.json$/i.test(filePath)) {
          try {
            await this.loadResourceAtPath(filePath, packageName, packageVersion);
          } catch (e) {
            // swallow this error because some JSON files will not be resources
          }
        }
      })
    );
  }

  async loadResourceAtPath(filePath: string, packageName?: string, packageVersion?: string) {
    let json: any;
    try {
      json = await fs.readJSON(filePath);
    } catch (e) {
      throw new InvalidResourceError(filePath, 'invalid FHIR resource file');
    }

    // We require at least a resourceType in order to know it is FHIR
    if (typeof json.resourceType !== 'string' || json.resourceType === '') {
      throw new InvalidResourceError(filePath, 'resource does not specify its resourceType');
    }

    const info: ResourceInfo = { resourceType: json.resourceType };
    if (typeof json.id === 'string') {
      info.id = json.id;
    }
    if (typeof json.url === 'string') {
      info.url = json.url;
    }
    if (typeof json.name === 'string') {
      info.name = json.name;
    }
    if (typeof json.version === 'string') {
      info.version = json.version;
    }
    if (json.resourceType === 'StructureDefinition') {
      if (typeof json.kind === 'string') {
        info.sdKind = json.kind;
      }
      if (typeof json.derivation === 'string') {
        info.sdDerivation = json.derivation;
      }
      if (typeof json.type === 'string') {
        info.sdType = json.type;
      }
      if (typeof json.baseDefinition === 'string') {
        info.sdBaseDefinition = json.baseDefinition;
      }
    }
    if (packageName) {
      info.packageName = packageName;
    }
    if (packageVersion) {
      info.packageVersion = packageVersion;
    }
    info.resourcePath = path.resolve(filePath);

    this.packageDB.saveResourceInfo(info);
  }

  private async isCurrentVersionMissingOrStale(name: string, branch?: string) {
    let isStale = true;
    const version = branch ? `current$${branch}` : 'current';
    const packageLabel = `${name}#${version}`;
    if (this.isPackageInFHIRCache(name, version)) {
      const cachedPackageJSONPath = path.join(
        this.fhirPackageCache,
        `${name}#${version}`,
        'package',
        'package.json'
      );
      if (fs.existsSync(cachedPackageJSONPath)) {
        const cachedPackageDate = fs.readJSONSync(cachedPackageJSONPath).date;
        if (cachedPackageDate) {
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
      }
    }
    return isStale;
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
