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
    packageBasePath?: string,
    resourcePath?: string,
    currentBuildDate?: string
  ): any {
    const pkgVars: any = {
      name: name,
      version: version,
      tarball: tarball ? tarball : Readable.from([`${name}$${version}-data`]),
      packageBasePath: packageBasePath ?? `Package/json/path/${name}/${version}`,
      currentBuildDate: currentBuildDate
        ? new Promise<string>(resolve => resolve(currentBuildDate))
        : new Promise<string>(resolve => resolve('20240824230227'))
    };
    pkgVars.packageJsonPath = path.join(pkgVars.packageBasePath, 'package', 'package.json');
    pkgVars.resourcePath =
      resourcePath ?? path.join(pkgVars.packageBasePath, 'package', 'Resource-Name.json');
    pkgVars.resourceInfo = {
      resource: `${pkgVars.resourcePath}`,
      date: '20240824230227',
      resourceType: 'resourceTypeName'
    };
    // the initial load status for if a package is loaded
    if (loadStatus == 'loaded') {
      loader.getPackageLoadStatus = jest.fn().mockReturnValueOnce(LoadStatus.LOADED);
    } else {
      loader.getPackageLoadStatus = jest.fn().mockReturnValueOnce(LoadStatus.NOT_LOADED);
    }
    return pkgVars;
  }

  function setupPackageWithFixture(name: string, version: string, fixtureFile: string) {
    const fixturePath = path.resolve(__dirname, 'fixtures', fixtureFile);
    const pkg = setupLoadPackage(
      name,
      version,
      'not-loaded',
      undefined,
      path.resolve(__dirname, 'fixtures'),
      fixturePath,
      '2024-05-24T16:27:17-04:00'
    );
    packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
    packageCacheMock.getPackagePath
      .calledWith(pkg.name, pkg.version)
      .mockReturnValue(pkg.packageBasePath);
    packageCacheMock.getPackageJSONPath
      .calledWith(pkg.name, pkg.version)
      .mockReturnValue(pkg.packageJsonPath);
    packageCacheMock.getPotentialResourcePaths
      .calledWith(pkg.name, pkg.version)
      .mockReturnValue([pkg.resourcePath]);
    const resourceJSON = fs.readJsonSync(fixturePath);
    packageCacheMock.getResourceAtPath.calledWith(pkg.resourcePath).mockReturnValue(resourceJSON);
    packageDBMock.getPackageStats
      .calledWith(pkg.name, pkg.version)
      .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });
    return fixturePath;
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
        .mockReturnValueOnce(pkg.resourcePath);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(pkg.name, undefined)
        .mockReturnValueOnce(pkg.currentBuildDate);
      currentBuildClientMock.downloadCurrentBuild
        .calledWith(pkg.name, 'current')
        .mockResolvedValue(pkg.tarball);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: pkg.name,
        version: 'current',
        resourceCount: 5
      });

      const result = await loader.loadPackage(pkg.name, pkg.version);
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith(pkg.name, pkg.version);
      expect(loggerSpy.getMessageAtIndex(-2, 'info')).toBe(
        'Falling back to some.ig#current since some.ig#dev is not locally cached. To avoid this, add some.ig#dev to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.'
      );
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should not successfully download current version to cache that is missing or stale if the package can not be downloaded', async () => {
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
        .mockReturnValueOnce(pkg.resourceInfo);
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
        .mockReturnValueOnce(pkg.resourceInfo);
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
      expect(packageCacheMock.getPackageJSONPath).toHaveBeenCalledWith('some.ig', 'current');
      expect(packageCacheMock.getResourceAtPath).toHaveBeenCalled();
      expect(currentBuildClientMock.getCurrentBuildDate).toHaveBeenCalled();
      expect(currentBuildClientMock.downloadCurrentBuild).not.toHaveBeenCalled();
      expect(packageCacheMock.cachePackageTarball).not.toHaveBeenCalled();
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current (2024-08-24T23:02:27) matches last build date (2024-08-24T23:02:27), so the cached package will be used'
      );
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#current with 5 resources');
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should successfully load a current branch of a package when the cached version is not missing or stale', async () => {
      const bonusPkg = setupLoadPackage('some.ig', 'current$bonus-items', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(bonusPkg.name, 'current$bonus-items')
        .mockReturnValueOnce(bonusPkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(bonusPkg.packageJsonPath)
        .mockReturnValueOnce(bonusPkg.resourceInfo);
      currentBuildClientMock.getCurrentBuildDate
        .calledWith(bonusPkg.name, 'bonus-items')
        .mockReturnValueOnce(bonusPkg.currentBuildDate);
      loadPackageFromCacheSpy.mockReturnValueOnce({
        name: bonusPkg.name,
        version: bonusPkg.version,
        resourceCount: 7
      });

      const result = await loader.loadPackage('some.ig', 'current$bonus-items');
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', 'current$bonus-items');
      expect(loggerSpy.getMessageAtIndex(-1, 'debug')).toBe(
        'Cached package date for some.ig#current$bonus-items (2024-08-24T23:02:27) matches last build date (2024-08-24T23:02:27), so the cached package will be used'
      );
      expect(currentBuildClientMock.downloadCurrentBuild).not.toHaveBeenCalled();
      expect(packageCacheMock.cachePackageTarball).not.toHaveBeenCalled();
      expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', 'current$bonus-items');
      expect(loggerSpy.getLastMessage('info')).toBe(
        'Loaded some.ig#current$bonus-items with 7 resources'
      );
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
        .mockReturnValueOnce(pkg.resourceInfo);
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

    it('should successfully create date for string in messages logged', async () => {
      const pkg = setupLoadPackage('some.ig', 'current', 'not-loaded');
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, 'current')
        .mockReturnValueOnce(pkg.packageJsonPath);
      packageCacheMock.getResourceAtPath
        .calledWith(pkg.packageJsonPath)
        .mockReturnValueOnce(pkg.resourceInfo);
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
      expect(currentBuildClientMock.downloadCurrentBuild).toHaveBeenCalled();
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
      expect(currentBuildClientMock.downloadCurrentBuild).toHaveBeenCalled();
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
        path.resolve(__dirname, 'fixtures'),
        humanBeingResourcePath,
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
      const fixturePath = setupPackageWithFixture(
        'human-being-logical-model',
        '1.0.0',
        'StructureDefinition-human-being-logical-model.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use LOCAL package paths to find package', async () => {
      const fixturePath = setupPackageWithFixture(
        'LOCAL',
        'LOCAL',
        'StructureDefinition-human-being-logical-model.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should find a logical that uses the logical-target extension to set its characteristics', async () => {
      const fixturePath = setupPackageWithFixture(
        'LOCAL',
        'LOCAL',
        'StructureDefinition-FuturePlanet.json'
      );
      const result = await loader.loadPackage('LOCAL', 'LOCAL');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'FuturePlanet',
        url: 'http://hl7.org/planet/logicals/StructureDefinition/FuturePlanet',
        name: 'FuturePlanet',
        sdKind: 'logical',
        sdDerivation: 'specialization',
        sdType: 'http://hl7.org/planet/logicals/StructureDefinition/FuturePlanet',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Basic',
        sdAbstract: false,
        sdCharacteristics: ['can-be-target'],
        sdFlavor: 'Logical',
        packageName: 'LOCAL',
        packageVersion: 'LOCAL',
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with profile flavor', async () => {
      const fixturePath = setupPackageWithFixture(
        'valued-observation',
        '1.0.0',
        'StructureDefinition-valued-observation.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with resource flavor', async () => {
      const fixturePath = setupPackageWithFixture(
        'Condition',
        '4.0.1',
        'StructureDefinition-Condition.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with resource flavor where the resource has no derivation', async () => {
      const fixturePath = setupPackageWithFixture(
        'Resource',
        '4.0.1',
        'StructureDefinition-Resource.json'
      );
      const result = await loader.loadPackage('Resource', '4.0.1');
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledWith({
        resourceType: 'StructureDefinition',
        id: 'Resource',
        url: 'http://hl7.org/fhir/StructureDefinition/Resource',
        name: 'Resource',
        version: '4.0.1',
        sdKind: 'resource',
        sdDerivation: 'specialization',
        sdType: 'Resource',
        sdAbstract: true,
        sdFlavor: 'Resource',
        packageName: 'Resource',
        packageVersion: '4.0.1',
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with type flavor', async () => {
      const fixturePath = setupPackageWithFixture(
        'Address',
        '4.0.1',
        'StructureDefinition-Address.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with extension url of imposeprofile', async () => {
      const fixturePath = setupPackageWithFixture(
        'named-and-gendered-patient',
        '0.1.0',
        'StructureDefinition-named-and-gendered-patient.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should use non local package paths to find package with package json path that leads to non-existing resource', async () => {
      const pkg = setupLoadPackage('empty-json-id', '0.1.0', 'not-loaded');
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageBasePath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([pkg.resourcePath]);
      packageCacheMock.getResourceAtPath.calledWith(pkg.resourcePath).mockImplementation(() => {
        throw new Error('load resource at json path error');
      });
      packageDBMock.getPackageStats.calledWith(pkg.name, pkg.version).mockImplementation(() => {
        throw new Error('get package stats error');
      });

      const result = await loader.loadPackage('empty-json-id', '0.1.0');
      expect(result).toBe(LoadStatus.FAILED);
      expect(packageCacheMock.getPotentialResourcePaths).toHaveBeenCalled();
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).not.toHaveBeenCalled();
    });

    it('should use non local package paths to find package with extension flavor', async () => {
      const fixturePath = setupPackageWithFixture(
        'patient-birthPlace',
        '4.0.1',
        'StructureDefinition-patient-birthPlace.json'
      );
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
        resourcePath: fixturePath
      });
      expect(result).toBe(LoadStatus.LOADED);
    });

    it('should show an info message when a JSON file in a loaded package is not a FHIR resource', async () => {
      const resourceResourceFlavor = path.resolve(
        __dirname,
        'fixtures',
        'StructureDefinition-patient-birthPlace.json'
      );
      const birthPlaceJSON = fs.readJsonSync(resourceResourceFlavor);
      const pkg = setupLoadPackage('package-with-non-resource', '4.0.1', 'not-loaded');
      packageCacheMock.isPackageInCache.calledWith(pkg.name, pkg.version).mockReturnValue(true);
      packageCacheMock.getPackagePath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageBasePath);
      packageCacheMock.getPackageJSONPath
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue(pkg.packageJsonPath);
      packageCacheMock.getPotentialResourcePaths
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue([
          path.join(pkg.packageJsonPath, '1.json'),
          path.join(pkg.packageJsonPath, '2.json')
        ]);
      packageCacheMock.getResourceAtPath
        .calledWith(path.join(pkg.packageJsonPath, '1.json'))
        .mockReturnValue(birthPlaceJSON);
      packageCacheMock.getResourceAtPath
        .calledWith(path.join(pkg.packageJsonPath, '2.json'))
        .mockReturnValue({ blanket: 'cozy' });
      packageDBMock.getPackageStats
        .calledWith(pkg.name, pkg.version)
        .mockReturnValue({ name: pkg.name, version: pkg.version, resourceCount: 1 });

      const result = await loader.loadPackage('package-with-non-resource', '4.0.1');
      // expect debug message for 2.json
      expect(loggerSpy.getLastMessage('debug')).toBe(
        `JSON file at path ${path.join(pkg.packageJsonPath, '2.json')} was not FHIR resource`
      );
      expect(packageDBMock.savePackageInfo).toHaveBeenCalled();
      expect(packageDBMock.saveResourceInfo).toHaveBeenCalledTimes(1);
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
        packageName: 'package-with-non-resource',
        packageVersion: '4.0.1',
        resourcePath: path.join(pkg.packageJsonPath, '1.json')
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
      packageDBMock.findPackageInfos.calledWith(name).mockReturnValueOnce([
        { name: 'some.ig', version: '1.2.3' },
        { name: 'some.ig', version: '2.3.4' }
      ]);
      const result = loader.findPackageInfos(name);
      expect(result).toEqual([
        { name: 'some.ig', version: '1.2.3' },
        { name: 'some.ig', version: '2.3.4' }
      ]);
    });
  });

  describe('#findPackageInfo', () => {
    it('should return package info object', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo
        .calledWith(name, version)
        .mockReturnValueOnce({ name: 'some.ig', version: '1.2.3' });
      const result = loader.findPackageInfo(name, version);
      expect(result.name).toBe('some.ig');
      expect(result.version).toBe('1.2.3');
    });
  });

  describe('#findPackageJSONs', () => {
    it('should return package json array', () => {
      const name = 'some.ig';
      packageDBMock.findPackageInfos.calledWith(name).mockReturnValueOnce([
        {
          name: 'some.ig',
          version: '1.2.3',
          packageJSONPath: '/first/package/package.json'
        },
        {
          name: 'some.ig',
          version: '2.3.4'
        },
        {
          name: 'some.ig',
          version: '3.4.5',
          packageJSONPath: '/third/package/package.json'
        }
      ]);
      packageCacheMock.getResourceAtPath
        .calledWith('/first/package/package.json')
        .mockReturnValueOnce({ id: 'some.ig', version: '1.2.3' });
      packageCacheMock.getResourceAtPath
        .calledWith('/second/package/package.json')
        .mockReturnValueOnce({ id: 'some.ig', version: '2.3.4' });
      packageCacheMock.getResourceAtPath
        .calledWith('/third/package/package.json')
        .mockReturnValueOnce({ id: 'some.ig', version: '3.4.5' });
      const result = loader.findPackageJSONs(name);
      expect(packageCacheMock.getResourceAtPath).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'some.ig', version: '1.2.3' });
      expect(result[1]).toEqual({ id: 'some.ig', version: '3.4.5' });
    });
  });

  describe('#findPackageJSON', () => {
    it('should return package json', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo.calledWith('some.ig', '1.2.3').mockReturnValueOnce({
        name: 'some.ig',
        version: '1.2.3',
        packageJSONPath: '/some/package/package.json'
      });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/package.json')
        .mockReturnValueOnce({
          date: '20240824230227',
          resourceType: 'resourceTypeName'
        });
      const result = loader.findPackageJSON(name, version);
      expect(result).toEqual({
        date: '20240824230227',
        resourceType: 'resourceTypeName'
      });
    });

    it('should return undefined when the info does not contain a packageJSONPath', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo.calledWith('some.ig', '1.2.3').mockReturnValueOnce({
        name: 'some.ig',
        version: '1.2.3'
      });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/package.json')
        .mockReturnValueOnce({
          date: '20240824230227',
          resourceType: 'resourceTypeName'
        });
      const result = loader.findPackageJSON(name, version);
      expect(result).toBeUndefined();
    });

    it('should return undefined when no info is found', () => {
      const name = 'some.ig';
      const version = '1.2.3';
      packageDBMock.findPackageInfo.calledWith('some.ig', '1.2.3').mockReturnValueOnce(undefined);
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/package.json')
        .mockReturnValueOnce({
          date: '20240824230227',
          resourceType: 'resourceTypeName'
        });
      const result = loader.findPackageJSON(name, version);
      expect(result).toBeUndefined();
    });
  });

  describe('#findResourceInfos', () => {
    it('should return resource array', () => {
      const resourceInfos = [
        {
          name: 'firstResource',
          resourceType: 'StructureDefinition',
          version: '1.2.3',
          resourcePath: '/some/package/first-thing.json'
        },
        {
          name: 'secondResource',
          resourceType: 'ValueSet',
          version: '1.2.3'
        },
        {
          name: 'thirdResource',
          resourceType: 'CodeSystem',
          version: '1.2.3',
          resourcePath: '/some/package/third-thing.json'
        }
      ];
      packageDBMock.findResourceInfos.calledWith('*').mockReturnValueOnce(resourceInfos);
      const result = loader.findResourceInfos('*');
      expect(result).toHaveLength(3);
      expect(result).toEqual(resourceInfos);
    });
  });

  describe('#findResourceInfo', () => {
    it('should return resource info', () => {
      packageDBMock.findResourceInfo.calledWith('firstResource').mockReturnValueOnce({
        name: 'firstResource',
        resourceType: 'StructureDefinition',
        version: '1.2.3',
        resourcePath: '/some/package/first-thing.json'
      });
      const result = loader.findResourceInfo('firstResource');
      expect(result).toEqual({
        name: 'firstResource',
        resourceType: 'StructureDefinition',
        version: '1.2.3',
        resourcePath: '/some/package/first-thing.json'
      });
    });
  });

  describe('#findResourceJSONs', () => {
    it('should return resource json array', () => {
      const resourceInfos = [
        {
          name: 'firstResource',
          resourceType: 'StructureDefinition',
          version: '1.2.3',
          resourcePath: '/some/package/first-thing.json'
        },
        {
          name: 'secondResource',
          resourceType: 'ValueSet',
          version: '1.2.3'
        },
        {
          name: 'thirdResource',
          resourceType: 'CodeSystem',
          version: '1.2.3',
          resourcePath: '/some/package/third-thing.json'
        }
      ];
      packageDBMock.findResourceInfos.calledWith('*').mockReturnValueOnce(resourceInfos);
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/first-thing.json')
        .mockReturnValueOnce({ id: 'first-thing', version: '1.2.3' });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/second-thing.json')
        .mockReturnValueOnce({ id: 'second-thing', version: '1.2.3' });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/third-thing.json')
        .mockReturnValueOnce({ id: 'third-thing', version: '1.2.3' });
      const result = loader.findResourceJSONs('*');
      expect(result).toEqual([
        { id: 'first-thing', version: '1.2.3' },
        { id: 'third-thing', version: '1.2.3' }
      ]);
    });
  });

  describe('#findResourceJSON', () => {
    it('should return resource json', () => {
      packageDBMock.findResourceInfo.calledWith('firstResource').mockReturnValueOnce({
        name: 'firstResource',
        resourceType: 'StructureDefinition',
        version: '1.2.3',
        resourcePath: '/some/package/first-thing.json'
      });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/first-thing.json')
        .mockReturnValueOnce({ id: 'first-thing', version: '1.2.3' });
      const result = loader.findResourceJSON('firstResource');
      expect(result).toEqual({ id: 'first-thing', version: '1.2.3' });
    });

    it('should return undefined when the info does not contain a resourcePath', () => {
      packageDBMock.findResourceInfo.calledWith('first-thing').mockReturnValueOnce({
        name: 'firstResource',
        resourceType: 'StructureDefinition',
        version: '1.2.3'
      });
      packageCacheMock.getResourceAtPath
        .calledWith('/some/package/first-thing.json')
        .mockReturnValueOnce({ id: 'first-thing', version: '1.2.3' });
      const result = loader.findResourceJSON('firstResource');
      expect(result).toBeUndefined();
    });
  });

  describe('#clear', () => {
    it('should clear the package DB', () => {
      loader.clear();
      expect(packageDBMock.clear).toHaveBeenCalled();
    });
  });
});
