import axios from 'axios';
import { cloneDeep } from 'lodash';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import tar from 'tar';
import * as loadModule from '../src/load';
import {
  cleanCachedPackage,
  loadFromPath,
  mergeDependency,
  loadDependencies,
  loadDependency
} from '../src/load';
import { FHIRDefinitions, Type } from '../src/FHIRDefinitions';
import { PackageLoadError } from '../src/errors';
import { loggerSpy } from './testhelpers';

describe('#loadFromPath()', () => {
  let defsWithChildDefs: FHIRDefinitions;
  let defs: FHIRDefinitions;
  beforeAll(() => {
    defs = new FHIRDefinitions();
    defsWithChildDefs = new FHIRDefinitions();
    loadFromPath(path.join(__dirname, 'testhelpers', 'testdefs'), 'r4-definitions', defs);
    defs.fishForFHIR('Condition');
    defs.fishForFHIR('boolean');
    defs.fishForFHIR('Address');
    defs.fishForFHIR('vitalsigns');
    defs.fishForFHIR('patient-mothersMaidenName');
    defs.fishForFHIR('allergyintolerance-clinical', Type.ValueSet);
    defs.fishForFHIR('allergyintolerance-clinical', Type.CodeSystem);
    defs.fishForFHIR('MyIG');
    defs.fishForFHIR('MyLM');
    const childDef = cloneDeep(defs);
    defsWithChildDefs.childFHIRDefs.push(childDef);
    const otherChildDef = cloneDeep(defs);
    otherChildDef.package = 'other-definitions';
    defsWithChildDefs.childFHIRDefs.push(otherChildDef);
  });

  it('should load base FHIR resources from FHIRDefs with no children', () => {
    expect(defs.allResources().filter(r => r.id === 'Condition')).toHaveLength(1);
  });

  it('should load base FHIR resources from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allResources().filter(r => r.id === 'Condition')).toHaveLength(1);
  });

  it('should load base FHIR resources only from specified package', () => {
    expect(defs.allResources('r4-definitions').filter(r => r.id === 'Condition')).toHaveLength(1);
    expect(
      defsWithChildDefs.allResources('r4-definitions').filter(r => r.id === 'Condition')
    ).toHaveLength(1); // added in both childDefs, but identical resources are returned only once
  });

  it('should load base FHIR primitive types from FHIRDefs with no children', () => {
    expect(defs.allTypes().filter(r => r.id === 'boolean')).toHaveLength(1);
  });

  it('should load base FHIR primitive types from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allTypes().filter(r => r.id === 'boolean')).toHaveLength(1);
  });

  it('should load base FHIR primitive types only from specified package', () => {
    expect(defs.allTypes('r4-definitions').filter(r => r.id === 'boolean')).toHaveLength(1);
    expect(
      defsWithChildDefs.allTypes('r4-definitions').filter(r => r.id === 'boolean')
    ).toHaveLength(1);
  });

  it('should load base FHIR complex types from FHIRDefs with no children', () => {
    expect(defs.allTypes().filter(r => r.id === 'Address')).toHaveLength(1);
  });

  it('should load base FHIR complex types from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allTypes().filter(r => r.id === 'Address')).toHaveLength(1);
  });

  it('should load base FHIR complex types from specified package', () => {
    expect(defs.allTypes('r4-definitions').filter(r => r.id === 'Address')).toHaveLength(1);
    expect(
      defsWithChildDefs.allTypes('r4-definitions').filter(r => r.id === 'Address')
    ).toHaveLength(1);
  });

  it('should load base FHIR profiles from FHIRDefs with no children', () => {
    expect(defs.allProfiles().filter(r => r.id === 'vitalsigns')).toHaveLength(1);
  });

  it('should load base FHIR profiles from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allProfiles().filter(r => r.id === 'vitalsigns')).toHaveLength(1);
  });

  it('should load base FHIR profiles from specified package', () => {
    expect(defs.allProfiles('r4-definitions').filter(r => r.id === 'vitalsigns')).toHaveLength(1);
    expect(
      defsWithChildDefs.allProfiles('r4-definitions').filter(r => r.id === 'vitalsigns')
    ).toHaveLength(1);
  });

  it('should load base FHIR extensions from FHIRDefs with no children', () => {
    expect(defs.allExtensions().filter(r => r.id === 'patient-mothersMaidenName')).toHaveLength(1);
  });

  it('should load base FHIR extensions from all child FHIRDefs', () => {
    expect(
      defsWithChildDefs.allExtensions().filter(r => r.id === 'patient-mothersMaidenName')
    ).toHaveLength(1);
  });

  it('should load base FHIR extensions from specified package', () => {
    expect(
      defs.allExtensions('r4-definitions').filter(r => r.id === 'patient-mothersMaidenName')
    ).toHaveLength(1);
    expect(
      defsWithChildDefs
        .allExtensions('r4-definitions')
        .filter(r => r.id === 'patient-mothersMaidenName')
    ).toHaveLength(1);
  });

  it('should load base FHIR value sets from FHIRDefs with no children', () => {
    expect(defs.allValueSets().filter(r => r.id === 'allergyintolerance-clinical')).toHaveLength(1);
  });

  it('should load base FHIR value sets from all child FHIRDefs', () => {
    expect(
      defsWithChildDefs.allValueSets().filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
  });

  it('should load base FHIR value sets from specified package', () => {
    expect(
      defs.allValueSets('r4-definitions').filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
    expect(
      defsWithChildDefs
        .allValueSets('r4-definitions')
        .filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
  });

  it('should load base FHIR code systems from FHIRDefs with no children', () => {
    expect(defs.allCodeSystems().filter(r => r.id === 'allergyintolerance-clinical')).toHaveLength(
      1
    );
  });

  it('should load base FHIR code systems from all child FHIRDefs', () => {
    expect(
      defsWithChildDefs.allCodeSystems().filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
  });

  it('should load base FHIR code systems from specified package', () => {
    expect(
      defs.allCodeSystems('r4-definitions').filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
    expect(
      defsWithChildDefs
        .allCodeSystems('r4-definitions')
        .filter(r => r.id === 'allergyintolerance-clinical')
    ).toHaveLength(1);
  });

  it('should load base FHIR implementation guides from FHIRDefs with no children', () => {
    expect(defs.allImplementationGuides().filter(r => r.id === 'MyIG')).toHaveLength(1);
  });

  it('should load base FHIR implementation guides from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allImplementationGuides().filter(r => r.id === 'MyIG')).toHaveLength(
      1
    );
  });

  it('should load base FHIR implementation guides from specified package', () => {
    expect(
      defs.allImplementationGuides('r4-definitions').filter(r => r.id === 'MyIG')
    ).toHaveLength(1);
    expect(
      defsWithChildDefs.allImplementationGuides('r4-definitions').filter(r => r.id === 'MyIG')
    ).toHaveLength(1);
  });

  it('should load base FHIR logicals from FHIRDefs with no children', () => {
    expect(defs.allLogicals().filter(r => r.id === 'MyLM')).toHaveLength(1);
  });

  it('should load base FHIR logicals from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allLogicals().filter(r => r.id === 'MyLM')).toHaveLength(1);
  });

  it('should load base FHIR logicals from specified package', () => {
    expect(defs.allLogicals('r4-definitions').filter(r => r.id === 'MyLM')).toHaveLength(1);
    expect(
      defsWithChildDefs.allLogicals('r4-definitions').filter(r => r.id === 'MyLM')
    ).toHaveLength(1);
  });

  it('should load the package.json file', () => {
    expect(defs.getPackageJson('r4-definitions')).toBeDefined();
  });

  it('should count size of each unique definition from child FHIRDefs in total', () => {
    // the two child FHIRDefs are identical,
    // so the size of the parent is equal to the size of each child.
    expect(defsWithChildDefs.size()).toEqual(defs.size());
  });

  it('should get all unsuccessfully loaded packages from FHIRDefs with no children', () => {
    const failedPackage = new FHIRDefinitions();
    failedPackage.package = 'my-package';
    failedPackage.unsuccessfulPackageLoad = true;
    expect(failedPackage.allUnsuccessfulPackageLoads()).toHaveLength(1);
  });

  it('should get all unsuccessfully loaded packages from all child FHIRDefs', () => {
    const failedPackage = new FHIRDefinitions();
    failedPackage.package = 'my-package';
    failedPackage.unsuccessfulPackageLoad = true;
    const failedChildPackage = new FHIRDefinitions();
    failedChildPackage.package = 'failed-child-package';
    failedChildPackage.unsuccessfulPackageLoad = true;
    const successfulPackageLoad = new FHIRDefinitions();
    successfulPackageLoad.package = 'successful-child-package';
    // unsuccessfulPackageLoad defaults to false
    failedPackage.childFHIRDefs.push(failedChildPackage, successfulPackageLoad);
    expect(failedPackage.allUnsuccessfulPackageLoads()).toHaveLength(2);
  });

  it('should get all unsuccessfully loaded packages from specified package', () => {
    const failedPackage = new FHIRDefinitions();
    failedPackage.package = 'my-package';
    failedPackage.unsuccessfulPackageLoad = true;
    const failedChildPackage = new FHIRDefinitions();
    failedChildPackage.package = 'failed-child-package';
    failedChildPackage.unsuccessfulPackageLoad = true;
    const successfulPackageLoad = new FHIRDefinitions();
    successfulPackageLoad.package = 'successful-child-package';
    // unsuccessfulPackageLoad defaults to false
    failedPackage.childFHIRDefs.push(failedChildPackage, successfulPackageLoad);
    expect(failedPackage.allUnsuccessfulPackageLoads('my-package')).toHaveLength(1);
    expect(failedPackage.allUnsuccessfulPackageLoads('my-package')).toEqual(['my-package']);
  });

  it('should get all packages from FHIRDefs with no children', () => {
    expect(defs.allPackages()).toHaveLength(1);
  });

  it('should get all packages from all child FHIRDefs', () => {
    expect(defsWithChildDefs.allPackages()).toHaveLength(2);
  });

  it('should get all packages from specified package', () => {
    expect(defs.allPackages('r4-definitions')).toHaveLength(1);
    expect(defsWithChildDefs.allPackages('r4-definitions')).toHaveLength(1);
  });
});

