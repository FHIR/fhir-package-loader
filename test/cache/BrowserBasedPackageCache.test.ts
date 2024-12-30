import path from 'path';
import fs from 'fs-extra';
import { BrowserBasedPackageCache } from '../../src/cache/BrowserBasedPackageCache';
import { loggerSpy } from '../testhelpers';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const getAllFromIndexedDB = async (databaseName: string, packageLabel: string) => {
  return new Promise(resolve => {
    const openRequest = indexedDB.open(databaseName);
    openRequest.onsuccess = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      const transaction = database.transaction([packageLabel]);
      const objectStore = transaction.objectStore(packageLabel);
      const request = objectStore.getAll();
      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };
    };
  });
};

describe('BrowserBasedPackageCache', () => {
  const databaseName = 'Mock Browser DB';
  let cache: BrowserBasedPackageCache;

  beforeEach(async () => {
    indexedDB = new IDBFactory();
    const tarballStream = fs.createReadStream(
      path.join(__dirname, 'fixtures', 'tarballs', 'small-package.tgz')
    );
    cache = new BrowserBasedPackageCache(databaseName, { log: loggerSpy.log });
    // cache a package to be used in tests later
    await cache.cachePackageTarball('fhir.small', '0.1.0', tarballStream);
    loggerSpy.reset();
  });

  describe('#cachePackageTarball', () => {
    it('should cache a fhir package tarball to the cache folder', async () => {
      const tempCache = new BrowserBasedPackageCache('Mock for cachePackageTarball', {
        log: loggerSpy.log
      });
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-package.tgz')
      );
      const targetPackageLabel = await tempCache.cachePackageTarball(
        'fhir.small',
        '0.1.0',
        tarballStream
      );
      expect(targetPackageLabel).toEqual('fhir.small#0.1.0');

      // Check that a few expected files are in IndexedDb
      const allSavedResources: any = await getAllFromIndexedDB(
        'Mock for cachePackageTarball',
        'fhir.small#0.1.0'
      );
      const packageJSON = allSavedResources.find(
        (r: any) => r.resourceType === 'packagejson' && r.id === 'fhir.small'
      );
      expect(packageJSON.name).toEqual('fhir.small');
      expect(packageJSON.version).toEqual('0.1.0');
      const igJSON = allSavedResources.find(
        (r: any) => r.resourceType === 'ImplementationGuide' && r.id === 'fhir.small'
      );
      expect(igJSON.resourceType).toEqual('ImplementationGuide');
      expect(igJSON.id).toEqual('fhir.small');
      expect(igJSON.name).toEqual('small');
    });

    it('should add resources from a malformed fhir package tarball when caching it', async () => {
      const tempCache = new BrowserBasedPackageCache('Mock for cachePackageTarball', {
        log: loggerSpy.log
      });
      // NOTE: This package has example, xml, package, and other folders at root
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-wrong-package.tgz')
      );
      const targetFolder = await tempCache.cachePackageTarball(
        'fhir.small.wrong',
        '0.1.0',
        tarballStream
      );
      expect(targetFolder).toEqual('fhir.small.wrong#0.1.0');

      const allSavedResources: any = await getAllFromIndexedDB(
        'Mock for cachePackageTarball',
        'fhir.small.wrong#0.1.0'
      );
      // Check that package JSON is added
      const packageJSON = allSavedResources.find(
        (r: any) => r.resourceType === 'packagejson' && r.id === 'fhir.small.wrong'
      );
      expect(packageJSON.name).toEqual('fhir.small.wrong');
      expect(packageJSON.version).toEqual('0.1.0');
      // Check that resources in example and other folders are added if possible
      const patientExample = allSavedResources.find(
        (r: any) => r.resourceType === 'Patient' && r.id === 'PatientExample'
      );
      expect(patientExample.name).toBeDefined();
      const bundle = allSavedResources.find((r: any) => r.resourceType === 'Bundle');
      expect(bundle).toBeUndefined(); // Bundle resource doesn't have an id
    });

    // Current implementation of BrowserBasedPackageCache does not overwrite package if it exists
    // This is a difference from the DiskBasedPackageCache but has not been needed yet
    it.skip('should cache a fhir package tarball to the cache folder and replace the existing cached package if applicable', async () => {});
  });

  describe('#isPackageInCache', () => {
    it('should return true for a package in the cache', () => {
      expect(cache.isPackageInCache('fhir.small', '0.1.0')).toBeTruthy();
    });

    it('should return false for a package not in the cache', () => {
      expect(cache.isPackageInCache('bug', '0.1.0')).toBeFalsy();
    });

    it('should return false for a package with different version in the cache', () => {
      expect(cache.isPackageInCache('fhir.small', '0.2.0')).toBeFalsy();
    });
  });

  describe('#getPackagePath', () => {
    it('should return the package path for a package in the cache', () => {
      expect(cache.getPackagePath('fhir.small', '0.1.0')).toBe('fhir.small#0.1.0');
    });

    it('should return undefined for a package not in the cache', () => {
      expect(cache.getPackagePath('big', '0.1.0')).toBeUndefined();
    });

    it('should return undefined for a package with different version in the cache', () => {
      expect(cache.getPackagePath('fhir.small', '0.2.0')).toBeUndefined();
    });
  });

  describe('#getPackageJSONPath', () => {
    it('should return the path to package.json for a package in the cache', () => {
      expect(cache.getPackageJSONPath('fhir.small', '0.1.0')).toBe(
        'fhir.small#0.1.0#packagejson-fhir.small'
      );
    });

    it('should return undefined for a package not in the cache', () => {
      expect(cache.getPackageJSONPath('big', '0.1.0')).toBeUndefined();
    });

    it('should return undefined for a package with different version in the cache', () => {
      expect(cache.getPackageJSONPath('fhir.small', '0.2.0')).toBeUndefined();
    });
  });

  describe('#getPotentialResourcePaths', () => {
    // Note: This implementation differs from DiskBasedPackageCache because it returns potentials from nested folders
    it('should return potential paths for a package in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('fhir.small', '0.1.0');
      expect(potentials).toHaveLength(4);
      expect(potentials).toContain('fhir.small#0.1.0#ImplementationGuide-fhir.small');
      expect(potentials).toContain('fhir.small#0.1.0#packagejson-fhir.small');
      expect(potentials).toContain('fhir.small#0.1.0#StructureDefinition-MyPatient');
      expect(potentials).toContain('fhir.small#0.1.0#Patient-PatientExample');
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });

    it('should return empty array for a package not in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('big', '0.1.0');
      expect(potentials).toHaveLength(0);
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });

    it('should return empty array for a package with different version in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('fhir.small', '0.2.0');
      expect(potentials).toHaveLength(0);
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });
  });

  describe('#getResourceAtPath', () => {
    it('should return a resource with a given resource path', () => {
      const resourcePath = 'fhir.small#0.1.0#StructureDefinition-MyPatient';
      const resource = cache.getResourceAtPath(resourcePath);
      expect(resource).toBeDefined();
      expect(resource.id).toBe('MyPatient');
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should throw an error when attempting to get a resource from an invalid package', () => {
      const resourcePath = 'bug#0.1.0#fake-resource';
      expect(() => cache.getResourceAtPath(resourcePath)).toThrow(
        'Failed to get resource from package bug#0.1.0'
      );
    });

    it('should throw an error when attempting to get an invalid resource from a valid package', () => {
      const resourcePath = 'fhir.small#0.1.0#Wrong-Path';
      expect(() => cache.getResourceAtPath(resourcePath)).toThrow(
        `Failed to get resource at path ${resourcePath}`
      );
    });
  });
});
