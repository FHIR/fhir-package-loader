import { Readable } from 'stream';
import axios from 'axios';
import {
  IncorrectWildcardVersionFormatError,
  LatestVersionUnavailableError
} from '../../src/errors';
import { NPMRegistryClient } from '../../src/registry/NPMRegistryClient';
import * as registryUtils from '../../src/registry/utils';
import { loggerSpy } from '../testhelpers';

// Represents a typical (but abbreviated) package manifest response from an NPM registry
const TERM_PKG_RESPONSE = {
  _id: 'hl7.terminology.r4',
  name: 'hl7.terminology.r4',
  modified: '2022-05-16T22:27:54.741Z',
  'dist-tags': { latest: '1.2.3-test' },
  versions: {
    '1.2.3-test': {
      name: 'hl7.terminology.r4',
      version: '1.2.3-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/1.2.3-test'
      }
    },
    '5.5.6-test': {
      name: 'hl7.terminology.r4',
      version: '5.5.6-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/5.5.6-test'
      }
    },
    'tarbal-wrong-type-test': {
      name: 'hl7.terminology.r4',
      version: 'tarbal-wrong-type-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: ['https://my.npm.server.org/hl7.terminology.r4/tarbal-wrong-type-test']
      }
    },
    '1.1.2': {
      name: 'hl7.terminology.r4',
      version: '1.1.2',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749822',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/1.1.2'
      }
    },
    '1.1.1': {
      name: 'hl7.terminology.r4',
      version: '1.1.1',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/1.1.1'
      }
    },
    '2.2.2': {
      name: 'hl7.terminology.r4',
      version: '2.2.2',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/2.2.2'
      }
    },
    '3.3.3': {
      name: 'hl7.terminology.r4',
      version: '3.3.3',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://my.npm.server.org/hl7.terminology.r4/3.3.3'
      }
    },
    '1.2.4': {
      name: 'hl7.terminology.r4',
      version: '1.2.4',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821'
      }
    }
  }
};