describe('#loadDependencies()', () => {
  const log = (level: string, message: string) => {
    loggerSpy.log(level, message);
  };
  let jestSpy: jest.SpyInstance;
  beforeAll(() => {
    jestSpy = jest
      .spyOn(loadModule, 'mergeDependency')
      .mockImplementation(
        async (packageName: string, version: string, FHIRDefs: FHIRDefinitions) => {
          // the mock loader can find hl7.fhir.(r2|r3|r4|r5|us).core
          if (/^hl7.fhir.(r2|r3|r4|r4b|r5|us).core$/.test(packageName)) {
            FHIRDefs.package = `${packageName}#${version}`;
            return Promise.resolve(FHIRDefs);
          } else if (/^self-signed.package$/.test(packageName)) {
            throw new Error('self signed certificate in certificate chain');
          } else {
            throw new PackageLoadError(`${packageName}#${version}`);
          }
        }
      );
  });

  beforeEach(() => {
    loggerSpy.reset();
  });

  afterAll(() => {
    jestSpy.mockRestore();
  });

  it('should return single FHIRDefinitions if only one package is loaded', () => {
    const fhirPackages = ['hl7.fhir.us.core#4.0.1'];
    return loadDependencies(fhirPackages, undefined, log).then(defs => {
      expect(defs.package).toEqual('hl7.fhir.us.core#4.0.1');
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });
  });

  it('should return an array of FHIRDefinitions if multiple packages are loaded', () => {
    const fhirPackages = ['hl7.fhir.us.core#4.0.1', 'hl7.fhir.us.core#3.0.1'];
    return loadDependencies(fhirPackages, undefined, log).then(defs => {
      expect(defs.package).toEqual(''); // No package specified on wrapper class
      expect(defs.childFHIRDefs).toHaveLength(2);
      expect(defs.childFHIRDefs[0].package).toEqual('hl7.fhir.us.core#4.0.1');
      expect(defs.childFHIRDefs[1].package).toEqual('hl7.fhir.us.core#3.0.1');
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });
  });

  it('should log an error when it fails to load any of dependencies', () => {
    const fhirPackages = ['hl7.does.not.exist#current'];
    return loadDependencies(fhirPackages, undefined, log).then(defs => {
      expect(defs.package).toEqual('hl7.does.not.exist#current');
      expect(defs.allResources()).toHaveLength(0); // No resources added
      expect(loggerSpy.getLastMessage('error')).toMatch(
        /Failed to load hl7\.does\.not\.exist#current/s
      );
      expect(loggerSpy.getLastMessage('error')).not.toMatch(/SSL/s);
    });
  });

  it('should log a more detailed error when it fails to download a dependency due to certificate issue', () => {
    const selfSignedPackage = ['self-signed.package#1.0.0'];
    return loadDependencies(selfSignedPackage, undefined, log).then(defs => {
      expect(defs.package).toEqual('self-signed.package#1.0.0');
      expect(defs.allResources()).toHaveLength(0); // No resources added
      expect(loggerSpy.getLastMessage('error')).toMatch(
        /Failed to load self-signed\.package#1\.0\.0/s
      );
      // AND it should log the detailed message about SSL
      expect(loggerSpy.getLastMessage('error')).toMatch(
        /Sometimes this error occurs in corporate or educational environments that use proxies and\/or SSL inspection/s
      );
    });
  });
});

