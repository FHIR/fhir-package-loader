import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { PackageDB } from './PackageDB';
import { LogFunction } from './utils';
import { RegistryClient } from './RegistryClient';
import { PackageStats } from './PackageStats';
import { CurrentBuildClient } from './CurrentBuildClient';

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
    const pkg = this.packageDB.findPackage(name, version);
    if (pkg) {
      return pkg.error == null ? PackageLoadStatus.LOADED : PackageLoadStatus.FAILED;
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
      stats = await this.packageDB.registerPackageAtPath(
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
