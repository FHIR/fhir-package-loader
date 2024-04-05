import path from 'path';
import temp from 'temp';
import fs from 'fs-extra';
import { DiskBasedPackageCache } from '../../src/cache/DiskBasedPackageCache';
import { loggerSpy } from '../testhelpers';

// Track temporary folders/files so they are automatically cleaned up
temp.track();

describe('DiskBasedPackageCache', () => {
  const cacheFolder = path.resolve(__dirname, 'fixtures', 'fhircache');
  const local1Folder = path.resolve(__dirname, 'fixtures', 'local', 'local1');
  const local2Folder = path.resolve(__dirname, 'fixtures', 'local', 'local2');
  let cache: DiskBasedPackageCache;

  beforeEach(() => {
    cache = new DiskBasedPackageCache(cacheFolder, [], { log: loggerSpy.log });
    loggerSpy.reset();
  });

  describe('#cachePackageTarball', () => {
    it('should cache a fhir package tarball to the cache folder', async () => {
      const tempCacheFolder = temp.mkdirSync('fpl-test');
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, [], { log: loggerSpy.log });
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-package.tgz')
      );
      const targetFolder = await tempCache.cachePackageTarball(
        'fhir.small',
        '0.1.0',
        tarballStream
      );
      expect(targetFolder).toEqual(path.join(tempCacheFolder, 'fhir.small#0.1.0'));
      // Check that a few expected files are there
      const packageJSONPath = path.join(targetFolder, 'package', 'package.json');
      expect(fs.existsSync(packageJSONPath)).toBeTruthy();
      const packageJSON = fs.readJSONSync(packageJSONPath);
      expect(packageJSON.name).toEqual('fhir.small');
      expect(packageJSON.version).toEqual('0.1.0');
      const igJSONPath = path.join(targetFolder, 'package', 'ImplementationGuide-fhir.small.json');
      expect(fs.existsSync(igJSONPath)).toBeTruthy();
      const igJSON = fs.readJSONSync(igJSONPath);
      expect(igJSON.resourceType).toEqual('ImplementationGuide');
      expect(igJSON.id).toEqual('fhir.small');
    });

    it('should clean a malformed fhir package tarball when caching it', async () => {
      const tempCacheFolder = temp.mkdirSync('fpl-test');
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, [], { log: loggerSpy.log });
      // NOTE: This package has example, xml, package, and other folders at root
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-wrong-package.tgz')
      );
      const targetFolder = await tempCache.cachePackageTarball(
        'fhir.small.wrong',
        '0.1.0',
        tarballStream
      );
      expect(targetFolder).toEqual(path.join(tempCacheFolder, 'fhir.small.wrong#0.1.0'));
      // Check that package JSON hasn't moved
      const packageJSONPath = path.join(targetFolder, 'package', 'package.json');
      expect(fs.existsSync(packageJSONPath)).toBeTruthy();
      const packageJSON = fs.readJSONSync(packageJSONPath);
      expect(packageJSON.name).toEqual('fhir.small.wrong');
      expect(packageJSON.version).toEqual('0.1.0');
      // Check that example, other, and xml folders have moved
      expect(fs.existsSync(path.join(targetFolder, 'example'))).toBeFalsy();
      expect(fs.existsSync(path.join(targetFolder, 'package', 'example'))).toBeTruthy();
      expect(fs.existsSync(path.join(targetFolder, 'other'))).toBeFalsy();
      expect(fs.existsSync(path.join(targetFolder, 'package', 'other'))).toBeTruthy();
      expect(fs.existsSync(path.join(targetFolder, 'xml'))).toBeFalsy();
      expect(fs.existsSync(path.join(targetFolder, 'package', 'xml'))).toBeTruthy();
      // And do one check to make sure their contents moved too
      const exampleJSONPath = path.join(
        targetFolder,
        'package',
        'example',
        'Patient-PatientExample.json'
      );
      expect(fs.existsSync(exampleJSONPath)).toBeTruthy();
      const exampleJSON = fs.readJSONSync(exampleJSONPath);
      expect(exampleJSON.id).toEqual('PatientExample');
    });
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

    it('should always return true for the special LOCAL#LOCAL package', () => {
      expect(cache.isPackageInCache('LOCAL', 'LOCAL')).toBeTruthy();
    });
  });

  describe('#getPackagePath', () => {
    it('should return the package path for a package in the cache', () => {
      expect(cache.getPackagePath('fhir.small', '0.1.0')).toBe(
        path.resolve(cacheFolder, 'fhir.small#0.1.0')
      );
    });

    it('should return undefined for a package not in the cache', () => {
      expect(cache.getPackagePath('big', '0.1.0')).toBeUndefined();
    });

    it('should return undefined for a package with different version in the cache', () => {
      expect(cache.getPackagePath('fhir.small', '0.2.0')).toBeUndefined();
    });

    it('should return empty path for the special LOCAL#LOCAL package when no resource folders are configured', () => {
      expect(cache.getPackagePath('LOCAL', 'LOCAL')).toBe('');
    });

    it('should return single path for the special LOCAL#LOCAL package when one resource folder is configured', () => {
      const cacheWithFolder = new DiskBasedPackageCache(cacheFolder, [local1Folder]);
      expect(cacheWithFolder.getPackagePath('LOCAL', 'LOCAL')).toBe(local1Folder);
    });

    it('should return semi-colon-separated path for the special LOCAL#LOCAL package when multiple resource folders are configured', () => {
      const cacheWithFolder = new DiskBasedPackageCache(cacheFolder, [local1Folder, local2Folder]);
      expect(cacheWithFolder.getPackagePath('LOCAL', 'LOCAL')).toBe(
        `${local1Folder};${local2Folder}`
      );
    });
  });

  describe('#getPackageJSONPath', () => {
    it('should return the path to package.json for a package in the cache', () => {
      expect(cache.getPackageJSONPath('fhir.small', '0.1.0')).toBe(
        path.resolve(cacheFolder, 'fhir.small#0.1.0', 'package', 'package.json')
      );
    });

    it('should return undefined for a package not in the cache', () => {
      expect(cache.getPackageJSONPath('big', '0.1.0')).toBeUndefined();
    });

    it('should return undefined for a package with different version in the cache', () => {
      expect(cache.getPackageJSONPath('fhir.small', '0.2.0')).toBeUndefined();
    });

    it('should return undefined for the special LOCAL#LOCAL package', () => {
      expect(cache.getPackageJSONPath('LOCAL', 'LOCAL')).toBeUndefined();
    });
  });

  describe('#getPotentialResourcePaths', () => {
    it('should return potential paths for a package in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('fhir.small', '0.1.0');
      expect(potentials).toHaveLength(3);
      const rootPath = path.resolve(cacheFolder, 'fhir.small#0.1.0', 'package');
      expect(potentials).toContain(path.resolve(rootPath, 'ImplementationGuide-fhir.small.json'));
      expect(potentials).toContain(path.resolve(rootPath, 'package.json'));
      expect(potentials).toContain(path.resolve(rootPath, 'StructureDefinition-MyPatient.json'));
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });

    it('should return empty array for a package not in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('big', '0.1.0');
      expect(potentials).toHaveLength(0);
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });

    it('should return undefined for a package with different version in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('fhir.small', '0.2.0');
      expect(potentials).toHaveLength(0);
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });

    it('should return potential paths for the special LOCAL#LOCAL package', () => {
      const cacheWithFolder = new DiskBasedPackageCache(cacheFolder, [local1Folder, local2Folder], {
        log: loggerSpy.log
      });
      const potentials = cacheWithFolder.getPotentialResourcePaths('LOCAL', 'LOCAL');
      expect(potentials).toHaveLength(12);
      expect(potentials).toContain(path.resolve(local1Folder, 'CodeSystem-a-to-d.json'));
      expect(potentials).toContain(path.resolve(local1Folder, 'CodeSystem-x-to-z.xml'));
      expect(potentials).toContain(
        path.resolve(local1Folder, 'StructureDefinition-family-member.json')
      );
      expect(potentials).toContain(
        path.resolve(local1Folder, 'StructureDefinition-human-being-logical-model.json')
      );
      expect(potentials).toContain(
        path.resolve(local1Folder, 'StructureDefinition-true-false.xml')
      );
      expect(potentials).toContain(
        path.resolve(local1Folder, 'StructureDefinition-valued-observation.json')
      );
      expect(potentials).toContain(path.resolve(local1Folder, 'ValueSet-beginning-and-end.json'));
      expect(potentials).toContain(path.resolve(local2Folder, 'Binary-LogicalModelExample.json'));
      expect(potentials).toContain(path.resolve(local2Folder, 'Binary-LogicalModelExample.xml'));
      expect(potentials).toContain(path.resolve(local2Folder, 'Observation-A1Example.xml'));
      expect(potentials).toContain(path.resolve(local2Folder, 'Observation-B2Example.json'));
      expect(potentials).toContain(path.resolve(local2Folder, 'Patient-JamesPondExample.json'));
      expect(loggerSpy.getAllLogs('debug')).toHaveLength(3);
      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m => /^Skipped spreadsheet XML file: .*resources-spreadsheet\.xml$/.test(m))
      ).toBeTruthy();
      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m =>
            /^Skipped spreadsheet XML file: .*sneaky-spread-like-bread-sheet\.xml$/.test(m)
          )
      ).toBeTruthy();
      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m => /^Skipped non-JSON \/ non-XML file: .*not-a-resource\.txt$/.test(m))
      ).toBeTruthy();
      expect(loggerSpy.getAllLogs('info')).toHaveLength(2);
      expect(loggerSpy.getFirstMessage('info')).toMatch(
        /Found 2 spreadsheet\(s\) in directory: .*local1\./
      );
      expect(loggerSpy.getLastMessage('info')).toMatch(
        /Found 1 non-JSON \/ non-XML file\(s\) in directory: .*local2\./
      );
    });
  });

  describe('#getResourceAtPath', () => {
    // tests go here
  });
});
