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

describe('BasePackageLoader', () => {
  let loader: BasePackageLoader;
  const packageDBMock = mock<PackageDB>();
  const packageCacheMock = mock<PackageCache>();
  const registryClientMock = mock<RegistryClient>();
  const currentBuildClientMock = mock<CurrentBuildClient>();

  beforeEach(() => {
    loggerSpy.reset();
    mockReset(packageDBMock);
    mockReset(packageCacheMock);
    mockReset(registryClientMock);
    mockReset(currentBuildClientMock);
    loader = new BasePackageLoader(
      packageDBMock,
      packageCacheMock,
      registryClientMock,
      currentBuildClientMock,
      { log: loggerSpy.log }
    );
  });

  describe('#loadPackage', () => {
    it('should return LOADED when the package is already loaded', async () => {
      // set up the needed mocks and spys
      loader.getPackageLoadStatus = jest.fn().mockReturnValue(LoadStatus.LOADED);

      // call loadPackage
      const result = await loader.loadPackage('some.ig', '1.2.3');

      // check the expected result
      expect(result).toBe(LoadStatus.LOADED);

      // check the mocked function was called as expected
      expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', '1.2.3');

      // check that it didn't try to save it to the db again
      expect(packageDBMock.savePackageInfo).not.toHaveBeenCalled();
    });

    it('should load a versioned package from the registry when it is not in the cache', async () => {
      // set up the needed mocks and spys
      // note -- this is the long way, which also mocks out all the calls happening inside the
      // private this.loadPackageFromCache function. See other approach in next test.
      // also note -- you could put a lot of this setup in a separate function so you don't
      // need to call it in every test case (for the stuff in common between test cases).
      const name = 'some.ig';
      const version = '1.2.3';
      const packagePath = path.resolve('path', 'to', `${name}-${version}`);
      const packageJSONPath = path.resolve(packagePath, 'package.json');
      const tarball = Readable.from([`${name}#${version}-data`]);
      loader.getPackageLoadStatus = jest.fn().mockReturnValue(LoadStatus.NOT_LOADED);
      packageCacheMock.isPackageInCache
        .calledWith(name, version)
        .mockReturnValueOnce(false) // on first call it's not in the cache
        .mockReturnValueOnce(true); // on second call it is in the cache
      registryClientMock.download.calledWith(name, version).mockResolvedValue(tarball);
      packageCacheMock.cachePackageTarball
        .calledWith(name, version, tarball)
        .mockResolvedValue(packagePath);
      packageCacheMock.getPackagePath.calledWith(name, version).mockReturnValue(packagePath);
      packageCacheMock.getPackageJSONPath
        .calledWith(name, version)
        .mockReturnValue(packageJSONPath);
      packageCacheMock.getPotentialResourcePaths.calledWith(name, version).mockReturnValue([]);
      packageDBMock.getPackageStats
        .calledWith(name, version)
        .mockReturnValue({ name, version, resourceCount: 5 });

      // call loadPackage
      const result = await loader.loadPackage('some.ig', '1.2.3');

      // check the expected result and log
      expect(result).toBe(LoadStatus.LOADED);
      expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.3 with 5 resources');

      // check the package info was saved as expected
      expect(packageDBMock.savePackageInfo).toHaveBeenCalledWith({
        name: 'some.ig',
        version: '1.2.3',
        packagePath,
        packageJSONPath
      });
    });
  });

  it('approach 2: should load a versioned package from the registry when it is not in the cache', async () => {
    // set up the needed mocks and spys
    // note -- this simplifies things a bit by mocking out the loader's private functions,
    // but you probably will additionally want tests that do actually allow those functions
    // to be fully executed (like demonstrated above). But you don't need to go through that
    // whole rigamarole for every test; hence this approach.
    const name = 'some.ig';
    const version = '1.2.3';
    const tarball = Readable.from([`${name}$${version}-data`]);
    loader.getPackageLoadStatus = jest.fn().mockReturnValue(LoadStatus.NOT_LOADED);
    packageCacheMock.isPackageInCache.calledWith(name, version).mockReturnValueOnce(false); // on first call it's not in the cache
    registryClientMock.download.calledWith(name, version).mockResolvedValue(tarball);
    // just mock out the private loadPackageFromCache function, saving us a lot of hassle
    const loadPackageFromCacheSpy = jest
      .spyOn(BasePackageLoader.prototype as any, 'loadPackageFromCache')
      .mockReturnValue({ name, version, resourceCount: 5 });

    // call loadPackage
    const result = await loader.loadPackage('some.ig', '1.2.3');

    // check the expected result and log
    expect(result).toBe(LoadStatus.LOADED);
    expect(loggerSpy.getLastMessage('info')).toBe('Loaded some.ig#1.2.3 with 5 resources');

    // check the private loadPackageFromCache was called as expected
    expect(loadPackageFromCacheSpy).toHaveBeenCalledWith('some.ig', '1.2.3');
  });
});
