import path from 'path';
import { FHIRDefinitions, loadApi } from '../../src/loadUtils';
import * as loadModule from '../../src/loadUtils/load';
import { loggerSpy } from '../testhelpers';

describe('loadApi', () => {
  let loadSpy: jest.SpyInstance;
  const cachePath = path.join(__dirname, 'fixtures');
  const log = () => {};

  beforeAll(() => {
    loadSpy = jest.spyOn(loadModule, 'loadDependencies').mockResolvedValue(new FHIRDefinitions());
  });

  beforeEach(() => {
    loadSpy.mockClear();
    loggerSpy.reset();
  });

  it('should load dependencies from an array in format package@version', async () => {
    const fhirPackages = ['hl7.fake.test.package@1.0.0', 'hl7.fake.test.package@2.0.0'];
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'],
      cachePath,
      log
    );
  });

  it('should load dependencies from an array in format package#version', async () => {
    const fhirPackages = ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'];
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'],
      cachePath,
      log
    );
  });

  it('should load dependencies from a comma separated list in format package@version', async () => {
    const fhirPackages =
      'hl7.fake.test.package@1.0.0, hl7.fake.test.package@2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      log
    );
  });

  it('should load dependencies from a comma separated list in format package#version', async () => {
    const fhirPackages =
      'hl7.fake.test.package#1.0.0, hl7.fake.test.package#2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      log
    );
  });

  it('should load dependencies from a comma separated list in both formats (separated by # and @)', async () => {
    const fhirPackages =
      'hl7.fake.test.package#1.0.0, hl7.fake.test.package@2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      log
    );
  });

  it('should return list of packages that failed to load', async () => {
    const failedFhirDefs = new FHIRDefinitions();
    failedFhirDefs.package = 'hl7.fake.test.package#1.0.0';
    failedFhirDefs.unsuccessfulPackageLoad = true;
    loadSpy.mockResolvedValueOnce(failedFhirDefs);
    const fhirPackages = 'hl7.fake.test.package@1.0.0';
    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: failedFhirDefs,
      errors: [],
      warnings: [],
      failedPackages: ['hl7.fake.test.package#1.0.0']
    });
    expect(loadSpy).toHaveBeenCalledWith(['hl7.fake.test.package#1.0.0'], cachePath, log);
  });

  it('should return errors and warnings when present', async () => {
    // Remove the loadSpy mock so we can reach the error that gets thrown and caught from loadDependency
    loadSpy.mockRestore();
    // Spy on loadDependency and reject so we can test an error is logged
    jest.spyOn(loadModule, 'loadDependency').mockRejectedValue(new Error('bad'));

    const fhirPackages = 'hl7.fake.test.package@1.0.0';
    const failedFhirDefs = new FHIRDefinitions();
    failedFhirDefs.package = 'hl7.fake.test.package#1.0.0';
    failedFhirDefs.unsuccessfulPackageLoad = true;

    await expect(loadApi(fhirPackages, cachePath, { log })).resolves.toEqual({
      defs: failedFhirDefs,
      errors: ['Failed to load hl7.fake.test.package#1.0.0: bad'],
      warnings: [],
      failedPackages: ['hl7.fake.test.package#1.0.0']
    });

    // Reset the loadSpy back so that any tests that come after this one still mock out loadDependencies
    loadSpy = jest.spyOn(loadModule, 'loadDependencies').mockResolvedValue(new FHIRDefinitions());
  });

  it('should pass along undefined values for optional parameters', async () => {
    const fhirPackages = 'hl7.fake.test.package#1.0.0';
    await expect(loadApi(fhirPackages)).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(['hl7.fake.test.package#1.0.0'], undefined, undefined);
  });
});
