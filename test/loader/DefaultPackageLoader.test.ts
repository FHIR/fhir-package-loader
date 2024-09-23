import { loggerSpy } from '../testhelpers';
import { mock } from 'jest-mock-extended';
import { BasePackageLoader, BasePackageLoaderOptions } from '../../src/loader/BasePackageLoader';
import { LoadStatus } from '../../src/loader/PackageLoader';
import { PackageDB } from '../../src/db';
import { PackageCache } from '../../src/cache';
import { RegistryClient } from '../../src/registry';
import { CurrentBuildClient } from '../../src/current';

describe('DefaultPackageLoader', () => {

    async function makeMyDefaultPackageLoader(options: BasePackageLoaderOptions) : Promise<BasePackageLoader> {
        const packageDBMock = mock<PackageDB>();
        const packageCacheMock = mock<PackageCache>();
        const registryClientMock = mock<RegistryClient>();
        const currentBuildClientMock = mock<CurrentBuildClient>();
        const loader = new BasePackageLoader(
            packageDBMock,
            packageCacheMock,
            registryClientMock,
            currentBuildClientMock,
            { log: options.log }
            );
        return loader;
    }

    it('should create a package loader with mock default package loader' , async () => {
        const loader = await makeMyDefaultPackageLoader({log: loggerSpy.log});
        loader.getPackageLoadStatus = jest.fn().mockReturnValueOnce(LoadStatus.LOADED);

        const result = await loader.loadPackage('some.ig', '1.2.3');
        expect(result).toBe(LoadStatus.LOADED);
        expect(loader.getPackageLoadStatus).toHaveBeenCalledWith('some.ig', '1.2.3');
    });
});