describe('#loadDependency()', () => {
  const log = (level: string, message: string) => {
    loggerSpy.log(level, message);
  };
  let jestSpy: jest.SpyInstance;
  let fhirDefs: FHIRDefinitions;
  beforeAll(async () => {
    jestSpy = jest
      .spyOn(loadModule, 'mergeDependency')
      .mockImplementation(
        async (packageName: string, version: string, FHIRDefs: FHIRDefinitions) => {
          // the mock loader can find hl7.fhir.(r2|r3|r4|r5|us).core
          if (/^hl7.fhir.(r2|r3|r4|r4b|r5|us).core$/.test(packageName)) {
            return Promise.resolve(FHIRDefs);
          } else if (/^self-signed.package$/.test(packageName)) {
            throw new Error('self signed certificate in certificate chain');
          } else {
            throw new PackageLoadError(`${packageName}#${version}`);
          }
        }
      );
  });

  beforeEach(async () => {
    fhirDefs = await loadDependencies(
      ['hl7.fhir.r4.core#4.0.1', 'hl7.fhir.r5.core#current'],
      undefined,
      log
    );
    // Reset after loading dependencies so tests only check their own changes
    loggerSpy.reset();
    jestSpy.mockClear();
  });

  afterAll(() => {
    jestSpy.mockRestore();
  });

  it('should call mergeDependency with a blank FHIRDefinition', () => {
    const packageName = 'hl7.fhir.us.core';
    const packageVersion = '4.0.1';
    return loadDependency(packageName, packageVersion, fhirDefs, undefined, log).then(() => {
      expect(jestSpy).toHaveBeenCalledTimes(1);
      expect(jestSpy).toHaveBeenLastCalledWith(
        packageName,
        packageVersion,
        new FHIRDefinitions(),
        path.join(os.homedir(), '.fhir', 'packages'),
        log
      );
    });
  });

  it('should return a FHIRDefinition with a new childDefs if there were already childDefs before loading another package', () => {
    const packageName = 'hl7.fhir.us.core';
    const packageVersion = '4.0.1';
    return loadDependency(packageName, packageVersion, fhirDefs, undefined, log).then(defs => {
      expect(jestSpy).toHaveBeenCalledTimes(1);
      expect(defs.childFHIRDefs).toHaveLength(3);
    });
  });

  it('should wrap provided definitions and merged definitions if there were no childDefs before loading another package', async () => {
    // If only one package is specified, FHIRDefs has packages loaded directly and no childDefs
    // but loading a second package with loadDependency should then wrap the original defs and
    // the new package defs in one FHIRDefs with two childDefs
    const oneFHIRDefs = await loadDependencies(['hl7.fhir.r4.core#4.0.1'], undefined, log);
    const packageName = 'hl7.fhir.us.core';
    const packageVersion = '4.0.1';
    return loadDependency(packageName, packageVersion, oneFHIRDefs, undefined, log).then(defs => {
      expect(jestSpy).toHaveBeenCalledTimes(2); // Once at the start of the test, once from loadDependency
      expect(defs.childFHIRDefs).toHaveLength(2);
    });
  });
});

