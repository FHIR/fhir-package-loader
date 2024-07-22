import { NPMRegistryClient } from '../../src/registry/NPMRegistryClient';
import { loggerSpy } from '../testhelpers';
import axios from 'axios';
import { Readable } from 'stream';

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
    '5.5.6-test': {
      name: 'hl7.terminology.r4',
      version: '5.5.6-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/5.5.6-test'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/5.5.6-test'
    },
    'tarbal-wrong-type-test': {
      name: 'hl7.terminology.r4',
      version: 'tarbal-wrong-type-test',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe74983',
        tarball: ['https://packages.simplifier.net/hl7.terminology.r4/tarbal-wrong-type-test']
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/tarbal-wrong-type-test'
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
    },
    '2.2.2': {
      name: 'hl7.terminology.r4',
      version: '2.2.2',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/2.2.2'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/2.2.2'
    },
    '3.3.3': {
      name: 'hl7.terminology.r4',
      version: '3.3.3',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821',
        tarball: 'https://packages.simplifier.net/hl7.terminology.r4/3.3.3'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/3.3.3'
    },
    '1.1.4': {
      name: 'hl7.terminology.r4',
      version: '1.1.4',
      description: 'None.',
      dist: {
        shasum: '1a1467bce19aace45771e0a51ef2ad9c3fe749821'
      },
      fhirVersion: 'R4',
      url: 'https://packages.simplifier.net/hl7.terminology.r4/1.1.4'
    }
  }
};

