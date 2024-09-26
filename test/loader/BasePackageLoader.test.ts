import path from 'path';
import { mock, mockReset } from 'jest-mock-extended';
import { Readable } from 'stream';
import { BasePackageLoader } from '../../src/loader/BasePackageLoader';
import { LoadStatus } from '../../src/loader/PackageLoader';
import { PackageDB } from '../../src/db';
import { PackageCache } from '../../src/cache';
import { RegistryClient } from '../../src/registry';
import { CurrentBuildClient } from '../../src/current';
import { loggerSpy } from '../testhelpers';
import fs from 'fs-extra';

describe('BasePackageLoader', () => {
  let loader: BasePackageLoader;
  const packageDBMock = mock<PackageDB>();
  const packageCacheMock = mock<PackageCache>();
  const registryClientMock = mock<RegistryClient>();
  const currentBuildClientMock = mock<CurrentBuildClient>();
  let loadPackageFromCacheSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy.reset();
    mockReset(packageDBMock);
    mockReset(packageCacheMock);
    mockReset(registryClientMock);
    mockReset(currentBuildClientMock);
    loadPackageFromCacheSpy = jest.spyOn(
      BasePackageLoader.prototype as any,
      'loadPackageFromCache'
    );
    loader = new BasePackageLoader(
      packageDBMock,
      packageCacheMock,
      registryClientMock,
      currentBuildClientMock,
      { log: loggerSpy.log }
    );
  });

  afterEach(() => {
    loadPackageFromCacheSpy.mockRestore();
  });

  function setupLoadPackage(
    name?: string,
    version?: string,
    loadStatus?: string,
    tarball?: Readable,
    packageJsonPath?: string,
    resourceAtPath?: string,
    currentBuildDate?: string,
    resourceInfo?: object
  ): any {
    const pkgVars = {
      name: name,
      version: version,
      tarball: tarball ? tarball : Readable.from([`${name}$${version}-data`]),
      packageJsonPath: packageJsonPath ? packageJsonPath : `Package/json/path/${name}/${version}`,
      resourceAtPath: resourceAtPath
        ? resourceAtPath
        : {
            resource: `${packageJsonPath}`,
            date: '20240824230227',
            resourceType: 'resourceTypeName'
          },
      currentBuildDate: currentBuildDate
        ? new Promise<string>(resolve => resolve(currentBuildDate))
        : new Promise<string>(resolve => resolve('20240824230227')),
      resourceInfo: resourceInfo ? resourceInfo : undefined
    };
    // the initial load status for if a package is loaded
    if (loadStatus == 'loaded') {
      loader.getPackageLoadStatus = jest.fn().mockReturnValueOnce(LoadStatus.LOADED);
    } else {
      loader.getPackageLoadStatus = jest.fn().mockReturnValueOnce(LoadStatus.NOT_LOADED);
    }
    return pkgVars;
  }

  describe('#loadPackage', () => {
    // current and dev
    it('should return LOADED when the package is already loaded', async () => {
      const pkg = setupLoadPackage('some.ig', '1.2.3', 'loaded');

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.LOADED);
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', '1.2.3');
      expect(packageDBMock.savePackageInfo).not.toHaveBeenCalled();
    });

    it('should use current version if dev version was not found in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', 'dev', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: '1.2.8',
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith(pkg.name, pkg.version);
      expect(loggerSpy.getMessageAtIndex(-2, 'info')).toBe(
        'Falling back to some.ig#current since some.ig#dev is not locally cached. To avoid this, add some.ig#dev to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.'
      );
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.8 with 5 resources');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should successfully download current version to cache that is missing or stale', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) matches last build date (2024-08-24T23:02:27), so the cached package will be used'
      );
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should not successfully download current version to cache that is missing or stale', async () => {
      const pkg = setupLoadPackage(
        'some.ig',
        'current',
        'not-loaded',
        undefined,
        undefined,
        undefined,
        '20200824230227'
      );
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild.mockRejectedValue(
        new Error('error with download current build')
      );
      loadPackageFromCacheSpy.mockImplementation(() => {
        throw new Error('load pkg from cache error');
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(result).toBe(LoadStatus.FAILED);
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) does not match last build date (2020-08-24T23:02:27)'
      );
      expect(loggerSpy.getMessageAtIndex(-2, 'error')).toBe(
        'Failed to download some.ig#current from current builds'
      );
      expect(loggerSpy.getMessageAtIndex(-1, 'error')).toBe('Failed to load some.ig#current');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
    });

    it('should successfully load current package in cache when current version is not missing or stale', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) matches last build date (2024-08-24T23:02:27), so the cached package will be used'
      );
      expect(currentBuildClientMock.downloadCurrentBuild).not.toHaveBeenCalled();
      expect(packageCacheMock.cachePackageTarball).not.toHaveBeenCalled();
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(result).toBe(LoadStatus.LOADED);
    });

    // non-current
    it('should use dev version if dev version and was found in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', 'dev', 'not-loaded');
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValueOnce(true);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith(pkg.name, pkg.version);
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'dev');
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#dev with 5 resources');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should load a specific package with branch from the registry when it is not in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', 'specific-branch$1.2.3', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);
      registryClientMock.download.calledWith(pkg.name, pkg.version).mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.LOADED);
      expect(loggerSpy.getLastMessage('info')).toBe(
        'Loaded some.ig#specific-branch$1.2.3 with 5 resources'
      );
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'specific-branch$1.2.3');
    });

    it('should load a versioned package without branch from the registry when it is not in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', '1.2.3', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);
      registryClientMock.download.calledWith(pkg.name, pkg.version).mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.LOADED);
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.3 with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', '1.2.3');
    });

    it('should load a patch versioned package from the registry when it is not in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', '1.2.x', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);
      registryClientMock.download.calledWith(pkg.name, pkg.version).mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: '1.2.3',
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.LOADED);
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.3 with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', '1.2.x');
    });

    it('should load a latest versioned package from the registry when it is not in the cache', async () => {
      const pkg = setupLoadPackage('some.ig', 'latest', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);
      registryClientMock.download.calledWith(pkg.name, pkg.version).mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: '1.2.3',
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.LOADED);
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.3 with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'latest');
    });

    it('should log error when a versioned package is unable to be downloaded from the registry', async () => {
      const pkg = setupLoadPackage('some.ig', '1.2.3', 'not-loaded');
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(false);

      registryClientMock.download.calledWith(pkg.name, pkg.version).mockImplementation(() => {
        throw new Error('error with download current build');
      });
      loadPackageFromCacheSpy.mockImplementation(() => {
        throw new Error('load pkg from cache error');
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(result).toBe(LoadStatus.FAILED);
      expect(loggerSpy.getMessageAtIndex(-2, 'error')).toBe(
        'Failed to download some.ig#1.2.3 from registry'
      );
      expect(loggerSpy.getLastMessage('error')).toBe('Failed to load some.ig#1.2.3');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', '1.2.3');
    });

    // methods USED by loadPackage: isCurrentVersionMissingOrStale
    it('should successfully download package when current version in cache out of date', async () => {
      const pkg = setupLoadPackage(
        'some.ig',
        'current',
        'not-loaded',
        undefined,
        undefined,
        undefined,
        '20200824230227'
      );
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValue({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(packageCacheMock.getPackageJSONPath).toHaveBeenCalledWith('some.ig', 'current');
      expect(packageCacheMock.getResourceAtPath).toHaveBeenCalled();
      expect(currentBuildClientMock.getCurrentBuildDate).toHaveBeenCalled();
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) does not match last build date (2020-08-24T23:02:27)'
      );
      expect(loggerSpy.getMessageAtIndex(-2, 'info')).toBe(
        'Cached package some.ig#current is out of date and will be replaced by the most recent current build.'
      );
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should successfully use cached package when current version in cache is up to date', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValue({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(packageCacheMock.getPackageJSONPath).toHaveBeenCalledWith('some.ig', 'current');
      expect(packageCacheMock.getResourceAtPath).toHaveBeenCalled();
      expect(currentBuildClientMock.getCurrentBuildDate).toHaveBeenCalled();
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) matches last build date (2024-08-24T23:02:27), so the cached package will be used'
      );
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should successfully create date for string in messages logged', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceAtPath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValue({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      await loader.loadPackage('some.ig', 'current');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toContain('2024-08-24T23:02:27');
      expect(
        '2024-08-24T23:02:27'
          .replace('-', '')
          .replace('-', '')
          .replace(':', '')
          .replace('T', '')
          .replace(':', '')
      ).toBe('20240824230227');
    });

    it('should catch error and assume stale version if packageJSONPath was not found', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(undefined);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValue({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(packageCacheMock.getPackageJSONPath).toHaveBeenCalledWith('some.ig', 'current');
      expect(packageCacheMock.getResourceAtPath).not.toHaveBeenCalled();
      expect(currentBuildClientMock.getCurrentBuildDate).not.toHaveBeenCalled();
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should catch error and assume stale version if cachedPackageDate was not found', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(undefined);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: pkg.version,
        resourceCount: 5
      });

      const result = await loader.loadPackage('some.ig', 'current');
      expect(packageCacheMock.getPackageJSONPath).toHaveBeenCalledWith('some.ig', 'current');
      expect(packageCacheMock.getResourceAtPath).toHaveBeenCalledWith(pkg.packageJsonPath);
      expect(currentBuildClientMock.getCurrentBuildDate).not.toHaveBeenCalled();
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should throw error if package is not cached on final load', async () => {
      const humanBeingResourcePath = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-human-being-logical-model.json'
      );
      const pkg = setupLoadPackage(
        'human-being-logical-model',
        '1.0.0',
        'not-loaded',
        undefined,
        humanBeingResourcePath,
        undefined,
        '20240824230227'
      );
      packageCacheMock.isPackageInCache
        .calledWith(pkg.name, pkg.version)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const result = await loader.loadPackage('human-being-logical-model', '1.0.0');
      expect(result).toBe(LoadStatus.FAILED);
      expect(loggerSpy.getMessageAtIndex(-1, 'error')).toBe(
        'Failed to load human-being-logical-model#1.0.0'
      );
      expect(packageCacheMock.getPackagePath).not.toHaveBeenCalled();
    });

    it('should use non local package paths to find package with logical flavor', async () => {
      const humanBeingResourcePath = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-human-being-logical-model.json'
      );
      const pkg = setupLoadPackage(
        'human-being-logical-model',
        '1.0.0',
        'not-loaded',
        undefined,
        humanBeingResourcePath,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'human-being-logical-model' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('human-being-logical-model', '1.0.0');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'human-being-logical-model',
        url: 'http://example.org/fhir/locals/StructureDefinition/human-being-logical-model',
        name: 'Human',
        version: '1.0.0',
        sdKind: 'logical',
        sdDerivation: 'specialization',
        sdType: 'http://example.org/fhir/locals/StructureDefinition/human-being-logical-model',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Base',
        sdAbstract: false,
        sdCharacteristics: ['can-be-target'],
        sdFlavor: 'Logical',
        packageName: 'human-being-logical-model',
        packageVersion: '1.0.0',
        resourcePath: humanBeingResourcePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use LOCAL package paths to find package', async () => {
      const humanBeingResourcePath = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-human-being-logical-model.json'
      );
      const pkg = setupLoadPackage(
        'LOCAL',
        'LOCAL',
        'not-loaded',
        undefined,
        humanBeingResourcePath,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'human-being-logical-model' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('LOCAL', 'LOCAL');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'human-being-logical-model',
        url: 'http://example.org/fhir/locals/StructureDefinition/human-being-logical-model',
        name: 'Human',
        version: '1.0.0',
        sdKind: 'logical',
        sdDerivation: 'specialization',
        sdType: 'http://example.org/fhir/locals/StructureDefinition/human-being-logical-model',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Base',
        sdAbstract: false,
        sdCharacteristics: ['can-be-target'],
        sdFlavor: 'Logical',
        packageName: 'LOCAL',
        packageVersion: 'LOCAL',
        resourcePath: humanBeingResourcePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with profile flavor', async () => {
      const resourceProfileFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-valued-observation.json'
      );
      const pkg = setupLoadPackage(
        'valued-observation',
        '1.0.0',
        'not-loaded',
        undefined,
        resourceProfileFlavor,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'valued-observation' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('valued-observation', '1.0.0');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'valued-observation',
        url: 'http://example.org/fhir/locals/StructureDefinition/valued-observation',
        name: 'ValuedObservationProfile',
        version: '1.0.0',
        sdKind: 'resource',
        sdDerivation: 'constraint',
        sdType: 'Observation',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
        sdAbstract: false,
        sdFlavor: 'Profile',
        packageName: 'valued-observation',
        packageVersion: '1.0.0',
        resourcePath: resourceProfileFlavor
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with resource flavor', async () => {
      const resourceResourceFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-Condition.json'
      );
      const pkg = setupLoadPackage(
        'Condition',
        '4.0.1',
        'not-loaded',
        undefined,
        resourceResourceFlavor,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'Condition' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('Condition', '4.0.1');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'Condition',
        url: 'http://hl7.org/fhir/StructureDefinition/Condition',
        name: 'Condition',
        version: '4.0.2',
        sdKind: 'resource',
        sdDerivation: 'specialization',
        sdType: 'Condition',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/DomainResource',
        sdAbstract: false,
        sdFlavor: 'Resource',
        packageName: 'Condition',
        packageVersion: '4.0.1',
        resourcePath: resourceResourceFlavor
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with type flavor', async () => {
      const resourceResourceFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-Address.json'
      );
      const pkg = setupLoadPackage(
        'Address',
        '4.0.1',
        'not-loaded',
        undefined,
        resourceResourceFlavor,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'Address' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageDBMock.savePackageInfo.mockImplementation(() => {});
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('Address', '4.0.1');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Address',
          version: '4.0.1'
        })
      );
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'Address',
        url: 'http://hl7.org/fhir/StructureDefinition/Address',
        name: 'Address',
        version: '4.0.1',
        sdKind: 'complex-type',
        sdDerivation: 'specialization',
        sdType: 'Address',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Element',
        sdAbstract: false,
        sdFlavor: 'Type',
        packageName: 'Address',
        packageVersion: '4.0.1',
        resourcePath: resourceResourceFlavor
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with extension url of imposeprofile', async () => {
      const resourceResourceFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-named-and-gendered-patient.json'
      );
      const pkg = setupLoadPackage(
        'named-and-gendered-patient',
        '0.1.0',
        'not-loaded',
        undefined,
        resourceResourceFlavor,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'valued-observation' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('named-and-gendered-patient', '0.1.0');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'named-and-gendered-patient',
        url: 'http://example.org/impose/StructureDefinition/named-and-gendered-patient',
        name: 'NamedAndGenderedPatient',
        version: '0.1.0',
        sdKind: 'resource',
        sdDerivation: 'constraint',
        sdType: 'Patient',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
        sdAbstract: false,
        sdFlavor: 'Profile',
        sdImposeProfiles: [
          'http://example.org/impose/StructureDefinition/named-patient',
          'http://example.org/impose/StructureDefinition/gendered-patient'
        ],
        packageName: 'named-and-gendered-patient',
        packageVersion: '0.1.0',
        resourcePath: resourceResourceFlavor
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    // it('should use non local package paths to find package with extension url of logical-target', async () => {
    // });

    it('should use non local package paths to find package with package json path that leads to non-existing resource', async () => {
      const pkg = setupLoadPackage('empty-json-id', '0.1.0', 'not-loaded');
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      packageCacheMock.getResourceAtPath.calledWith(pkg.packageJsonPath).mockImplementation(() => {
        throw new Error('load resource at json path error');
      });
      packageDBMock.getPackageStats.calledWith(pkg.name, pkg.version).mockImplementation(() => {
        throw new Error('get package stats error');
      });

      const result = await loader.loadPackage('empty-json-id', '0.1.0');
      expect(result).toBe(LoadStatus.FAILED);
      // expect(loggerSpy.getLastMessage('info')).toBe('JSON file at path Package/json/path/empty-json-id/0.1.0 was not FHIR resource');
      expect(packageCacheMock.getPotentialResourcePaths).toHaveBeenCalled();
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).not.toHaveBeenCalled();
    });

    it('should use non local package paths to find package with extension flavor', async () => {
      const resourceResourceFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-patient-birthPlace.json'
      );
      const pkg = setupLoadPackage(
        'patient-birthPlace',
        '4.0.1',
        'not-loaded',
        undefined,
        resourceResourceFlavor,
        undefined,
        '2024-05-24T16:27:17-04:00',
        { resourceType: 'StructureDefinition', id: 'patient-birthPlace' }
      );
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.packageJsonPath]);
      const humanBeingJSON = fs.readJsonSync(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValue(humanBeingJSON);
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('patient-birthPlace', '4.0.1');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'patient-birthPlace',
        url: 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace',
        name: 'birthPlace',
        version: '4.0.1',
        sdKind: 'complex-type',
        sdDerivation: 'constraint',
        sdType: 'Extension',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension',
        sdAbstract: false,
        sdFlavor: 'Extension',
        packageName: 'patient-birthPlace',
        packageVersion: '4.0.1',
        resourcePath: resourceResourceFlavor
      });
      expect(result).toBe(LoadStatus.LOADED);
    });
  });

  describe('#getPackageLoadStatus', () => {
    it('should return LOADED status if package was previously loaded', async () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo.calledWith(name, version).mockReturnValue({ name, version });
      const result = loader.getPackageLoadStatus(name, version);
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should return NOT_LOADED status if package was not previously loaded', async () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo.calledWith(name, version).mockReturnValue(undefined);
      const result = loader.getPackageLoadStatus(name, version);
      expect(result).toBe(LoadStatus.NOT_LOADED);
    });
  });

  describe('#findPackageInfos', () => {
    it('should return package info array', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      loader.findPackageInfos = jest.fn().mockReturnValueOnce([{ name, version }]);
      const result = loader.findPackageInfos(name);
      expect(result[0].name).toBe(name);
      expect(result[0].version).toBe(version);
    });
  });

  describe('#findPackageInfo', () => {
    it('should return package info object', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      loader.findPackageInfo = jest.fn().mockReturnValueOnce({ name, version });
      const result = loader.findPackageInfo(name, version);
      expect(result.name).toBe(name);
      expect(result.version).toBe(version);
    });
  });

  describe('#findPackageJSONs', () => {
    it('should return package json array', () => {
      const name = 'some.ig';
      loader.findPackageJSONs = jest
        .fn()
        .mockReturnValueOnce([
          { resource: 'json/path/name', date: '20240824230227', resourceType: 'resourceTypeName' }
        ]);
      const result = loader.findPackageJSONs(name);
      expect(result[0].resource).toBe('json/path/name');
      expect(result[0].date).toBe('20240824230227');
      expect(result[0].resourceType).toBe('resourceTypeName');
    });
  });

  describe('#findPackageJSON', () => {
    it('should return package json array', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      loader.findPackageJSON = jest.fn().mockReturnValueOnce({
        resource: 'json/path/name',
        date: '20240824230227',
        resourceType: 'resourceTypeName'
      });
      const result = loader.findPackageJSON(name, version);
      expect(result.resource).toBe('json/path/name');
      expect(result.date).toBe('20240824230227');
      expect(result.resourceType).toBe('resourceTypeName');
    });
  });

  describe('#findResourceInfos', () => {
    it('should return resource array', () => {
      const name = 'some.ig';
      loader.findResourceInfos = jest
        .fn()
        .mockReturnValueOnce([
          { resource: 'json/path/name', date: '20240824230227', resourceType: 'resourceTypeName' }
        ]);
      const result = loader.findResourceInfos(name);
      expect(result[0].resourceType).toBe('resourceTypeName');
    });
  });

  describe('#findResourceInfo', () => {
    it('should return resource info', () => {
      const name = 'some.ig';
      loader.findResourceInfo = jest.fn().mockReturnValueOnce({
        resource: 'json/path/name',
        date: '20240824230227',
        resourceType: 'resourceTypeName'
      });
      const result = loader.findResourceInfo(name);
      expect(result.resourceType).toBe('resourceTypeName');
    });
  });

  describe('#findResourceJSONs', () => {
    it('should return resource json array', () => {
      const name = 'some.ig';
      loader.findResourceJSONs = jest
        .fn()
        .mockReturnValueOnce([
          { resource: 'json/path/name', date: '20240824230227', resourceType: 'resourceTypeName' }
        ]);
      const result = loader.findResourceJSONs(name);
      expect(result[0].resource).toBe('json/path/name');
      expect(result[0].date).toBe('20240824230227');
      expect(result[0].resourceType).toBe('resourceTypeName');
    });
  });

  describe('#findResourceJSON', () => {
    it('should return resource json', () => {
      const name = 'some.ig';
      loader.findResourceJSON = jest.fn().mockReturnValueOnce({
        resource: 'json/path/name',
        date: '20240824230227',
        resourceType: 'resourceTypeName'
      });
      const result = loader.findResourceJSON(name);
      expect(result.resource).toBe('json/path/name');
      expect(result.date).toBe('20240824230227');
      expect(result.resourceType).toBe('resourceTypeName');
    });
  });

  describe('#clear', () => {
    it('should return resource json', () => {
      loader.clear();
      expect(packageDBMock.clear).toHaveBeenCalled();
    });
  });
});