describe('#mergeDependency()', () => {
  const log = (level: string, message: string) => {
    loggerSpy.log(level, message);
  };
  let defs: FHIRDefinitions;
  let axiosSpy: jest.SpyInstance;
  let axiosHeadSpy: jest.SpyInstance;
  let tarSpy: jest.SpyInstance;
  let removeSpy: jest.SpyInstance;
  let moveSpy: jest.SpyInstance;
  let writeSpy: jest.SpyInstance;
  let cachePath: string;

  // Many tests check that the right package was downloaded to the right place.
  // This function encapsulates that testing logic. It's coupled more tightly to
  // the actual implementation than I'd prefer, but... at least it's in one place.
  const expectDownloadSequence = (
    sources: string | string[],
    destination: string,
    isCurrent = false,
    isCurrentFound = true
  ): void => {
    if (!Array.isArray(sources)) {
      sources = [sources];
    }
    if (isCurrent) {
      const mockCalls: any[] = [['https://build.fhir.org/ig/qas.json']];
      if (isCurrentFound) {
        mockCalls.push(
          [sources[0].replace(/package\.tgz$/, 'package.manifest.json')],
          [sources[0], { responseType: 'arraybuffer' }]
        );
      }
      expect(axiosSpy.mock.calls).toEqual(mockCalls);
    } else {
      expect(axiosSpy.mock.calls).toEqual(sources.map(s => [s, { responseType: 'arraybuffer' }]));
    }
    if (destination != null) {
      const tempTarFile = writeSpy.mock.calls[0][0];
      const tempTarDirectory = tarSpy.mock.calls[0][0].cwd;
      expect(tarSpy.mock.calls[0][0].file).toBe(tempTarFile);
      expect(moveSpy.mock.calls[0][0]).toBe(tempTarDirectory);
      expect(moveSpy.mock.calls[0][1]).toBe(destination);
    } else {
      expect(writeSpy).toHaveBeenCalledTimes(0);
      expect(tarSpy).toHaveBeenCalledTimes(0);
      expect(moveSpy).toHaveBeenCalledTimes(0);
    }
  };

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
              url: 'http://hl7.org/fhir/sushi-test-no-download/ImplementationGuide/sushi-test-no-download-0.1.0',
              name: 'sushi-test-no-download',
              'package-id': 'sushi-test-no-download',
              'ig-ver': '0.1.0',
              repo: 'sushi/sushi-test-no-download/branches/master/qa.json'
            },
            {
              url: 'http://hl7.org/fhir/sushi-test-old/ImplementationGuide/sushi-test-old-0.1.0',
              name: 'sushi-test-old',
              'package-id': 'sushi-test-old',
              'ig-ver': '0.1.0',
              repo: 'sushi/sushi-test-old/branches/master/qa.json'
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
        uri === 'https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.manifest.json' ||
        (uri.startsWith('https://build.fhir.org/ig/sushi/sushi-test') && uri.endsWith('json'))
      ) {
        return {
          data: {
            date: '20200413230227'
          }
        };
      } else if (
        uri === 'https://packages.fhir.org/sushi-test/0.2.0' ||
        uri === 'https://build.fhir.org/ig/sushi/sushi-test-old/branches/master/package.tgz' ||
        uri === 'https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.tgz' ||
        uri === 'https://build.fhir.org/hl7.fhir.r5.core.tgz' ||
        uri === 'https://packages2.fhir.org/packages/hl7.fhir.r4b.core/4.1.0' ||
        uri === 'https://packages.fhir.org/hl7.fhir.r4b.core/4.3.0' ||
        uri === 'https://packages2.fhir.org/packages/hl7.fhir.r5.core/4.5.0' ||
        uri === 'https://packages.fhir.org/hl7.fhir.r4.core/4.0.1' ||
        uri === 'https://packages2.fhir.org/packages/fhir.dicom/2021.4.20210910'
      ) {
        return {
          data: {
            some: 'zipfile'
          }
        };
      } else if (
        uri === 'https://packages.fhir.org/hl7.fhir.r4b.core/4.1.0' ||
        uri === 'https://packages.fhir.org/hl7.fhir.r5.core/4.5.0' ||
        uri === 'https://packages.fhir.org/fhir.dicom/2021.4.20210910'
      ) {
        throw 'Not Found';
      } else {
        return {};
      }
    });
    axiosHeadSpy = jest.spyOn(axios, 'head').mockImplementation((): any => {
      throw 'Method Not Allowed';
    });
    tarSpy = jest.spyOn(tar, 'x').mockImplementation(() => {});
    writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    removeSpy = jest.spyOn(fs, 'removeSync').mockImplementation(() => {});
    moveSpy = jest.spyOn(fs, 'moveSync').mockImplementation(() => {});
    cachePath = path.join(__dirname, 'testhelpers', 'fixtures');
  });

  beforeEach(() => {
    loggerSpy.reset();
    defs = new FHIRDefinitions();
    axiosSpy.mockClear();
    axiosHeadSpy.mockClear();
    tarSpy.mockClear();
    writeSpy.mockClear();
    moveSpy.mockClear();
    removeSpy.mockClear();
  });

  // Packages with numerical versions
  it('should not try to download a non-current package that is already in the cache', async () => {
    const expectedDefs = new FHIRDefinitions();
    loadFromPath(cachePath, 'sushi-test#0.1.0', expectedDefs);
    await expect(mergeDependency('sushi-test', '0.1.0', defs, cachePath, log)).resolves.toEqual(
      expectedDefs
    );
    expect(axiosSpy.mock.calls.length).toBe(0);
  });

  it('should recognize a package in the cache with uppercase letters', async () => {
    const expectedDefs = new FHIRDefinitions();
    loadFromPath(cachePath, 'sushi-test-caps#0.1.0', expectedDefs);
    await expect(
      mergeDependency('sushi-test-caps', '0.1.0', defs, cachePath, log)
    ).resolves.toEqual(expectedDefs);
    expect(axiosSpy.mock.calls.length).toBe(0);
  });

  it('should try to load a package from packages.fhir.org when a non-current package is not cached', async () => {
    await expect(mergeDependency('sushi-test', '0.2.0', defs, 'foo', log)).rejects.toThrow(
      'The package sushi-test#0.2.0 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      'https://packages.fhir.org/sushi-test/0.2.0',
      path.join('foo', 'sushi-test#0.2.0')
    );
  });

  it('should try to load FHIR R4 (4.0.1) from packages.fhir.org when it is not cached', async () => {
    await expect(mergeDependency('hl7.fhir.r4.core', '4.0.1', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.r4.core#4.0.1 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      'https://packages.fhir.org/hl7.fhir.r4.core/4.0.1',
      path.join('foo', 'hl7.fhir.r4.core#4.0.1')
    );
  });

  it('should try to load prerelease FHIR R4B (4.1.0) from packages2.fhir.org when it is not cached', async () => {
    await expect(mergeDependency('hl7.fhir.r4b.core', '4.1.0', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.r4b.core#4.1.0 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      [
        'https://packages.fhir.org/hl7.fhir.r4b.core/4.1.0',
        'https://packages2.fhir.org/packages/hl7.fhir.r4b.core/4.1.0'
      ],
      path.join('foo', 'hl7.fhir.r4b.core#4.1.0')
    );
  });

  it('should try to load FHIR R4B (4.3.0) from packages.fhir.org when it is not cached', async () => {
    await expect(mergeDependency('hl7.fhir.r4b.core', '4.3.0', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.r4b.core#4.3.0 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      'https://packages.fhir.org/hl7.fhir.r4b.core/4.3.0',
      path.join('foo', 'hl7.fhir.r4b.core#4.3.0')
    );
  });

  it('should try to load prerelease FHIR R5 (4.5.0) from packages2.fhir.org when it is not cached', async () => {
    await expect(mergeDependency('hl7.fhir.r5.core', '4.5.0', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.r5.core#4.5.0 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      [
        'https://packages.fhir.org/hl7.fhir.r5.core/4.5.0',
        'https://packages2.fhir.org/packages/hl7.fhir.r5.core/4.5.0'
      ],
      path.join('foo', 'hl7.fhir.r5.core#4.5.0')
    );
  });

  it('should try to load a package from packages2.fhir.org when it is not on packages.fhir.org', async () => {
    await expect(
      mergeDependency('fhir.dicom', '2021.4.20210910', defs, 'foo', log)
    ).rejects.toThrow(
      'The package fhir.dicom#2021.4.20210910 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      [
        'https://packages.fhir.org/fhir.dicom/2021.4.20210910',
        'https://packages2.fhir.org/packages/fhir.dicom/2021.4.20210910'
      ],
      path.join('foo', 'fhir.dicom#2021.4.20210910')
    );
  });

  it('should throw PackageLoadError when a package with a non-current version is not cached or available on packages.fhir.org', async () => {
    await expect(mergeDependency('sushi-test', '0.3.0', defs, 'foo', log)).rejects.toThrow(
      'The package sushi-test#0.3.0 could not be loaded locally or from the FHIR package registry'
    );
    expect(loggerSpy.getLastMessage('info')).toMatch(
      /Unable to download most current version of sushi-test#0.3.0/
    );
    expectDownloadSequence('https://packages.fhir.org/sushi-test/0.3.0', null);
  });

  it('should throw PackageLoadError when a package cannot be loaded from packages2.fhir.org', async () => {
    axiosSpy = jest
      .spyOn(axios, 'get')
      .mockImplementationOnce((uri: string): any => {
        if (uri === 'https://packages.fhir.org/fhir.fake/2022.1.01') {
          throw 'Not Found';
        }
      })
      .mockImplementationOnce((uri: string): any => {
        if (uri === 'https://packages2.fhir.org/packages/fhir.fake/2022.1.01') {
          throw 'Not Found';
        }
      });
    await expect(mergeDependency('fhir.fake', '2022.1.01', defs, 'foo', log)).rejects.toThrow(
      'The package fhir.fake#2022.1.01 could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      [
        'https://packages.fhir.org/fhir.fake/2022.1.01',
        'https://packages2.fhir.org/packages/fhir.fake/2022.1.01'
      ],
      null
    );
  });

  // Packages with current versions
  it('should not try to download a current package that is already in the cache and up to date', async () => {
    const expectedDefs = new FHIRDefinitions();
    loadFromPath(cachePath, 'sushi-test#current', expectedDefs);
    await expect(mergeDependency('sushi-test', 'current', defs, cachePath, log)).resolves.toEqual(
      expectedDefs
    );
    expect(axiosSpy.mock.calls).toEqual([
      ['https://build.fhir.org/ig/qas.json'],
      ['https://build.fhir.org/ig/sushi/sushi-test/branches/master/package.manifest.json']
    ]);
  });

  it('should try to load the latest package from build.fhir.org when a current package version is not locally cached', async () => {
    await expect(
      mergeDependency('hl7.fhir.us.core.r4', 'current', defs, 'foo', log)
    ).rejects.toThrow(
      'The package hl7.fhir.us.core.r4#current could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      'https://build.fhir.org/ig/HL7/US-Core-R4/branches/main/package.tgz',
      path.join('foo', 'hl7.fhir.us.core.r4#current'),
      true
    );
  });

  it('should try to load the latest package from build.fhir.org when a current package version has an older version that is locally cached', async () => {
    await expect(
      mergeDependency('sushi-test-old', 'current', defs, cachePath, log)
    ).resolves.toBeTruthy(); // Since tar is mocked, the actual cache is not updated
    expectDownloadSequence(
      'https://build.fhir.org/ig/sushi/sushi-test-old/branches/master/package.tgz',
      path.join(cachePath, 'sushi-test-old#current'),
      true
    );
    expect(removeSpy.mock.calls[0][0]).toBe(path.join(cachePath, 'sushi-test-old#current'));
  });

  it('should not try to load the latest package from build.fhir.org from a branch that is not main/master', async () => {
    await expect(mergeDependency('sushi-no-main', 'current', defs, cachePath, log)).rejects.toThrow(
      'The package sushi-no-main#current is not available on https://build.fhir.org/ig/qas.json, so no current version can be loaded'
    );
    expectDownloadSequence(
      'https://build.fhir.org/ig/sushi/sushi-no-main/branches/master/package.tgz',
      null,
      true,
      false
    );
  });

  // This handles the edge case that comes from how SUSHI uses FHIRDefinitions
  it('should successfully load a package even if the FHIRDefinitions.package property does not reflect the current package', async () => {
    const newDefs = await mergeDependency('sushi-test', 'current', defs, cachePath, log);
    axiosSpy.mockClear(); // Clear the spy between the two calls in the single test

    // This mimics the odd SUSHI case because we pass in a FHIRDefinitions that already had definitions loaded into it
    // So instead of creating a new FHIRDefs for a new package, we re-use an old one. Only SUSHI does this.
    // This is not expected and is not the intended pattern for normal use.
    await expect(
      mergeDependency('sushi-test-old', 'current', newDefs, cachePath, log)
    ).resolves.toBeTruthy();
    expectDownloadSequence(
      'https://build.fhir.org/ig/sushi/sushi-test-old/branches/master/package.tgz',
      path.join(cachePath, 'sushi-test-old#current'),
      true
    );
    expect(removeSpy.mock.calls[0][0]).toBe(path.join(cachePath, 'sushi-test-old#current'));
  });

  it('should try to load the latest FHIR R5 package from build.fhir.org when it is not locally cached', async () => {
    await expect(mergeDependency('hl7.fhir.r5.core', 'current', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.r5.core#current could not be loaded locally or from the FHIR package registry'
    ); // the package is never actually added to the cache, since tar is mocked
    expectDownloadSequence(
      'https://build.fhir.org/hl7.fhir.r5.core.tgz',
      path.join('foo', 'hl7.fhir.r5.core#current'),
      false // technically not treated like other current builds (for some reason)
    );
  });

  it('should revert to an old locally cached current version when a newer current version is not available for download', async () => {
    const expectedDefs = new FHIRDefinitions();
    loadFromPath(cachePath, 'sushi-test-no-download#current', expectedDefs);
    await expect(
      mergeDependency('sushi-test-no-download', 'current', defs, cachePath, log)
    ).resolves.toEqual(expectedDefs);
    expectDownloadSequence(
      'https://build.fhir.org/ig/sushi/sushi-test-no-download/branches/master/package.tgz',
      null,
      true
    );
    expect(removeSpy).toHaveBeenCalledTimes(0);
  });

  // Packages with dev versions
  it('should not try to download a dev package that is already in the cache', async () => {
    const expectedDefs = new FHIRDefinitions();
    loadFromPath(cachePath, 'sushi-test#dev', expectedDefs);
    await expect(mergeDependency('sushi-test', 'dev', defs, cachePath, log)).resolves.toEqual(
      expectedDefs
    );
    expect(axiosSpy.mock.calls).toHaveLength(0);
  });

  it('should load the current package from build.fhir.org when a dev package is loaded and not locally cached', async () => {
    await expect(
      mergeDependency('sushi-test-old', 'dev', defs, cachePath, log)
    ).resolves.toBeTruthy();
    expect(
      loggerSpy
        .getAllMessages('info')
        .some(message =>
          message.match(
            /Falling back to sushi-test-old#current since sushi-test-old#dev is not locally cached./
          )
        )
    ).toBeTruthy();
    expectDownloadSequence(
      'https://build.fhir.org/ig/sushi/sushi-test-old/branches/master/package.tgz',
      path.join(cachePath, 'sushi-test-old#current'),
      true
    );
    expect(removeSpy.mock.calls[0][0]).toBe(path.join(cachePath, 'sushi-test-old#current'));
  });

  it('should throw CurrentPackageLoadError when a current package is not listed', async () => {
    await expect(mergeDependency('hl7.fhir.us.core', 'current', defs, 'foo', log)).rejects.toThrow(
      'The package hl7.fhir.us.core#current is not available on https://build.fhir.org/ig/qas.json, so no current version can be loaded'
    );
    expect(axiosSpy.mock.calls.length).toBe(1);
    expect(axiosSpy.mock.calls[0][0]).toBe('https://build.fhir.org/ig/qas.json');
  });

  it('should throw CurrentPackageLoadError when https://build.fhir.org/ig/qas.json gives a bad response', async () => {
    axiosSpy.mockImplementationOnce(() => {});
    await expect(mergeDependency('bad.response', 'current', defs, 'foo', log)).rejects.toThrow(
      'The package bad.response#current is not available on https://build.fhir.org/ig/qas.json, so no current version can be loaded'
    );
    expect(axiosSpy.mock.calls.length).toBe(1);
    expect(axiosSpy.mock.calls[0][0]).toBe('https://build.fhir.org/ig/qas.json');
  });
});

