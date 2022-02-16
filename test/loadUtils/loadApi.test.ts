import path from 'path';
import { loadApi } from '../../src/loadApi';
import { ErrorsAndWarnings, FHIRDefinitions } from '../../src/utils';
import * as loadModule from '../../src/load';
import * as logModule from '../../src/utils/logger';

describe('loadApi', () => {
  let loadSpy: jest.SpyInstance;
  const cachePath = path.join(__dirname, 'fixtures');
  const log = jest.fn();
  let wrapLoggerSpy: jest.SpyInstance;

  beforeAll(() => {
    loadSpy = jest.spyOn(loadModule, 'loadDependencies').mockResolvedValue(new FHIRDefinitions());
    wrapLoggerSpy = jest.spyOn(logModule, 'wrapLogger');
  });

  beforeEach(() => {
    loadSpy.mockClear();
    wrapLoggerSpy.mockClear();
  });

  it('should load dependencies from an array in format package@version', async () => {
    const fhirPackages = ['hl7.fake.test.package@1.0.0', 'hl7.fake.test.package@2.0.0'];
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should load dependencies from an array in format package#version', async () => {
    const fhirPackages = ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'];
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should load dependencies from a comma separated list in format package@version', async () => {
    const fhirPackages =
      'hl7.fake.test.package@1.0.0, hl7.fake.test.package@2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should load dependencies from a comma separated list in format package#version', async () => {
    const fhirPackages =
      'hl7.fake.test.package#1.0.0, hl7.fake.test.package#2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should load dependencies from a comma separated list in both formats (separated by # and @)', async () => {
    const fhirPackages =
      'hl7.fake.test.package#1.0.0, hl7.fake.test.package@2.0.0,hl7.fake.test.package@3.0.0';
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0', 'hl7.fake.test.package#2.0.0', 'hl7.fake.test.package#3.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should return list of packages that failed to load', async () => {
    const failedFhirDefs = new FHIRDefinitions();
    failedFhirDefs.package = 'hl7.fake.test.package#1.0.0';
    failedFhirDefs.unsuccessfulPackageLoad = true;
    loadSpy.mockResolvedValueOnce(failedFhirDefs);
    const fhirPackages = 'hl7.fake.test.package@1.0.0';
    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: failedFhirDefs,
      errors: [],
      warnings: [],
      failedPackages: ['hl7.fake.test.package#1.0.0']
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0'],
      cachePath,
      expect.any(Function)
    );
  });

  it('should call wrapLogger to set up a logger that tracks errors and warnings', async () => {
    const fhirPackages = 'hl7.fake.test.package#1.0.0';
    await loadApi(fhirPackages, { cachePath, log });
    expect(wrapLoggerSpy).toHaveBeenCalledTimes(1);
    expect(wrapLoggerSpy).toHaveBeenCalledWith(log, new ErrorsAndWarnings());
  });

  it('should call wrapLogger even if no log function is provided', async () => {
    const fhirPackages = 'hl7.fake.test.package#1.0.0';
    await loadApi(fhirPackages); // log option not provided
    expect(wrapLoggerSpy).toHaveBeenCalledTimes(1);
    expect(wrapLoggerSpy).toHaveBeenCalledWith(undefined, new ErrorsAndWarnings());
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

    await expect(loadApi(fhirPackages, { cachePath, log })).resolves.toEqual({
      defs: failedFhirDefs,
      errors: ['Failed to load hl7.fake.test.package#1.0.0: bad'],
      warnings: [],
      failedPackages: ['hl7.fake.test.package#1.0.0']
    });

    // Reset the loadSpy back so that any tests that come after this one still mock out loadDependencies
    loadSpy = jest.spyOn(loadModule, 'loadDependencies').mockResolvedValue(new FHIRDefinitions());
  });

  it('should pass along undefined if cachePath option is not provided', async () => {
    const fhirPackages = 'hl7.fake.test.package#1.0.0';
    await expect(loadApi(fhirPackages, { log })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0'],
      undefined,
      expect.any(Function)
    );
  });

  it('should pass along a wrappedLog function even if log option is not provided', async () => {
    const fhirPackages = 'hl7.fake.test.package#1.0.0';
    await expect(loadApi(fhirPackages, { cachePath })).resolves.toEqual({
      defs: new FHIRDefinitions(),
      errors: [],
      warnings: [],
      failedPackages: []
    });
    expect(loadSpy).toHaveBeenCalledWith(
      ['hl7.fake.test.package#1.0.0'],
      cachePath,
      expect.any(Function) // A function is passed even though options.log is undefined
    );
  });
});