describe('NPMRegistryClient', () => {
  const client = new NPMRegistryClient('https://my.npm.server.org', { log: loggerSpy.log });
  let axiosSpy: jest.SpyInstance;

  describe('#constructor', () => {
    it('should remove trailing slash from endpoint', async () => {
      const clientWithSlash = new NPMRegistryClient('https://my.npm.server.org/', {
        log: loggerSpy.log
      });
      expect(clientWithSlash.endpoint).toBe('https://my.npm.server.org');
    });
  });

  describe('#resolveVersion', () => {
    let resolveVersionSpy: jest.SpyInstance;

    // There's no need to re-test all the functionality in utils.resolveVersion,
    // so just be sure the data is being passed correctly to the util function
    // and the response is being passed back as expected.
    beforeEach(() => {
      resolveVersionSpy = jest.spyOn(registryUtils, 'resolveVersion');
      loggerSpy.reset();
    });
    afterEach(() => {
      resolveVersionSpy.mockRestore();
    });

    it('should resolve the latest using the util function and the client endpoint', async () => {
      resolveVersionSpy.mockResolvedValue('2.4.6');
      const latest = await client.resolveVersion('my.favorite.package', 'latest');
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
      expect(resolveVersionSpy).toHaveBeenCalledWith(
        'https://my.npm.server.org',
        'my.favorite.package',
        'latest'
      );
      expect(latest).toEqual('2.4.6');
    });

    it('should bubble up LatestVersionUnavailableError when the util function throws it', async () => {
      resolveVersionSpy.mockRejectedValueOnce(
        new LatestVersionUnavailableError('my.unavailable.package')
      );
      const latest = client.resolveVersion('my.unavailable.package', 'latest');
      await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
      await expect(latest).rejects.toThrow(
        /Latest version of package my.unavailable.package could not be determined from the package registry/
      );
    });

    it('should bubble up IncorrectWildcardVersionFormatError when the util function throws it', async () => {
      resolveVersionSpy.mockRejectedValueOnce(
        new IncorrectWildcardVersionFormatError('my.other.package', '1.x')
      );
      const latest = client.resolveVersion('my.other.package', '1.x');
      await expect(latest).rejects.toThrow(IncorrectWildcardVersionFormatError);
      await expect(latest).rejects.toThrow(
        /Incorrect version format for package my.other.package: 1.x. Wildcard should only be used to specify patch versions./
      );
    });
  });

  describe('#download', () => {
    describe('#downloadInvalidVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://my.npm.server.org/hl7.terminology.r4') {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.1.2') {
            return {
              status: 404,
              data: Readable.from(['1.1.2-test-data'])
            };
          } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.1.1') {
            return {
              status: 200,
              data: null
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
        // Note: don't know of a scenario where this would occur but testing for completeness.
        const result = client.download('hl7.terminology.r4', '1.1.2');
        await expect(result).rejects.toThrow(Error);
        await expect(result).rejects.toThrow(
          'Failed to download hl7.terminology.r4#1.1.2 from https://my.npm.server.org/hl7.terminology.r4/1.1.2'
        );
      });

      it('should throw error when trying to get the version of a package on the packages server but returns no data', async () => {
        const result = client.download('hl7.terminology.r4', '1.1.1');
        await expect(result).rejects.toThrow(Error);
        await expect(result).rejects.toThrow(
          'Failed to download hl7.terminology.r4#1.1.1 from https://my.npm.server.org/hl7.terminology.r4/1.1.1'
        );
      });
    });

    describe('#downloadSpecificVersion', () => {
      describe('#CreateURL', () => {
        beforeEach(() => {
          loggerSpy.reset();
        });
        beforeAll(() => {
          axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
            if (uri === 'https://my.npm.server.org/hl7.terminology.r4') {
              return { data: TERM_PKG_RESPONSE };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.2.3-test') {
              return {
                status: 200,
                data: Readable.from(['1.2.3-test-data'])
              };
            } else if (
              uri ===
              'https://my.npm.server.org/hl7.terminology.r4.no.manifest/-/hl7.terminology.r4.no.manifest-1.2.4.tgz'
            ) {
              return {
                status: 200,
                data: Readable.from(['1.2.4-no-manifest-test-data'])
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4.empty.manifest.data') {
              return {
                status: 200,
                data: ''
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.no-dist') {
              return {
                status: 200,
                data: {
                  _id: 'hl7.terminology.r4',
                  name: 'hl7.terminology.r4',
                  'dist-tags': { latest: '1.2.3-test' }
                },
                versions: {
                  'no-dist-version': {}
                }
              };
            } else if (
              uri ===
              'https://my.npm.server.org/hl7.terminology.r4.empty.manifest.data/-/hl7.terminology.r4.empty.manifest.data-1.2.4.tgz'
            ) {
              return {
                status: 200,
                data: Readable.from(['1.2.4-empty-manifest-test-data'])
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4.no.tarball') {
              return {
                status: 200,
                data: {
                  _id: 'hl7.terminology.r4.no.tarball',
                  name: 'hl7.terminology.r4.no.tarball',
                  'dist-tags': { latest: '1.2.3-test' }
                },
                versions: {
                  'no-tarball-version': {
                    dist: {
                      tarball: null
                    }
                  }
                }
              };
            } else if (
              uri ===
              'https://my.npm.server.org/hl7.terminology.r4/-/hl7.terminology.r4-no-versions.tgz'
            ) {
              return {
                status: 200,
                data: Readable.from(['no-versions-test-data'])
              };
            } else if (
              uri ===
              'https://my.npm.server.org/hl7.terminology.r4.no.tarball/-/hl7.terminology.r4.no.tarball-no-tarball-version.tgz'
            ) {
              return {
                status: 200,
                data: Readable.from(['no-tarball-test-data'])
              };
            } else if (
              uri ===
              'https://my.npm.server.org/hl7.terminology.no-dist/-/hl7.terminology.no-dist-no-dist-version.tgz'
            ) {
              return {
                status: 200,
                data: Readable.from(['no-dist-test-data'])
              };
            } else {
              throw new Error('Not found');
            }
          });
        });

        afterAll(() => {
          axiosSpy.mockRestore();
        });

        it('should get the package by creating a tgz file path when it has no manifest tarball', async () => {
          const result = await client.download('hl7.terminology.r4.no.manifest', '1.2.4');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4.no.manifest#1.2.4 from https://my.npm.server.org/hl7.terminology.r4.no.manifest/-/hl7.terminology.r4.no.manifest-1.2.4.tgz'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('1.2.4-no-manifest-test-data');
        });

        it('should get the package using a created tgz file path when has manifest but data is empty', async () => {
          const result = await client.download('hl7.terminology.r4.empty.manifest.data', '1.2.4');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4.empty.manifest.data#1.2.4 from https://my.npm.server.org/hl7.terminology.r4.empty.manifest.data/-/hl7.terminology.r4.empty.manifest.data-1.2.4.tgz'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('1.2.4-empty-manifest-test-data');
        });

        it('should get the package using a created tgz file path when has manifest but not correct version', async () => {
          const result = await client.download('hl7.terminology.r4', 'no-versions');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4#no-versions from https://my.npm.server.org/hl7.terminology.r4/-/hl7.terminology.r4-no-versions.tgz'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('no-versions-test-data');
        });

        it('should get the package using a created tgz file path when has manifest but not dist', async () => {
          const result = await client.download('hl7.terminology.no-dist', 'no-dist-version');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.no-dist#no-dist-version from https://my.npm.server.org/hl7.terminology.no-dist/-/hl7.terminology.no-dist-no-dist-version.tgz'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('no-dist-test-data');
        });

        it('should get the package using a created tgz file path when has manifest but not tarball in it', async () => {
          const result = await client.download(
            'hl7.terminology.r4.no.tarball',
            'no-tarball-version'
          );
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4.no.tarball#no-tarball-version from https://my.npm.server.org/hl7.terminology.r4.no.tarball/-/hl7.terminology.r4.no.tarball-no-tarball-version.tgz'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('no-tarball-test-data');
        });

        it('should get the package using a created tgz file path when has manifest with tarball in it but tarball is incorrect type', async () => {
          const result = client.download('hl7.terminology.r4', 'tarbal-wrong-type-test');
          await expect(result).rejects.toThrow(Error);
          await expect(result).rejects.toThrow('Not found');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4#tarbal-wrong-type-test from https://my.npm.server.org/hl7.terminology.r4/tarbal-wrong-type-test'
          );
        });

        it('should throw error if no name given for download method', async () => {
          const result = client.download('', '5.5.5');
          await expect(result).rejects.toThrow(Error);
          await expect(result).rejects.toThrow('Not found');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download #5.5.5 from https://my.npm.server.org//-/-5.5.5.tgz'
          );
        });

        it('should throw error if no version given for download method', async () => {
          const result = client.download('hl7.terminology.r4', '');
          await expect(result).rejects.toThrow(Error);
          await expect(result).rejects.toThrow('Not found');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4# from https://my.npm.server.org/hl7.terminology.r4/-/hl7.terminology.r4-.tgz'
          );
        });

        it('should throw error if no endpoint given for download method', async () => {
          const emptyClient = new NPMRegistryClient('', { log: loggerSpy.log });
          const result = emptyClient.download('hl7.terminology.r4', '1.2.3-test');
          await expect(result).rejects.toThrow(Error);
          await expect(result).rejects.toThrow('Not found');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4#1.2.3-test from /hl7.terminology.r4/-/hl7.terminology.r4-1.2.3-test.tgz'
          );
        });
      });

      describe('#DownloadFromURL', () => {
        beforeEach(() => {
          loggerSpy.reset();
        });
        beforeAll(() => {
          axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
            if (uri === 'https://my.npm.server.org/hl7.terminology.r4') {
              return { data: TERM_PKG_RESPONSE };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.2.3-test') {
              return {
                status: 200,
                data: Readable.from(['1.2.3-test-data'])
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/2.2.2') {
              return {
                status: 200,
                data: ''
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/3.3.3') {
              return {
                status: 200
              };
            } else if (
              uri === 'https://my.npm.server.org/hl7.terminology.r4/-/hl7.terminology.r4-5.5.5.tgz'
            ) {
              return {
                status: 'wrong-type',
                data: Readable.from(['1.2.4-no-manifest-test-data'])
              };
            } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/5.5.6-test') {
              return {
                data: Readable.from(['5.5.6-test-data'])
              };
            } else {
              throw new Error('Not found');
            }
          });
        });

        afterAll(() => {
          axiosSpy.mockRestore();
        });

        it('should get the data of the package when 200 response', async () => {
          const result = await client.download('hl7.terminology.r4', '1.2.3-test');
          expect(loggerSpy.getLastMessage('info')).toBe(
            'Attempting to download hl7.terminology.r4#1.2.3-test from https://my.npm.server.org/hl7.terminology.r4/1.2.3-test'
          );
          expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
          expect(result).toBeInstanceOf(Readable);
          expect(result.read()).toBe('1.2.3-test-data');
        });

        it('should throw error when trying to get the version of a package on the server but returns 200 status and data of incorrect type', async () => {
          const result = client.download('hl7.terminology.r4', '2.2.2');
          await expect(result).rejects.toThrow(
            'Failed to download hl7.terminology.r4#2.2.2 from https://my.npm.server.org/hl7.terminology.r4/2.2.2'
          );
        });

        it('should throw error when trying to get the version of a package on the server but returns 200 status and no data field', async () => {
          const result = client.download('hl7.terminology.r4', '3.3.3');
          await expect(result).rejects.toThrow(
            'Failed to download hl7.terminology.r4#3.3.3 from https://my.npm.server.org/hl7.terminology.r4/3.3.3'
          );
        });

        it('should throw error when trying to get the version of a package on the server but returns status with incorrect type', async () => {
          const result = client.download('hl7.terminology.r4', '5.5.5');
          await expect(result).rejects.toThrow(
            'Failed to download hl7.terminology.r4#5.5.5 from https://my.npm.server.org/hl7.terminology.r4/-/hl7.terminology.r4-5.5.5.tgz'
          );
        });

        it('should throw error when trying to get the version of a package on the server but returns no status', async () => {
          const result = client.download('hl7.terminology.r4', '5.5.6-test');
          await expect(result).rejects.toThrow(
            'Failed to download hl7.terminology.r4#5.5.6-test from https://my.npm.server.org/hl7.terminology.r4/5.5.6-test'
          );
        });
      });
    });

    describe('#downloadLatestVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://my.npm.server.org/hl7.terminology.r4') {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.2.3-test') {
            return {
              status: 200,
              data: Readable.from(['1.2.3-test-data'])
            };
          } else if (uri === 'https://my.npm.server.org/hl7.no.latest') {
            return {
              data: {
                name: 'hl7.no.latest',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
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
          'Attempting to download hl7.terminology.r4#1.2.3-test from https://my.npm.server.org/hl7.terminology.r4/1.2.3-test'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.2.3-test-data');
      });

      it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
        const latest = client.download('hl7.bogus.package', 'latest');
        await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        await expect(latest).rejects.toThrow(
          /Latest version of package hl7.bogus.package could not be determined from the package registry/
        );
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no latest tag', async () => {
        const latest = client.download('hl7.no.latest', 'latest');
        await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        await expect(latest).rejects.toThrow(
          /Latest version of package hl7.no.latest could not be determined from the package registry/
        );
      });
    });

    describe('#downloadLatestPatchVersion', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://my.npm.server.org/hl7.terminology.r4') {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://my.npm.server.org/hl7.no.versions') {
            return {
              data: {
                name: 'hl7.no.versions',
                'dist-tags': {
                  v1: '1.5.1',
                  v2: '2.1.1'
                }
              }
            };
          } else if (uri === 'https://my.npm.server.org/hl7.no.good.patches') {
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
          } else if (uri === 'https://my.npm.server.org/hl7.patches.with.snapshots') {
            return {
              data: {
                name: 'hl7.patches.with.snapshots',
                versions: {
                  '2.0.0': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.0',
                    dist: {
                      tarball: 'https://my.npm.server.org/hl7.terminology.r4/2.0.0'
                    }
                  },
                  '2.0.1': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.1',
                    dist: {
                      tarball: 'https://my.npm.server.org/hl7.terminology.r4/2.0.1'
                    }
                  },
                  '2.0.2-snapshot1': {
                    name: 'hl7.patches.with.snapshots',
                    version: '2.0.2-snapshot1',
                    dist: {
                      tarball: 'https://my.npm.server.org/hl7.terminology.r4/2.0.2-snapshot1'
                    }
                  }
                }
              }
            };
          } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/1.1.2') {
            return {
              status: 200,
              data: Readable.from(['1.1.2-test-data'])
            };
          } else if (uri === 'https://my.npm.server.org/hl7.terminology.r4/2.0.1') {
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
          'Attempting to download hl7.terminology.r4#1.1.2 from https://my.npm.server.org/hl7.terminology.r4/1.1.2'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.1.2-test-data');
      });

      it('should get the latest patch version ignoring any versions with qualifiers after the version (-snapshot1)', async () => {
        const latest = await client.download('hl7.patches.with.snapshots', '2.0.x');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.patches.with.snapshots#2.0.1 from https://my.npm.server.org/hl7.terminology.r4/2.0.1'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('2.0.1-test-data');
      });

      it('should throw LatestVersionUnavailableError when the request to get package information fails', async () => {
        const latest = client.download('hl7.bogus.package', '1.0.x');
        await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        await expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.bogus.package could not be determined from the package registry/
        );
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no versions listed', async () => {
        const latest = client.download('hl7.no.versions', '1.0.x');
        await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        await expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.no.versions could not be determined from the package registry/
        );
      });

      it('should throw LatestVersionUnavailableError when the package exists, but has no matching versions for the patch version supplied', async () => {
        const latest = client.download('hl7.no.good.patches', '1.0.x');
        await expect(latest).rejects.toThrow(LatestVersionUnavailableError);
        await expect(latest).rejects.toThrow(
          /Latest patch version of package hl7.no.good.patches could not be determined from the package registry/
        );
      });

      it('should throw IncorrectWildcardVersionFormatError when a wildcard is used for minor version', async () => {
        const latest = client.download('hl7.terminology.r4', '1.x');
        await expect(latest).rejects.toThrow(IncorrectWildcardVersionFormatError);
        await expect(latest).rejects.toThrow(
          /Incorrect version format for package hl7.terminology.r4: 1.x. Wildcard should only be used to specify patch versions./
        );
      });
    });
  });
});