describe('NPMRegistryClient', () => {
  const client = new NPMRegistryClient('https://packages.fhir.org', { log: loggerSpy.log });
  let axiosSpy: jest.SpyInstance;

  describe('#constructor', () => {
    it('should remove trailing slash from endpoint', async () => {
      const clientWithSlash = new NPMRegistryClient('https://packages.fhir.org/', {
        log: loggerSpy.log
      });
      expect(clientWithSlash.endpoint).toBe('https://packages.fhir.org');
    });
  });

  describe('#download', () => {
    describe('#CreateURL', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://packages.fhir.org/hl7.terminology.r4') {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test') {
            return {
              status: 200,
              data: Readable.from(['1.2.3-test-data'])
            };
          } else if (
            uri === 'https://packages.fhir.org/hl7.terminology.r4/-/hl7.terminology.r4-1.1.5.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['1.1.5-test-data'])
            };
          } else if (
            uri ===
            'https://packages.fhir.org/hl7.terminology.r4.no.manifest/-/hl7.terminology.r4.no.manifest-1.1.4.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['1.1.4-no-manifest-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4.empty.manifest.data') {
            return {
              status: 200,
              data: ''
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.no-dist') {
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
            'https://packages.fhir.org/hl7.terminology.r4.empty.manifest.data/-/hl7.terminology.r4.empty.manifest.data-1.1.4.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['1.1.4-empty-manifest-test-data'])
            };
          } else if (uri === 'https://packages.fhir.org/hl7.terminology.r4.no.tarball') {
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
            'https://packages.fhir.org/hl7.terminology.r4/-/hl7.terminology.r4-no-versions.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['no-versions-test-data'])
            };
          } else if (
            uri ===
            'https://packages.fhir.org/hl7.terminology.r4.no.tarball/-/hl7.terminology.r4.no.tarball-no-tarball-version.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['no-tarball-test-data'])
            };
          } else if (
            uri ===
            'https://packages.fhir.org/hl7.terminology.no-dist/-/hl7.terminology.no-dist-no-dist-version.tgz'
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

      it('should get the package using tarball when has manifest tarball url', async () => {
        const latest = await client.download('hl7.terminology.r4', '1.2.3-test');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#1.2.3-test from https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.2.3-test-data');
      });

      it('should get the package by creating a tgz file path when it has no manifest tarball', async () => {
        const latest = await client.download('hl7.terminology.r4.no.manifest', '1.1.4');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4.no.manifest#1.1.4 from https://packages.fhir.org/hl7.terminology.r4.no.manifest/-/hl7.terminology.r4.no.manifest-1.1.4.tgz'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.1.4-no-manifest-test-data');
      });

      it('should get the package using a created tgz file path when has manifest but data is empty', async () => {
        const latest = await client.download('hl7.terminology.r4.empty.manifest.data', '1.1.4');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4.empty.manifest.data#1.1.4 from https://packages.fhir.org/hl7.terminology.r4.empty.manifest.data/-/hl7.terminology.r4.empty.manifest.data-1.1.4.tgz'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.1.4-empty-manifest-test-data');
      });

      it('should get the package using a created tgz file path when has manifest but not correct version', async () => {
        const latest = await client.download('hl7.terminology.r4', 'no-versions');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#no-versions from https://packages.fhir.org/hl7.terminology.r4/-/hl7.terminology.r4-no-versions.tgz'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('no-versions-test-data');
      });

      it('should get the package using a created tgz file path when has manifest but not dist', async () => {
        const latest = await client.download('hl7.terminology.no-dist', 'no-dist-version');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.no-dist#no-dist-version from https://packages.fhir.org/hl7.terminology.no-dist/-/hl7.terminology.no-dist-no-dist-version.tgz'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('no-dist-test-data');
      });

      it('should get the package using a created tgz file path when has manifest but not tarball in it', async () => {
        const latest = await client.download('hl7.terminology.r4.no.tarball', 'no-tarball-version');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4.no.tarball#no-tarball-version from https://packages.fhir.org/hl7.terminology.r4.no.tarball/-/hl7.terminology.r4.no.tarball-no-tarball-version.tgz'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('no-tarball-test-data');
      });

      it('should get the package using a created tgz file path when has manifest with tarball in it but tarball is incorrect type', async () => {
        const latest = client.download('hl7.terminology.r4', 'tarbal-wrong-type-test');
        // no message logged
        await expect(latest).rejects.toThrow(Error);
        await expect(latest).rejects.toThrow('Not found');
      });

      it('should throw error if no name given for download method', async () => {
        const latest = client.download('', '5.5.5');
        // no message logged
        await expect(latest).rejects.toThrow(Error);
        await expect(latest).rejects.toThrow('Not found');
      });

      it('should throw error if no name given for download method', async () => {
        const latest = client.download('hl7.terminology.r4', '');
        // no message logged
        await expect(latest).rejects.toThrow(Error);
        await expect(latest).rejects.toThrow('Not found');
      });

      it('should throw error if no endpoint given for download method', async () => {
        const emptyClient = new NPMRegistryClient('', { log: loggerSpy.log });
        const latest = emptyClient.download('hl7.terminology.r4', '1.2.3-test');
        // no message logged
        await expect(latest).rejects.toThrow(Error);
        await expect(latest).rejects.toThrow('Not found');
      });
    });

    describe('#DownloadFromURL', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });
      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://packages.fhir.org/hl7.terminology.r4') {
            return { data: TERM_PKG_RESPONSE };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test') {
            return {
              status: 200,
              data: Readable.from(['1.2.3-test-data'])
            };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/1.1.2') {
            return {
              status: 404,
              data: Readable.from(['1.1.2-test-data'])
            };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/1.1.1') {
            return {
              status: 200,
              data: Readable.from([])
            };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/2.2.2') {
            return {
              status: 200,
              data: ''
            };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/3.3.3') {
            return {
              status: 200
            };
          } else if (
            uri === 'https://packages.fhir.org/hl7.terminology.r4/-/hl7.terminology.r4-5.5.5.tgz'
          ) {
            return {
              status: 'wrong-type',
              data: Readable.from(['1.1.4-no-manifest-test-data'])
            };
          } else if (uri === 'https://packages.simplifier.net/hl7.terminology.r4/5.5.6-test') {
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
        const latest = await client.download('hl7.terminology.r4', '1.2.3-test');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#1.2.3-test from https://packages.simplifier.net/hl7.terminology.r4/1.2.3-test'
        );
        expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('1.2.3-test-data');
      });

      it('should throw error when trying to get the version of a package on the packages server but status is not 200', async () => {
        const latest = client.download('hl7.terminology.r4', '1.1.2');
        await expect(latest).rejects.toThrow(Error);
        await expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#1.1.2 from https://packages.simplifier.net/hl7.terminology.r4/1.1.2'
        );
      });

      it('should receive null when trying to get the version of a package on the server but returns empty readable', async () => {
        const latest = await client.download('hl7.terminology.r4', '1.1.1');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.terminology.r4#1.1.1 from https://packages.simplifier.net/hl7.terminology.r4/1.1.1'
        );
        expect(latest).toBeDefined();
        expect(latest.read()).toBe(null);
      });

      it('should throw error when trying to get the version of a package on the server but returns 200 status and data of incorrect type', async () => {
        const latest = client.download('hl7.terminology.r4', '2.2.2');
        await expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#2.2.2 from https://packages.simplifier.net/hl7.terminology.r4/2.2.2'
        );
      });

      it('should throw error when trying to get the version of a package on the server but returns 200 status and no data field', async () => {
        const latest = client.download('hl7.terminology.r4', '3.3.3');
        await expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#3.3.3 from https://packages.simplifier.net/hl7.terminology.r4/3.3.3'
        );
      });

      it('should throw error when trying to get the version of a package on the server but returns status with incorrect type', async () => {
        const latest = client.download('hl7.terminology.r4', '5.5.5');
        await expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#5.5.5 from https://packages.fhir.org/hl7.terminology.r4/-/hl7.terminology.r4-5.5.5.tgz'
        );
      });

      it('should throw error when trying to get the version of a package on the server but returns no status', async () => {
        const latest = client.download('hl7.terminology.r4', '5.5.6-test');
        await expect(latest).rejects.toThrow(
          'Failed to download hl7.terminology.r4#5.5.6-test from https://packages.simplifier.net/hl7.terminology.r4/5.5.6-test'
        );
      });
    });
  });
});
