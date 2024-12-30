import { Readable } from 'stream';
import zlib from 'zlib';
import tar from 'tar-stream';
import { LogFunction } from '../utils';
import { PackageCache, PackageCacheOptions } from './PackageCache';

export class BrowserBasedPackageCache implements PackageCache {
  private log: LogFunction;
  private localResourceMap: Map<string, Map<string, any>>;

  constructor(
    private databaseName: string,
    options: PackageCacheOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.localResourceMap = new Map();
  }

  // NOTE: need to call this after construction whenever using this PackageCache
  async initialize(dependencies: { name: string; version: string }[]): Promise<void> {
    const packageLabels = dependencies.map(d => `${d.name}#${d.version}`);
    return new Promise(resolve => {
      const openRequest = indexedDB.open(this.databaseName);
      openRequest.onsuccess = event => {
        const database = (event.target as IDBOpenDBRequest).result;
        const initializePromises = packageLabels.map(packageLabel =>
          initializeResourcesInLocalMap(database, packageLabel)
        );
        Promise.allSettled(initializePromises)
          .then(results =>
            results
              .filter(result => result.status === 'fulfilled')
              .forEach(result => {
                const [packageLabel, resources] = result.value;
                this.localResourceMap.set(packageLabel, resources);
              })
          )
          .then(() => {
            database.close();
            resolve();
          });
      };
    });
  }

  async cachePackageTarball(name: string, version: string, data: Readable): Promise<string> {
    const packageLabel = `${name}#${version}`;

    if (version === 'current' || version === 'dev') {
      // not currently supported in browsers
      throw Error('"current" or "dev" package versions are not yet supported.');
    }

    return new Promise(resolve => {
      const resources: any[] = [];
      // Extract the package
      const extract = tar.extract();
      extract.on('entry', (header, stream, next) => {
        let resourceData = '';
        stream.on('data', chunk => {
          resourceData += chunk.toString();
        });
        stream.on('end', () => {
          try {
            const resource = JSON.parse(resourceData);
            if (resource.resourceType) {
              resources.push(resource);
            } else if (header.name.endsWith('/package.json') || header.name === 'package.json') {
              // Add a placeholder resourceType and id so we can uniquely store and retrieve package.json
              resource.resourceType = 'packagejson';
              resource.id = name; // This should be the same as resource.name
              resources.push(resource);
            }
          } catch {
            // Right now, if the JSON doesn't parse, we just ignore it.
          }
          next();
        });
        stream.resume();
      });
      extract.on('finish', async () => {
        this.log('info', `Downloaded ${packageLabel}`);

        // Add the package in IndexedDB (replacement of local FHIR cache for the browser)
        const savedResources = await addToIndexedDB(this.databaseName, packageLabel, resources);
        // Add the package and resources to the localResourceMap to be used to avoid async calls later
        const allResources = new Map(savedResources.map(r => [`${r.resourceType}-${r.id}`, r]));
        this.localResourceMap.set(packageLabel, allResources);

        this.log('info', `Cached ${packageLabel} to browser IndexedDB`);
        resolve(`${packageLabel}`);
      });

      data.pipe(zlib.createGunzip()).pipe(extract);
    });
  }

  // Use the localResourceMap to avoid needing an async call to IndexedDB
  isPackageInCache(name: string, version: string): boolean {
    const packageLabel = `${name}#${version}`;
    return this.localResourceMap.has(packageLabel);
  }

  getPackagePath(name: string, version: string): string | undefined {
    if (this.isPackageInCache(name, version)) {
      return `${name}#${version}`;
    }
  }

  getPackageJSONPath(name: string, version: string): string | undefined {
    if (
      this.isPackageInCache(name, version) &&
      this.localResourceMap.get(`${name}#${version}`).has(`packagejson-${name}`)
    ) {
      return `${name}#${version}#packagejson-${name}`;
    }
  }

  // Use the localResourceMap to avoid needing an async call to IndexedDB
  getPotentialResourcePaths(name: string, version: string): string[] {
    if (!this.isPackageInCache(name, version)) {
      return [];
    }

    const packageLabel = `${name}#${version}`;
    const packageMap = this.localResourceMap.get(packageLabel);
    const packagesResources = Array.from(packageMap.keys());
    // Ensure consistency by sorting the final paths (also aligns with DiskBasedPackageCache)
    return packagesResources.map(resourceLabel => `${packageLabel}#${resourceLabel}`).sort();
  }

  // Use the localResourceMap to avoid needing an async call to IndexedDB
  getResourceAtPath(resourcePath: string) {
    const [name, version, resourceLabel] = resourcePath.split('#');
    const packageMap = this.localResourceMap.get(`${name}#${version}`);
    if (packageMap == null) {
      throw new Error(`Failed to get resource from package ${name}#${version}`);
    }
    const resource = packageMap.get(resourceLabel);
    if (resource == null) {
      throw new Error(`Failed to get resource at path ${resourcePath}`);
    }
    return resource;
  }
}

async function addToIndexedDB(databaseName: string, packageLabel: string, resources: any[]) {
  const databaseVersion = await getNextDatabaseVersion(databaseName);
  return addResourcesToDatabase(databaseName, databaseVersion, packageLabel, resources);
}

async function getNextDatabaseVersion(databaseName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(databaseName);
    openRequest.onsuccess = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      const nextVersion = database.version + 1;
      database.close();
      resolve(nextVersion);
    };
    openRequest.onerror = error => reject(error);
  });
}

async function addResourcesToDatabase(
  databaseName: string,
  databaseVersion: number,
  packageLabel: string,
  resources: any[]
): Promise<any[]> {
  const savedResources: any[] = [];
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(databaseName, databaseVersion);
    openRequest.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      database.createObjectStore(packageLabel, { keyPath: ['id', 'resourceType'] });
    };
    openRequest.onsuccess = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      const transaction = database.transaction([packageLabel], 'readwrite');
      const objectStore = transaction.objectStore(packageLabel);
      resources.forEach(resource => {
        if (resource.id && resource.resourceType) {
          objectStore.put(resource);
          savedResources.push(resource);
        }
      });
      transaction.oncomplete = () => {
        database.close();
        resolve(savedResources);
      };
      transaction.onerror = () => {
        database.close();
        reject('Unexpected error adding package to cache');
      };
    };
    openRequest.onerror = () => {
      reject('Unexpected error saving package to cache');
    };
  });
}

function initializeResourcesInLocalMap(
  database: any,
  packageLabel: string
): Promise<[string, Map<string, any>]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([packageLabel]);
    const objectStore = transaction.objectStore(packageLabel);
    const request = objectStore.getAll();
    request.onerror = () => {
      reject('Unexpected error trying to initialize');
    };
    request.onsuccess = (event: any) => {
      const listOfResources: [string, any][] = event.target.result.map((r: any) => [
        `${r.resourceType}-${r.id}`,
        r
      ]);
      const resourceMap = new Map(listOfResources);
      resolve([packageLabel, resourceMap]);
    };
  });
}
