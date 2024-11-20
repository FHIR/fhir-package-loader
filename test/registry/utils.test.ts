import axios from 'axios';
import { resolveVersion } from '../../src/registry/utils';
import {
  IncorrectWildcardVersionFormatError,
  LatestVersionUnavailableError
} from '../../src/errors';

// Represents a minimal package manifest response w/ the necessary data for resolving versions.
// Note that a real response will have additional data in it.
const TERM_PKG_RESPONSE = {
  _id: 'hl7.terminology.r4',
  name: 'hl7.terminology.r4',
  'dist-tags': { latest: '1.2.3-test' },
  versions: {
    '1.2.3-test': {
      name: 'hl7.terminology.r4',
      version: '1.2.3-test'
    },
    '1.2.2': {
      name: 'hl7.terminology.r4',
      version: '1.2.2'
    },
    '1.1.2': {
      name: 'hl7.terminology.r4',
      version: '1.1.2'
    },
    '1.1.1': {
      name: 'hl7.terminology.r4',
      version: '1.1.1'
    }
  }
};

describe('#resolveVersion', () => {
  let axiosSpy: jest.SpyInstance;

  beforeAll(() => {
    axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
      if (uri === 'https://my.package.server.org/hl7.terminology.r4') {
        return { data: TERM_PKG_RESPONSE };
      } else if (uri === 'https://my.package.server.org/hl7.no.latest') {
        return { data: { name: 'hl7.no.latest' } };
      } else {
        throw new Error('Not found');
      }
    });
  });

  afterAll(() => {
    axiosSpy.mockRestore();
  });

  describe('#latest', () => {
    it('should resolve the latest version of a package on the packages server', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        'latest'
      );
      expect(latest).toEqual('1.2.3-test');
    });

    it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.bogus.package', 'latest');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest version of package hl7.bogus.package could not be determined from the package registry/
      );
    });

    it('should throw LatestVersionUnavailableError when the package exists, but has no latest tag', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.no.latest', 'latest');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest version of package hl7.no.latest could not be determined from the package registry/
      );
    });
  });

  describe('#wildcard patch', () => {
    it('should resolve the latest patch version for a package on the packages server', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        '1.1.x'
      );
      expect(latest).toEqual('1.1.2');
    });

    it('should resolve the latest patch version ignoring any versions with qualifiers after the version (-snapshot1)', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        '1.2.x'
      );
      expect(latest).toEqual('1.2.2');
    });

    it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.bogus.package', '1.0.x');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest patch version of package hl7.bogus.package could not be determined from the package registry/
      );
    });

    it('should throw LatestVersionUnavailableError when the package exists, but has no versions listed', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.no.versions', '1.0.x');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest patch version of package hl7.no.versions could not be determined from the package registry/
      );
    });

    it('should throw LatestVersionUnavailableError when the package exists, but has no matching versions for the patch version supplied', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.terminology.r4', '1.3.x');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest patch version of package hl7.terminology.r4 could not be determined from the package registry/
      );
    });

    it('should throw IncorrectWildcardVersionFormatError when a wildcard is used for minor version', async () => {
      const latest = resolveVersion('https://my.package.server.org', 'hl7.terminology.r4', '1.x');
      await expect(latest).rejects.toThrow(IncorrectWildcardVersionFormatError);
      await expect(latest).rejects.toThrow(
        /Incorrect version format for package hl7.terminology.r4: 1.x. Wildcard should only be used to specify patch versions./
      );
    });
  });

  describe('#current or specific version', () => {
    it('should resolve current to current since current does not use the latest algorithm', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        'current'
      );
      expect(latest).toEqual('current');
    });

    it('should resolve a specific version to itself', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        '1.1.1'
      );
      expect(latest).toEqual('1.1.1');
    });

    it('should resolve a specific version to itself even if that version is not listed (resolveVersion is not a version validator)', async () => {
      const latest = await resolveVersion(
        'https://my.package.server.org',
        'hl7.terminology.r4',
        '9.9.9'
      );
      expect(latest).toEqual('9.9.9');
    });
  });
});
