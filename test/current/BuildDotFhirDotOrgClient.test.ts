import { Readable } from 'stream';
import axios from 'axios';
import { BuildDotFhirDotOrgClient } from '../../src/current/BuildDotFhirDotOrgClient';
import { loggerSpy } from '../testhelpers';

describe('BuildDotFhirDotOrgClient', () => {
  const client = new BuildDotFhirDotOrgClient({ log: loggerSpy.log });
  let axiosSpy: jest.SpyInstance;

  describe('#downloadCurrentBuild', () => {
    describe('currentBuildNoBranch', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });

      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://build.fhir.org/ig/qas.json') {
            return {
              data: [
                {
                  url: 'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core.r4-4.0.0',
                  name: 'USCoreR4',
                  'package-id': 'hl7.fhir.us.core.r4',
                  'ig-ver': '4.0.0',
                  date: 'Sat, 18 May, 2019 01:48:14 +0000',
                  errs: 538,
                  warnings: 34,
                  hints: 202,
                  version: '4.0.0',
                  tool: '4.1.0 (3)',
                  repo: 'HL7Imposter/US-Core-R4/branches/main/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core.r4-4.0.0',
                  name: 'USCoreR4',
                  'package-id': 'hl7.fhir.us.core.r4',
                  'ig-ver': '4.0.0',
                  date: 'Mon, 20 Jan, 2020 19:36:43 +0000',
                  errs: 1496,
                  warnings: 36,
                  hints: 228,
                  version: '4.0.0',
                  tool: '4.1.0 (3)',
                  repo: 'HL7/US-Core-R4/branches/main/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/us/core/ImplementationGuide/simple.hl7.fhir.us.core.r4-4.0.1',
                  name: 'simple-uscorer4',
                  'package-id': 'simple.hl7.fhir.us.core.r4',
                  'ig-ver': '4.0.1',
                  repo: 'HL7/simple-US-Core-R4/branches/main/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/sushi-test-no-download/ImplementationGuide/sushi-test-no-download-0.1.0',
                  name: 'sushi-test-no-download',
                  'package-id': 'sushi-test-no-download',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/sushi-test-no-download/branches/master/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/sushi-test/ImplementationGuide/sushi-test-0.1.0',
                  name: 'sushi-test',
                  'package-id': 'sushi-test',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/sushi-test/branches/master/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/sushi-no-main/ImplementationGuide/sushi-no-main-0.1.0',
                  name: 'sushi-no-main',
                  'package-id': 'sushi-no-main',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/sushi-no-main/branches/feature/qa.json'
                }
              ]
            };
          } else if (
            uri === 'https://build.fhir.org/ig/HL7/simple-US-Core-R4/branches/main/package.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['simple zipfile'])
            };
          } else if (
            uri === 'https://build.fhir.org/ig/sushi/sushi-test/branches/master/package.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['sushi-test master zip file'])
            };
          } else if (uri === 'https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.tgz') {
            return {
              status: 200,
              data: Readable.from(['current multiple version zip file'])
            };
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should download the most current package from the main branch when no branch given', async () => {
        const latest = await client.downloadCurrentBuild('simple.hl7.fhir.us.core.r4');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download simple.hl7.fhir.us.core.r4#current from https://build.fhir.org/ig/HL7/simple-US-Core-R4/branches/main/package.tgz'
        );
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('simple zipfile');
      });

      it('should try to download the current package from master branch if not specified', async () => {
        const latest = await client.downloadCurrentBuild('sushi-test');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download sushi-test#current from https://build.fhir.org/ig/sushi/sushi-test/branches/master/package.tgz'
        );
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('sushi-test master zip file');
      });

      it('should download the most current package when a current package version has multiple versions', async () => {
        const latest = await client.downloadCurrentBuild('hl7.fhir.us.core.r4');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download hl7.fhir.us.core.r4#current from https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.tgz'
        );
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('current multiple version zip file');
      });

      it('should throw error when invalid package name (unknown name) given', async () => {
        const latest = client.downloadCurrentBuild('invalid.pkg.name');
        await expect(latest).rejects.toThrow(
          /The package invalid.pkg.name#current is not available/
        );
      });

      it('should throw error when invalid package name (empty string) given', async () => {
        const latest = client.downloadCurrentBuild('');
        await expect(latest).rejects.toThrow(/The package #current is not available/);
      });

      it('should not try to download the latest package from a branch that is not main/master if one is not available', async () => {
        const latest = client.downloadCurrentBuild('sushi-no-main');
        await expect(latest).rejects.toThrow(/The package sushi-no-main#current is not available/);
      });

      it('should throw error if able to find current build base url, but downloading does not find matching package', async () => {
        const latest = client.downloadCurrentBuild('sushi-test-no-download');
        await expect(latest).rejects.toThrow(
          'Failed to download sushi-test-no-download#current from https://build.fhir.org/ig/sushi/sushi-test-no-download/branches/master/package.tgz'
        );
      });
    });

    describe('currentBuildGivenBranch', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });

      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://build.fhir.org/ig/qas.json') {
            return {
              data: [
                {
                  url: 'http://hl7.org/fhir/sushi-test/ImplementationGuide/sushi-test-0.1.0',
                  name: 'sushi-test',
                  'package-id': 'sushi-test',
                  'ig-ver': '0.2.0',
                  repo: 'sushi/sushi-test/branches/testbranch/qa.json',
                  date: 'Sat, 18 May, 2024 01:48:14 +0000'
                },
                {
                  url: 'http://hl7.org/fhir/simple-test/ImplementationGuide/simple-test-0.1.0',
                  name: 'simple-test',
                  'package-id': 'simple-test',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/simple-test/branches/testbranchoneversion/qa.json'
                }
              ]
            };
          } else if (
            uri === 'https://build.fhir.org/ig/sushi/sushi-test/branches/testbranch/package.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['zipfile'])
            };
          } else if (
            uri ===
            'https://build.fhir.org/ig/sushi/simple-test/branches/testbranchoneversion/package.tgz'
          ) {
            return {
              status: 200,
              data: Readable.from(['simple test one version branch'])
            };
          }
        });
      });

      afterAll(() => {
        axiosSpy.mockRestore();
      });

      it('should download the package when branch name given', async () => {
        const latest = await client.downloadCurrentBuild('sushi-test', 'testbranch');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download sushi-test#current$testbranch from https://build.fhir.org/ig/sushi/sushi-test/branches/testbranch/package.tgz'
        );
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('zipfile');
      });

      it('should try to download the most recent branch-specific package when branch name given and multiple versions', async () => {
        const latest = await client.downloadCurrentBuild('simple-test', 'testbranchoneversion');
        expect(loggerSpy.getLastMessage('info')).toBe(
          'Attempting to download simple-test#current$testbranchoneversion from https://build.fhir.org/ig/sushi/simple-test/branches/testbranchoneversion/package.tgz'
        );
        expect(latest).toBeInstanceOf(Readable);
        expect(latest.read()).toBe('simple test one version branch');
      });

      it('should throw error when invalid branch name (branch not available) given', async () => {
        const latest = client.downloadCurrentBuild('sushi-test', 'invalidbranchname');
        await expect(latest).rejects.toThrow(
          /The package sushi-test#current\$invalidbranchname is not available/
        );
      });

      it('should throw error when invalid branch name (branch empty string) given', async () => {
        const latest = client.downloadCurrentBuild('sushi-test', '');
        await expect(latest).rejects.toThrow(/The package sushi-test#current is not available/);
      });
    });

    describe('invalidBuild', () => {
      beforeEach(() => {
        loggerSpy.reset();
      });

      beforeAll(() => {
        axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
          if (uri === 'https://build.fhir.org/ig/qas.json') {
            return {
              data: [
                {
                  url: 'http://hl7.org/fhir/sushi-test/ImplementationGuide/sushi-test-bad-status-0.1.0',
                  name: 'sushi-test',
                  'package-id': 'sushi-test-bad-status',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/sushi-test-bad-status/branches/master/qa.json'
                },
                {
                  url: 'http://hl7.org/fhir/sushi-test/ImplementationGuide/sushi-test-no-data-0.1.0',
                  name: 'sushi-test',
                  'package-id': 'sushi-test-no-data',
                  'ig-ver': '0.1.0',
                  repo: 'sushi/sushi-test-no-data/branches/master/qa.json'
                }
              ]
            };
          } else if (
            uri ===
            'https://build.fhir.org/ig/sushi/sushi-test-bad-status/branches/master/package.tgz'
          ) {
            return {
              status: 404,
              data: Readable.from(['zipfile'])
            };
          } else if (
            uri === 'https://build.fhir.org/ig/sushi/sushi-test-no-data/branches/master/package.tgz'
          ) {
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

      it('should throw error if download has 404 status', async () => {
        const latest = client.downloadCurrentBuild('sushi-test-bad-status');
        await expect(latest).rejects.toThrow(
          'Failed to download sushi-test-bad-status#current from https://build.fhir.org/ig/sushi/sushi-test-bad-status/branches/master/package.tgz'
        );
      });

      it('should throw error if download has no data', async () => {
        const latest = client.downloadCurrentBuild('sushi-test-no-data');
        await expect(latest).rejects.toThrow(
          'Failed to download sushi-test-no-data#current from https://build.fhir.org/ig/sushi/sushi-test-no-data/branches/master/package.tgz'
        );
      });

      it('should throw error if download is unsuccessful', async () => {
        const latest = client.downloadCurrentBuild('test-nodownload');
        await expect(latest).rejects.toThrow(
          /The package test-nodownload#current is not available/
        );
      });
    });
  });

  describe('#getCurrentBuildDate', () => {
    beforeEach(() => {
      loggerSpy.reset();
    });

    beforeAll(() => {
      axiosSpy = jest.spyOn(axios, 'get').mockImplementation((uri: string): any => {
        if (uri === 'https://build.fhir.org/ig/qas.json') {
          return {
            data: [
              {
                url: 'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core.r4-4.0.0',
                name: 'USCoreR4',
                'package-id': 'hl7.fhir.us.core.r4',
                'ig-ver': '4.0.0',
                date: 'Mon, 20 Jan, 2020 19:36:43 +0000',
                errs: 1496,
                warnings: 36,
                hints: 228,
                version: '4.0.0',
                tool: '4.1.0 (3)',
                repo: 'HL7/US-Core-R4/branches/main/qa.json'
              },
              {
                url: 'http://hl7.org/fhir/us/mcode/ImplementationGuide/hl7.fhir.us.mcode',
                name: 'MinimalCommonOncologyDataElements',
                'package-id': 'hl7.fhir.us.mcode',
                'ig-ver': '4.0.0',
                date: 'Tue, 03 Dec, 2024 21:49:52 +0000',
                dateISO8601: '2024-12-03T21:49:52+00:00',
                errs: 2,
                warnings: 0,
                hints: 0,
                'suppressed-hints': 75,
                'suppressed-warnings': 123,
                version: '4.0.1',
                tool: '5.0.0 (3)',
                repo: 'HL7/fhir-mCODE-ig/branches/master/qa.json'
              },
              {
                url: 'http://hl7.org/fhir/sushi-test-package-exists/ImplementationGuide/sushi-test-package-exists-0.1.0',
                name: 'sushi-test-package-exists',
                'package-id': 'sushi-test-package-exists',
                'ig-ver': '0.1.0',
                repo: 'sushi-no-manifest/sushi-test-package-exists/branches/master/qa.json'
              },
              {
                url: 'http://hl7.org/fhir/sushi-test-manifest-empty/ImplementationGuide/sushi-test-manifest-empty-0.1.0',
                name: 'sushi-test-manifest-empty',
                'package-id': 'sushi-test-manifest-empty',
                'ig-ver': '0.1.0',
                repo: 'sushi-manifest-empty/sushi-test-manifest-empty/branches/master/qa.json'
              },
              {
                url: 'http://hl7.org/fhir/sushi-test/ImplementationGuide/sushi-test-0.1.0',
                name: 'sushi-test',
                'package-id': 'sushi-test',
                'ig-ver': '0.2.0',
                repo: 'sushi/sushi-test/branches/testbranch/qa.json'
              }
            ]
          };
        } else if (
          uri === 'https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.manifest.json'
        ) {
          return {
            data: {
              date: '20200120193643'
            }
          };
        } else if (
          uri ===
          'https://build.fhir.org/ig/HL7/fhir-mCODE-ig/branches/master/package.manifest.json'
        ) {
          return {
            data: {
              date: '20241203214952'
            }
          };
        } else if (
          uri ===
          'https://build.fhir.org/ig/sushi-manifest-empty/sushi-test-manifest-empty/branches/master/package.manifest.json'
        ) {
          return {
            data: null
          };
        } else if (
          uri.startsWith('https://build.fhir.org/ig/sushi/sushi-test') &&
          uri.endsWith('json')
        ) {
          return {
            data: {
              date: '20240413230227'
            }
          };
        }
      });
    });

    afterAll(() => {
      axiosSpy.mockRestore();
    });

    it('should get date from package main when no branch given', async () => {
      const latest = await client.getCurrentBuildDate('hl7.fhir.us.core.r4');
      expect(latest).toBe('20200120193643');
    });

    it('should get date from package master when no branch given', async () => {
      const latest = await client.getCurrentBuildDate('hl7.fhir.us.mcode');
      expect(latest).toBe('20241203214952');
    });

    it('should get date from package from branch when branch is given', async () => {
      const latest = await client.getCurrentBuildDate('sushi-test', 'testbranch');
      expect(latest).toBe('20240413230227');
    });

    it('should return undefined when can not find current build base url ', async () => {
      const latest = await client.getCurrentBuildDate('wont.find.this.package.name');
      expect(latest).toBeUndefined();
    });

    it('should return undefined when can find build base url, but no manifest found', async () => {
      const latest = await client.getCurrentBuildDate('sushi-test-package-exists');
      expect(latest).toBeUndefined();
    });

    it('should return undefined when can find build base url, but manifest.data is null', async () => {
      const latest = await client.getCurrentBuildDate('sushi-test-manifest-empty');
      expect(latest).toBeUndefined();
    });
  });
});
