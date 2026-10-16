import path from 'path';
import fs from 'fs-extra';
import temp from 'temp';
import { DiskBasedPackageCache } from '../../src/cache/DiskBasedPackageCache';
import { loggerSpy } from '../testhelpers';

// Track temporary folders/files so they are automatically cleaned up
temp.track();

describe('DiskBasedPackageCache', () => {
  const cacheFolder = path.resolve(__dirname, 'fixtures', 'fhircache');
  let cache: DiskBasedPackageCache;

  beforeEach(() => {
    cache = new DiskBasedPackageCache(cacheFolder, { log: loggerSpy.log });
    loggerSpy.reset();
  });

  describe('#cachePackageTarball', () => {
    it('should cache a fhir package tarball to the cache folder', async () => {
      const tempCacheFolder = temp.mkdirSync('fpl-test');
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, { log: loggerSpy.log });
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
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, { log: loggerSpy.log });
      const expectedTargetFolder = path.join(tempCacheFolder, 'fhir.small.wrong#0.1.0');
      expect(fs.existsSync(expectedTargetFolder)).toBeFalsy();
      // NOTE: This package has example, xml, package, and other folders at root
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-wrong-package.tgz')
      );
      const realRename = fs.rename;
      const realMove = fs.move;
      const expectedSiblings = new Set(['example', 'other', 'xml']);
      const completedSiblings = new Set<string>();
      const startedRenames: Promise<void>[] = [];
      let extractionRoot: string | undefined;
      const failures: unknown[] = [];
      const renameSpy = jest.spyOn(fs, 'rename');
      const moveSpy = jest.spyOn(fs, 'move');
      try {
        renameSpy.mockImplementation(
          (source: fs.PathLike, destination: fs.PathLike, callback?: fs.NoParamCallback) => {
            if (
              callback === undefined &&
              typeof source === 'string' &&
              typeof destination === 'string'
            ) {
              const root = path.dirname(source);
              const sibling = path.basename(source);
              if (
                expectedSiblings.has(sibling) &&
                destination === path.join(root, 'package', sibling) &&
                (extractionRoot === undefined || root === extractionRoot)
              ) {
                extractionRoot = root;
                const rename = new Promise<void>(resolve => setImmediate(resolve)).then(
                  async () => {
                    await realRename(source, destination);
                    completedSiblings.add(sibling);
                  }
                );
                startedRenames.push(rename);
                return rename;
              }
            }
            if (callback) {
              return realRename(source, destination, callback);
            }
            return realRename(source, destination);
          }
        );
        moveSpy.mockImplementation(
          (
            source: string,
            destination: string,
            options?: fs.MoveOptions | fs.NoParamCallbackWithUndefined,
            callback?: fs.NoParamCallbackWithUndefined
          ) => {
            if (destination === expectedTargetFolder) {
              expect(source).toBe(extractionRoot);
              expect(completedSiblings).toEqual(expectedSiblings);
            }
            if (typeof options === 'function') {
              return realMove(source, destination, options);
            }
            if (callback) {
              return realMove(source, destination, options, callback);
            }
            return realMove(source, destination, options);
          }
        );
        try {
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
        } catch (error) {
          failures.push(error);
        }
        const results = await Promise.allSettled(startedRenames);
        for (const result of results) {
          if (result.status === 'rejected') {
            failures.push(result.reason);
          }
        }
        if (failures.length === 1) {
          throw failures[0];
        }
        if (failures.length > 1) {
          const details = failures
            .map(failure =>
              failure instanceof Error ? (failure.stack ?? failure.message) : String(failure)
            )
            .join('\n\n');
          throw Object.assign(new Error(`Multiple malformed-package test failures:\n${details}`), {
            errors: failures
          });
        }
      } finally {
        renameSpy.mockRestore();
        moveSpy.mockRestore();
      }
    });

    it('should reject normalization failures before replacing an existing cached package', async () => {
      const tempCacheFolder = temp.mkdirSync('fpl-test');
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, { log: loggerSpy.log });
      const targetFolder = path.join(tempCacheFolder, 'fhir.small.wrong#0.1.0');
      const packageFolder = path.join(targetFolder, 'package');
      const packageJSONPath = path.join(packageFolder, 'package.json');
      const sentinelPath = path.join(packageFolder, 'sentinel.txt');
      const sentinelContents = 'Keep the existing cached package.';
      const oldPackageJSON = {
        name: 'fhir.small.wrong',
        version: '0.1.0',
        description: 'Existing cached package'
      };
      await fs.ensureDir(packageFolder);
      await fs.writeFile(sentinelPath, sentinelContents, 'utf-8');
      await fs.writeJSON(packageJSONPath, oldPackageJSON);
      const tarballStream = fs.createReadStream(
        path.join(__dirname, 'fixtures', 'tarballs', 'small-wrong-package.tgz')
      );
      const realRename = fs.rename;
      const normalizationError = new Error('Normalization rename failed');
      const expectedSiblings = new Set(['example', 'other', 'xml']);
      let extractionRoot: string | undefined;
      let normalizationStarts = 0;
      const renameSpy = jest.spyOn(fs, 'rename');
      try {
        renameSpy.mockImplementation(
          (source: fs.PathLike, destination: fs.PathLike, callback?: fs.NoParamCallback) => {
            if (
              callback === undefined &&
              typeof source === 'string' &&
              typeof destination === 'string'
            ) {
              const root = path.dirname(source);
              const sibling = path.basename(source);
              if (
                expectedSiblings.has(sibling) &&
                destination === path.join(root, 'package', sibling) &&
                (extractionRoot === undefined || root === extractionRoot)
              ) {
                extractionRoot = root;
                normalizationStarts += 1;
                if (normalizationStarts === 1) {
                  return Promise.reject(normalizationError);
                }
              }
            }
            if (callback) {
              return realRename(source, destination, callback);
            }
            return realRename(source, destination);
          }
        );
        await expect(
          tempCache.cachePackageTarball('fhir.small.wrong', '0.1.0', tarballStream)
        ).rejects.toBe(normalizationError);
        expect(normalizationStarts).toBe(1);
        expect(fs.readFileSync(sentinelPath, 'utf-8')).toBe(sentinelContents);
        expect(fs.readJSONSync(packageJSONPath)).toEqual(oldPackageJSON);
        expect(loggerSpy.getAllMessages('info')).not.toContain(
          `Cached fhir.small.wrong#0.1.0 to ${targetFolder}`
        );
      } finally {
        renameSpy.mockRestore();
      }
    });

    it('should cache a fhir package tarball to the cache folder and replace the existing cached package if applicable', async () => {
      const tempCacheFolder = temp.mkdirSync('fpl-test');
      const tempCache = new DiskBasedPackageCache(tempCacheFolder, { log: loggerSpy.log });
      // Make a rubbish cache of the fhir.small#0.1.0 package
      const packageFolder = path.join(tempCacheFolder, 'fhir.small#0.1.0', 'package');
      await fs.ensureDir(packageFolder);
      await fs.writeFile(path.join(packageFolder, 'rubbish.txt'), 'Total rubbish.', 'utf-8');
      await fs.writeJSON(path.join(packageFolder, 'package.json'), { rubbish: true });
      // cache the real fhir.small#0.1.0 package
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
      // Ensure that the package.json was replaced and the rubbish file removed
      expect(packageJSON.rubbish).toBeUndefined();
      expect(fs.existsSync(path.join(packageFolder, 'rubbish.txt'))).toBeFalsy();
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

    it('should return empty array for a package with different version in the cache', () => {
      const potentials = cache.getPotentialResourcePaths('fhir.small', '0.2.0');
      expect(potentials).toHaveLength(0);
      expect(loggerSpy.getAllLogs()).toHaveLength(0);
    });
  });

  describe('#getResourceAtPath', () => {
    it('should return a resource with a given resource path', () => {
      const resourcePath = path.resolve(
        cacheFolder,
        'fhir.small#0.1.0',
        'package',
        'StructureDefinition-MyPatient.json'
      );
      const resource = cache.getResourceAtPath(resourcePath);
      expect(resource).toBeDefined();
      expect(resource.id).toBe('MyPatient');
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should throw an error when attempting to get a JSON resource at an invalid path', () => {
      const resourcePath = path.resolve(
        cacheFolder,
        'fhir.small#0.1.0',
        'package',
        'Wrong-Path.json'
      );
      expect(() => cache.getResourceAtPath(resourcePath)).toThrow(
        `Failed to get JSON resource at path ${resourcePath}`
      );
    });

    it('should throw an error when attempting to get a XML resource at an invalid path', () => {
      const resourcePath = path.resolve(
        cacheFolder,
        'fhir.small#0.1.0',
        'package',
        'Wrong-Path.xml'
      );
      expect(() => cache.getResourceAtPath(resourcePath)).toThrow(
        `Failed to get XML resource at path ${resourcePath}`
      );
    });

    it('should throw an error when attempting to get a non-JSON/non-XML resource at an invalid path', () => {
      const resourcePath = path.resolve(
        cacheFolder,
        'fhir.small#0.1.0',
        'package',
        'xml',
        'StructureDefinition-MyPatient.sch'
      );
      expect(() => cache.getResourceAtPath(resourcePath)).toThrow(
        `Failed to find XML or JSON file at path ${resourcePath}`
      );
    });
  });
});
