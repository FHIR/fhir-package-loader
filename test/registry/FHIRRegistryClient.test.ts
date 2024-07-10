import { FHIRRegistryClient } from '../../src/registry/FHIRRegistryClient';
import { loggerSpy } from '../testhelpers';
import axios from 'axios';
import { Readable } from 'stream';
import {
  IncorrectWildcardVersionFormatError,
  LatestVersionUnavailableError
} from '../../src/errors';

// Represents a typical response from packages.fhir.org
const TERM_PKG_RESPONSE = {
  _id: 'hl7.terminology.r4',
  name: 'hl7.terminology.r4',
  'dist-tags': { latest: '1.2.3-test' },
  versions: {
    '1.2.3-test': {
      name: 'hl7.terminology.r4',
      version: '1.2.3-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test'
    },
    '1.1.0': {
      name: 'hl7.terminology.r4',
      version: '1.1.0',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749820',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.0'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.0'
    },
    '1.1.2': {
      name: 'hl7.terminology.r4',
      version: '1.1.2',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749822',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.2'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.2'
    },
    '1.1.1': {
      name: 'hl7.terminology.r4',
      version: '1.1.1',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.1'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.1'
    }
  }
};

describe('FHIRRegistryClient', () => {
  const client = new FHIRRegistryClient('https://packages.fhir.org', { log: loggerSpy.log });
  let axiosSpy: jest.SpyInstance;

  describe('#constructor', () => {
    it('should remove trailing slash when have endpoint that contains one at the end', async () => {
      const clientWithSlash = new FHIRRegistryClient('https://packages.fhir.org/', {
        log: loggerSpy.log
      });
      expect(clientWithSlash.endpoint).toBe('https://packages.fhir.org');
    });
  });

  describe('#download', () => {
    describe('#downloadInvalidVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (
            uri === 'https://custom-registry.example.org/hl7.terminology.r4' ||
            uri === 'https://packages.fhir.org/hl7.terminology.r4'
          ) {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.fhir.org/hl7.no.latest') {
            return {
              data: {
                name: 'hl7.no.latest',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/3.3.3') {
            return {
              status: 200,
              data: Readable.from(['3.3.3-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/7.7.7') {
            return {
              status: 400,
              data: Readable.from(['3.3.3-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/7.7.9') {
            return {
              status: 400,
              data: ['']
            };
          } else {
            throw new Error('Not found');
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should throw error when trying to get the version of a package on the packages server but status is not 200', async () => {
        const latest = client.download('hl7.terminology.r4', '7.7.7');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#7.7.7 from https://packages.fhir.org/hl7.terminology.r4/7.7.7'
        );
        expect(latest).rejects.toThrow(Error);
        expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#7.7.7 from https://packages.fhir.org/hl7.terminology.r4/7.7.7'
        );
      });

      it('should throw error when trying to get the version of a package on the packages server but returns no data', async () => {
        const latest = client.download('hl7.terminology.r4', '7.7.9');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#7.7.9 from https://packages.fhir.org/hl7.terminology.r4/7.7.9'
        );
        expect(latest).rejects.toThrow(Error);
        expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#7.7.9 from https://packages.fhir.org/hl7.terminology.r4/7.7.9'
        );
      });
    });

    describe('#downloadSpecificVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (
            uri === 'https://custom-registry.example.org/hl7.terminology.r4' ||
            uri === 'https://packages.fhir.org/hl7.terminology.r4'
          ) {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.fhir.org/hl7.no.latest') {
            return {
              data: {
                name: 'hl7.no.latest',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/3.3.3') {
            return {
              status: 200,
              data: Readable.from(['3.3.3-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/8.8.8') {
            return {
              status: 400,
              data: Readable.from(['8.8.8-test-data'])
            };
          } else {
            throw new Error('Not found');
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should get the specific version of a package on the packages server', async () => {
        const latest = await client.download('hl7.terminology.r4', '3.3.3');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#3.3.3 from https://packages.fhir.org/hl7.terminology.r4/3.3.3'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeDefined();
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('3.3.3-test-data');
      });
    });

    describe('#downloadLatestVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (
            uri === 'https://custom-registry.example.org/hl7.terminology.r4' ||
            uri === 'https://packages.fhir.org/hl7.terminology.r4'
          ) {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.fhir.org/hl7.no.latest') {
            return {
              data: {
                name: 'hl7.no.latest',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/1.2.3-test') {
            return {
              status: 200,
              data: Readable.from(['1.2.3-test-data'])
            };
          } else {
            throw new Error('Not found');
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should get the latest version of a package on the packages server', async () => {
        const latest = await client.download('hl7.terminology.r4', 'latest');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#1.2.3-test from https://packages.fhir.org/hl7.terminology.r4/1.2.3-test'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeDefined();
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.2.3-test-data');
      });

      it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
        const latest = client.download('hl7.bogus.package', 'latest');
        expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        expect(latest).rejects.toThrow(
          /Latest version of package hl7.bogus.package could not be determined from the FHIR package registry/
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no latest tag', async () => {
        const latest = client.download('hl7.no.latest', 'latest');
        expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        expect(latest).rejects.toThrow(
          /Latest version of package hl7.no.latest could not be determined from the FHIR package registry/
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });
    });

    describe('#downloadLatestPatchVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (
            uri === 'https://custom-registry.example.org/hl7.terminology.r4' ||
            uri === 'https://packages.fhir.org/hl7.terminology.r4'
          ) {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.fhir.org/hl7.no.versions') {
            return {
              data: {
                name: 'hl7.no.versions',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.no.good.patches') {
            return {
              data: {
                name: 'hl7.no.good.patches',
                versions: {
                  '2.0.0': {
                    name: 'hl7.no.good.patches',
                    version: '2.0.0'
                  },
                  '2.0.1': {
                    name: 'hl7.no.good.patches',
                    version: '2.0.1'
                  }
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.patches.with.snapshots') {
            return {
              data: {
                name: 'hl7.patches.with.snapshots',
                versions: {
                  '2.0.0': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.0'
                  },
                  '2.0.1': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.1'
                  },
                  '2.0.2-snapshot1': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.2-snapshot1'
                  }
                }
              }
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4/1.1.2') {
            return {
              status: 200,
              data: Readable.from(['1.1.2-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.patches.with.snapshots/2.0.1') {
            return {
              status: 200,
              data: Readable.from(['2.0.1-test-data'])
            };
          } else {
            throw new Error('Not found');
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should get the latest patch version for a package on the packages server', async () => {
        const latest = await client.download('hl7.terminology.r4', '1.1.x');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#1.1.2 from https://packages.fhir.org/hl7.terminology.r4/1.1.2'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeDefined();
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.1.2-test-data');
      });

      it('should get the latest patch version ignoring any versions with qualifiers after the version (-snapshot1)', async () => {
        const latest = await client.download('hl7.patches.with.snapshots', '2.0.x');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.patches.with.snapshots#2.0.1 from https://packages.fhir.org/hl7.patches.with.snapshots/2.0.1'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeDefined();
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('2.0.1-test-data');
      });

      it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
        const latest = client.download('hl7.bogus.package', '1.0.x');
        expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.bogus.package could not be determined from the FHIR package registry/
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no versions listed', async () => {
        const latest = client.download('hl7.no.versions', '1.0.x');
        expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.no.versions could not be determined from the FHIR package registry/
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no matching versions for the patch version supplied', async () => {
        const latest = client.download('hl7.no.good.patches', '1.0.x');
        expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.no.good.patches could not be determined from the FHIR package registry/
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });

      it('should throw IncorrectWildcardVersionFormatError when a wildcard is used for minor version', async () => {
        const latest = client.download('hl7.terminology.r4', '1.x');
        expect(latest).rejects.toThrow(IncorrectWildcardVersionFormatError);
        expect(latest).rejects.toThrow(
          /Incorrect version format for package hl7.terminology.r4: 1.x. Wildcard should only be used to specify patch versions./
        );
        expect(loggerSpy.getLastMessage('info')).toBeUndefined();
      });
    });
  });
});
