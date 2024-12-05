import { jest } from '@jest/globals';

import { DiskBasedPackageCache } from '../../src/cache/DiskBasedPackageCache';
import { defaultPackageLoader } from '../../src/loader';
import { BasePackageLoader } from '../../src/loader/BasePackageLoader';
import { loggerSpy } from '../testhelpers';

jest.mock('sql.js', () => {
  return () => {
    class Database {}
    return {
      Database
    };
  };
});
jest.mock('../../src/db/SQLJSPackageDB');
jest.mock('../../src/cache/DiskBasedPackageCache', () => {
  return {
    DiskBasedPackageCache: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});
jest.mock('../../src/registry/DefaultRegistryClient');
jest.mock('../../src/current/BuildDotFhirDotOrgClient');

describe('DefaultPackageLoader', () => {
  beforeEach(() => {
    (DiskBasedPackageCache as jest.Mock).mockClear();
  });

  it('should create an instance of BasePackageLoader with no local resource folders', async () => {
    const loader = await defaultPackageLoader({ log: loggerSpy.log });
    expect(loader).toBeInstanceOf(BasePackageLoader);
    expect(DiskBasedPackageCache as jest.Mock).toHaveBeenCalledTimes(1);
    expect(DiskBasedPackageCache as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
      log: loggerSpy.log
    });
  });
});