describe('#cleanCachedPackage', () => {
  let renameSpy: jest.SpyInstance;
  let cachePath: string;

  beforeAll(() => {
    renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
    cachePath = path.join(__dirname, 'testhelpers', 'fixtures');
  });

  beforeEach(() => {
    renameSpy.mockClear();
  });

  it('should move all contents of a package into the "package" folder', () => {
    const packagePath = path.join(cachePath, 'sushi-test-wrong-format#current');
    cleanCachedPackage(packagePath);
    expect(renameSpy.mock.calls.length).toBe(2);
    expect(renameSpy.mock.calls).toContainEqual([
      path.join(packagePath, 'other'),
      path.join(packagePath, 'package', 'other')
    ]);
    expect(renameSpy.mock.calls).toContainEqual([
      path.join(packagePath, 'StructureDefinition-MyPatient.json'),
      path.join(packagePath, 'package', 'StructureDefinition-MyPatient.json')
    ]);
  });

  it('should do nothing if the package does not have a "package" folder', () => {
    const packagePath = path.join(cachePath, 'sushi-test-no-package#current');
    cleanCachedPackage(packagePath);
    expect(renameSpy.mock.calls.length).toBe(0);
  });

  it('should do nothing if the package is correctly structured', () => {
    const packagePath = path.join(cachePath, 'sushi-test#current');
    cleanCachedPackage(packagePath);
    expect(renameSpy.mock.calls.length).toBe(0);
  });
});
