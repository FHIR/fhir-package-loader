import initSqlJs from 'sql.js';
import { SQLJSPackageDB } from '../../src/db/SQLJSPackageDB';
import { loggerSpy } from '../testhelpers';
import { ResourceInfo } from '../../src/package';

describe('SQLJSPackageDB', () => {
  let SQL: initSqlJs.SqlJsStatic;
  let sqlDb: initSqlJs.Database;
  let dbRunSpy: jest.SpyInstance;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    loggerSpy.reset();
    sqlDb = new SQL.Database();
    dbRunSpy = jest.spyOn(sqlDb, 'run');
  });

  afterEach(() => {
    dbRunSpy.mockReset();
    sqlDb.close();
  });

  describe('constructor', () => {
    it('should create and initialize a new SQLJSPackageDB', () => {
      const packageDb = new SQLJSPackageDB(sqlDb);
      expect(packageDb).toBeDefined();
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('#clear', () => {
    let packageDb: SQLJSPackageDB;
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      url: 'http://example.org/Extensions/a-special-extension',
      sdFlavor: 'Extension',
      packageName: 'CookiePackage',
      packageVersion: '4.5.6'
    };
    const valueSetThree: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'CookiePackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'CookiePackage',
      packageVersion: '4.5.6'
    };

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '3.2.2',
        packagePath: '/var/data/.fhir/CookiePackage-3.2.2'
      });
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '4.5.6',
        packagePath: '/var/data/.fhir/CookiePackage-4.5.6'
      });
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should remove all packages and resources', () => {
      // we start with some packages and resources
      const beforePackageInfo = packageDb.findPackageInfos('CookiePackage');
      expect(beforePackageInfo).toHaveLength(2);
      const beforeResourceInfo = packageDb.findResourceInfos('*');
      expect(beforeResourceInfo).toHaveLength(3);
      // but after clear, they're gone
      packageDb.clear();
      const afterPackageInfo = packageDb.findPackageInfos('CookiePackage');
      expect(afterPackageInfo).toHaveLength(0);
      const afterResourceInfo = packageDb.findResourceInfos('*');
      expect(afterResourceInfo).toHaveLength(0);
    });
  });

  describe('#savePackageInfo', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
    });

    it('should save package info with a name and version', () => {
      packageDb.savePackageInfo({
        name: 'MyPackage',
        version: '1.0.4'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const savedPackage = packageDb.findPackageInfo('MyPackage', '1.0.4');
      expect(savedPackage).toEqual(
        expect.objectContaining({
          name: 'MyPackage',
          version: '1.0.4'
        })
      );
    });

    it('should save package info with a name, version, and package path', () => {
      packageDb.savePackageInfo({
        name: 'MyPackage',
        version: '1.0.4',
        packagePath: '/var/data/.fhir/MyPackage-1.0.4'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const savedPackage = packageDb.findPackageInfo('MyPackage', '1.0.4');
      expect(savedPackage).toEqual(
        expect.objectContaining({
          name: 'MyPackage',
          version: '1.0.4',
          packagePath: '/var/data/.fhir/MyPackage-1.0.4'
        })
      );
    });

    it('should save package info with a name, version, and package.json path', () => {
      packageDb.savePackageInfo({
        name: 'MyPackage',
        version: '1.0.4',
        packageJSONPath: '/var/data/.fhir/MyPackage-1.0.4/package.json'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const savedPackage = packageDb.findPackageInfo('MyPackage', '1.0.4');
      expect(savedPackage).toEqual(
        expect.objectContaining({
          name: 'MyPackage',
          version: '1.0.4',
          packageJSONPath: '/var/data/.fhir/MyPackage-1.0.4/package.json'
        })
      );
    });

    it('should save package info with a name, version, package path, and package.json path', () => {
      packageDb.savePackageInfo({
        name: 'MyPackage',
        version: '1.0.4',
        packagePath: '/var/data/.fhir/MyPackage-1.0.4',
        packageJSONPath: '/var/data/.fhir/MyPackage-1.0.4/package.json'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const savedPackage = packageDb.findPackageInfo('MyPackage', '1.0.4');
      expect(savedPackage).toEqual(
        expect.objectContaining({
          name: 'MyPackage',
          version: '1.0.4',
          packagePath: '/var/data/.fhir/MyPackage-1.0.4',
          packageJSONPath: '/var/data/.fhir/MyPackage-1.0.4/package.json'
        })
      );
    });
  });

  describe('#saveResourceInfo', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
    });

    it('should save a simple resource', () => {
      packageDb.saveResourceInfo({
        resourceType: 'StructureDefinition',
        id: 'my-patient-profile'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const resource = packageDb.findResourceInfo('my-patient-profile');
      expect(resource).toEqual(
        expect.objectContaining({
          resourceType: 'StructureDefinition',
          id: 'my-patient-profile'
        })
      );
    });

    it('should save a resource with additional information', () => {
      packageDb.saveResourceInfo({
        resourceType: 'ValueSet',
        id: 'my-value-set',
        url: 'http://example.org/ValueSets/my-value-set',
        name: 'MyValueSet',
        version: '3.1.3',
        packageName: 'RegularPackage',
        packageVersion: '3.2.2',
        resourcePath: '/var/data/.fhir/RegularPackage-3.2.2/ValueSets/my-value-set.json'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const resource = packageDb.findResourceInfo('my-value-set');
      expect(resource).toEqual(
        expect.objectContaining({
          resourceType: 'ValueSet',
          id: 'my-value-set',
          url: 'http://example.org/ValueSets/my-value-set',
          name: 'MyValueSet',
          version: '3.1.3',
          packageName: 'RegularPackage',
          packageVersion: '3.2.2',
          resourcePath: '/var/data/.fhir/RegularPackage-3.2.2/ValueSets/my-value-set.json'
        })
      );
    });

    it('should save a resource with additional structure definition information', () => {
      packageDb.saveResourceInfo({
        resourceType: 'StructureDefinition',
        id: 'my-patient-profile',
        name: 'MyPatientProfile',
        sdKind: 'resource',
        sdDerivation: 'constraint',
        sdType: 'Patient',
        sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
        sdAbstract: false,
        sdImposeProfiles: [
          'http://example.org/SomeOtherPatient',
          'http://example.org/YetAnotherPatient'
        ],
        // a profile wouldn't normally have characteristics,
        // but they are used here for test purposes
        sdCharacteristics: ['can-be-target', 'do-translations'],
        sdFlavor: 'Profile',
        packageName: 'RegularPackage',
        packageVersion: '3.2.2'
      });
      expect(dbRunSpy).toHaveBeenCalledTimes(1);
      const resource = packageDb.findResourceInfo('my-patient-profile');
      expect(resource).toEqual(
        expect.objectContaining({
          resourceType: 'StructureDefinition',
          id: 'my-patient-profile',
          name: 'MyPatientProfile',
          sdKind: 'resource',
          sdDerivation: 'constraint',
          sdType: 'Patient',
          sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
          sdAbstract: false,
          sdImposeProfiles: [
            'http://example.org/SomeOtherPatient',
            'http://example.org/YetAnotherPatient'
          ],
          sdCharacteristics: ['can-be-target', 'do-translations'],
          sdFlavor: 'Profile',
          packageName: 'RegularPackage',
          packageVersion: '3.2.2'
        })
      );
      // ?? do we want to turn it back into a boolean, or is leaving it as a 0 good enough
    });
  });

  describe('#findPackageInfos', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '1.0.0',
        packagePath: '/var/data/.fhir/CookiePackage-1.0.0'
      });
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '1.0.3',
        packagePath: '/var/data/.fhir/CookiePackage-1.0.3'
      });
      packageDb.savePackageInfo({
        name: 'BagelPackage',
        version: '1.0.0',
        packagePath: '/var/data/.fhir/BagelPackage-1.0.0'
      });
    });

    it('should return all packages that match a name', () => {
      const results = packageDb.findPackageInfos('CookiePackage');
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(
        expect.objectContaining({
          name: 'CookiePackage',
          version: '1.0.0',
          packagePath: '/var/data/.fhir/CookiePackage-1.0.0'
        })
      );
      expect(results).toContainEqual(
        expect.objectContaining({
          name: 'CookiePackage',
          version: '1.0.3',
          packagePath: '/var/data/.fhir/CookiePackage-1.0.3'
        })
      );
    });

    it('should return an empty list when no packages match a name', () => {
      const results = packageDb.findPackageInfos('MysteryPackage');
      expect(results).toHaveLength(0);
    });
  });

  describe('#findPackageInfo', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '1.0.0',
        packagePath: '/var/data/.fhir/CookiePackage-1.0.0'
      });
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '1.0.3',
        packagePath: '/var/data/.fhir/CookiePackage-1.0.3'
      });
      packageDb.savePackageInfo({
        name: 'BagelPackage',
        version: '1.0.0',
        packagePath: '/var/data/.fhir/BagelPackage-1.0.0'
      });
    });

    it('should return a package that matches a name and version', () => {
      const result = packageDb.findPackageInfo('CookiePackage', '1.0.3');
      expect(result).toEqual(
        expect.objectContaining({
          name: 'CookiePackage',
          version: '1.0.3',
          packagePath: '/var/data/.fhir/CookiePackage-1.0.3'
        })
      );
    });

    it('should return undefined when no package matches the name and version', () => {
      const wrongVersion = packageDb.findPackageInfo('BagelPackage', '1.0.2');
      expect(wrongVersion).toBeUndefined();
      const wrongName = packageDb.findPackageInfo('MysteryPackage', '1.0.0');
      expect(wrongName).toBeUndefined();
    });
  });

  describe('#findResourceInfos', () => {
    let packageDb: SQLJSPackageDB;
    const patientProfile: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'my-patient-profile',
      name: 'MyPatientProfile',
      sdKind: 'resource',
      sdDerivation: 'constraint',
      sdType: 'Patient',
      sdBaseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
      sdFlavor: 'Profile',
      packageName: 'RegularPackage',
      packageVersion: '3.2.2'
    };
    const observationProfile: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'my-observation-profile',
      name: 'MyObservationProfile',
      sdKind: 'resource',
      sdFlavor: 'Profile',
      packageName: 'SecretPackage',
      packageVersion: '3.2.2'
    };
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      url: 'http://example.org/Extensions/a-special-extension',
      sdFlavor: 'Extension',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };
    const valueSetThree: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'RegularPackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.saveResourceInfo(patientProfile);
      packageDb.saveResourceInfo(observationProfile);
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should find all resources when the key is *', () => {
      const resources = packageDb.findResourceInfos('*');
      expect(resources).toHaveLength(5);
      expect(resources).toContainEqual(expect.objectContaining(patientProfile));
      expect(resources).toContainEqual(expect.objectContaining(observationProfile));
      expect(resources).toContainEqual(expect.objectContaining(specialExtension));
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));
      expect(resources).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find resources where the key matches the resource id', () => {
      const resources = packageDb.findResourceInfos('my-observation-profile');
      expect(resources).toHaveLength(1);
      expect(resources).toContainEqual(expect.objectContaining(observationProfile));
    });

    it('should find resources where the key matches the resource name', () => {
      const resources = packageDb.findResourceInfos('SpecialExtension');
      expect(resources).toHaveLength(1);
      expect(resources).toContainEqual(expect.objectContaining(specialExtension));
    });

    it('should find resources where the key matches the resource url', () => {
      const resources = packageDb.findResourceInfos('http://example.org/ValueSets/my-value-set');
      expect(resources).toHaveLength(2);
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));
      expect(resources).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find resources that match a package name', () => {
      const resources = packageDb.findResourceInfos('*', {
        scope: 'RegularPackage'
      });
      expect(resources).toHaveLength(4);
      expect(resources).toContainEqual(expect.objectContaining(patientProfile));
      expect(resources).toContainEqual(expect.objectContaining(specialExtension));
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));
      expect(resources).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find resources that match a package name and package version', () => {
      const resources = packageDb.findResourceInfos('*', {
        scope: 'RegularPackage|3.2.2'
      });
      expect(resources).toHaveLength(2);
      expect(resources).toContainEqual(expect.objectContaining(patientProfile));
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));
    });

    it('should find resources that match one of the provided types', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['Extension', 'ValueSet']
      });
      expect(resources).toHaveLength(3);
      expect(resources).toContainEqual(expect.objectContaining(specialExtension));
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));
      expect(resources).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should limit the number of results based on the limit option', () => {
      const resources = packageDb.findResourceInfos('*', {
        limit: 2
      });
      expect(resources).toHaveLength(2);
    });
  });

  describe('#findResourceInfo', () => {
    let packageDb: SQLJSPackageDB;
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      url: 'http://example.org/Extensions/a-special-extension',
      sdFlavor: 'Extension',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };
    const valueSetThree: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'RegularPackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should return one resource when there is at least one match', () => {
      const resource = packageDb.findResourceInfo('my-value-set');
      expect(resource).toBeDefined();
    });

    it('should return undefined when there are no matches', () => {
      const resource = packageDb.findResourceInfo('nonexistent-profile');
      expect(resource).toBeUndefined();
    });
  });

  describe('#getPackageStats', () => {
    let packageDb: SQLJSPackageDB;
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      url: 'http://example.org/Extensions/a-special-extension',
      sdFlavor: 'Extension',
      packageName: 'CookiePackage',
      packageVersion: '4.5.6'
    };
    const valueSetThree: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'CookiePackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      packageName: 'CookiePackage',
      packageVersion: '4.5.6'
    };

    beforeEach(() => {
      packageDb = new SQLJSPackageDB(sqlDb);
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '3.2.2',
        packagePath: '/var/data/.fhir/CookiePackage-3.2.2'
      });
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '4.5.6',
        packagePath: '/var/data/.fhir/CookiePackage-4.5.6'
      });
      packageDb.savePackageInfo({
        name: 'BagelPackage',
        version: '3.2.2',
        packagePath: '/var/data/.fhir/BagelPackage-3.2.2'
      });
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should return a count of resources for a package', () => {
      const result = packageDb.getPackageStats('CookiePackage', '4.5.6');
      expect(result).toEqual({
        name: 'CookiePackage',
        version: '4.5.6',
        resourceCount: 2
      });
    });

    it('should return undefined when there is no info for a package', () => {
      const result = packageDb.getPackageStats('BagelPackage', '4.5.6');
      expect(result).toBeUndefined();
    });
  });
});
