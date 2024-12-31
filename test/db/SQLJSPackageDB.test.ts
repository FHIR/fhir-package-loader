import initSqlJs from 'sql.js';
import { createSQLJSPackageDB, SQLJSPackageDB } from '../../src/db/SQLJSPackageDB';
import { ResourceInfo } from '../../src/package';
import { byLoadOrder, byType } from '../../src/sort';
import { loggerSpy } from '../testhelpers';

describe('SQLJSPackageDB', () => {
  let SQL: initSqlJs.SqlJsStatic;
  let sqlDb: initSqlJs.Database;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    loggerSpy.reset();
    sqlDb = new SQL.Database();
  });

  afterEach(() => {
    sqlDb.close();
  });

  describe('constructor', () => {
    it('should create and initialize a new SQLJSPackageDB', async () => {
      const packageDb = new SQLJSPackageDB();
      expect(packageDb.isInitialized()).toBe(false);
      await packageDb.initialize();
      expect(packageDb).toBeDefined();
      expect(packageDb.isInitialized()).toBe(true);
    });

    it('should create and initialize a new SQLJSPackageDB using a provided locateFile option', async () => {
      const packageDb = new SQLJSPackageDB();
      expect(packageDb.isInitialized()).toBe(false);
      await packageDb.initialize({ locateFile: () => 'fake/file/here' });
      expect(packageDb).toBeDefined();
      expect(packageDb.isInitialized()).toBe(true);
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

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
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

    it('should not throw even if the db is not initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      uninitializedPackageDB.clear();
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

  describe('#optimize', () => {
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

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '4.5.6',
        packagePath: '/var/data/.fhir/CookiePackage-4.5.6'
      });
      packageDb.saveResourceInfo(specialExtension);
    });

    it('should not throw even if the db is not initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      uninitializedPackageDB.optimize();
    });

    it('should run optimization without any errors', () => {
      // there's no good way to see if it actually is optimized,
      // so just ensure it runs without error and queries still work.
      packageDb.optimize();
      const packageInfos = packageDb.findPackageInfos('CookiePackage');
      expect(packageInfos).toHaveLength(1);
      const resourceInfos = packageDb.findResourceInfos('*');
      expect(resourceInfos).toHaveLength(1);
    });
  });

  describe('#savePackageInfo', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
    });

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.savePackageInfo({
          name: 'MyPackage',
          version: '1.0.4'
        });
      }).toThrow(/SQLJSPackageDB not initialized/);
    });

    it('should save package info with a name and version', () => {
      packageDb.savePackageInfo({
        name: 'MyPackage',
        version: '1.0.4'
      });
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

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
    });

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.saveResourceInfo({
          resourceType: 'StructureDefinition',
          id: 'my-patient-profile'
        });
      }).toThrow(/SQLJSPackageDB not initialized/);
    });

    it('should save a simple resource', () => {
      packageDb.saveResourceInfo({
        resourceType: 'StructureDefinition',
        id: 'my-patient-profile'
      });
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
    });
  });

  describe('#findPackageInfos', () => {
    let packageDb: SQLJSPackageDB;

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
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

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.findPackageInfos('*');
      }).toThrow(/SQLJSPackageDB not initialized/);
    });

    it('should return all packages when * is passed in as the name', () => {
      const results = packageDb.findPackageInfos('*');
      expect(results).toHaveLength(3);
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
      expect(results).toContainEqual(
        expect.objectContaining({
          name: 'BagelPackage',
          version: '1.0.0',
          packagePath: '/var/data/.fhir/BagelPackage-1.0.0'
        })
      );
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

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
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

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.findPackageInfo('CookiePackage', '1.0.3');
      }).toThrow(/SQLJSPackageDB not initialized/);
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
      version: '3.2.2',
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
      version: '3.2.3',
      sdKind: 'resource',
      sdFlavor: 'Profile',
      packageName: 'SecretPackage',
      packageVersion: '3.2.2'
    };
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      version: '3.2.2',
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
      version: '3.2.2',
      packageName: 'RegularPackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      version: '4.5.6',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
      packageDb.saveResourceInfo(patientProfile);
      packageDb.saveResourceInfo(observationProfile);
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.findResourceInfos('*');
      }).toThrow(/SQLJSPackageDB not initialized/);
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

    it('should find resources where the key matches the resource id and the canonical version matches', () => {
      const resources = packageDb.findResourceInfos('my-value-set|3.2.2');
      expect(resources).toHaveLength(1);
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));

      const resources2 = packageDb.findResourceInfos('my-value-set|4.5.6');
      expect(resources2).toHaveLength(1);
      expect(resources2).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find resources where the key matches the resource name and the canonical version matches', () => {
      const resources = packageDb.findResourceInfos('MyValueSet|3.2.2');
      expect(resources).toHaveLength(1);
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));

      const resources2 = packageDb.findResourceInfos('MyValueSet|4.5.6');
      expect(resources2).toHaveLength(1);
      expect(resources2).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find resources where the key matches the resource url and the canonical version matches', () => {
      const resources = packageDb.findResourceInfos(
        'http://example.org/ValueSets/my-value-set|3.2.2'
      );
      expect(resources).toHaveLength(1);
      expect(resources).toContainEqual(expect.objectContaining(valueSetThree));

      const resources2 = packageDb.findResourceInfos(
        'http://example.org/ValueSets/my-value-set|4.5.6'
      );
      expect(resources2).toHaveLength(1);
      expect(resources2).toContainEqual(expect.objectContaining(valueSetFour));
    });

    it('should find no matches when the canonical version does not match', () => {
      const resources = packageDb.findResourceInfos('my-value-set|9.9.9');
      expect(resources).toHaveLength(0);

      const resources2 = packageDb.findResourceInfos('MyValueSet|9.9.9');
      expect(resources2).toHaveLength(0);

      const resources3 = packageDb.findResourceInfos(
        'http://example.org/ValueSets/my-value-set|9.9.9'
      );
      expect(resources3).toHaveLength(0);
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

    it('should sort results using the ascending order in which resources were loaded (e.g., first in first out) when no sort order is passed in', () => {
      const resources = packageDb.findResourceInfos('*');
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour)
      ]);
    });

    it('should sort results using the ascending order in which resources were loaded (e.g., first in first out) when sort order is ByLoadOrder ascending', () => {
      const resources = packageDb.findResourceInfos('*', { sort: [byLoadOrder(true)] });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour)
      ]);
    });

    it('should sort results using the descending order in which resources were loaded (e.g., last in first out) when sort order is ByLoadOrder descending', () => {
      const resources = packageDb.findResourceInfos('*', { sort: [byLoadOrder(false)] });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(valueSetFour),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(specialExtension),
        expect.objectContaining(observationProfile),
        expect.objectContaining(patientProfile)
      ]);
    });

    it('should sort results using the ascending order of passed in types, then ascending order in which resources were loaded when sort order is ByType', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('StructureDefinition', 'ValueSet')]
      });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour)
      ]);

      // Try it both directions to ensure that options.type is not influencing order
      const resources2 = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('ValueSet', 'StructureDefinition')]
      });
      expect(resources2).toHaveLength(5);
      expect(resources2).toEqual([
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension)
      ]);
    });

    it('should sort results using the ascending order of passed in types, then ascending order in which resources were loaded when sort order is ByType and ByLoadOrder ascending', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('StructureDefinition', 'ValueSet'), byLoadOrder()]
      });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour)
      ]);

      // Try it both directions to ensure that options.type is not influencing order
      const resources2 = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('ValueSet', 'StructureDefinition'), byLoadOrder()]
      });
      expect(resources2).toHaveLength(5);
      expect(resources2).toEqual([
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension)
      ]);
    });

    it('should sort results using the ascending order of passed in types, then descending order in which resources were saved when sort order is ByType and ByLoadOrder descending', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('StructureDefinition', 'ValueSet'), byLoadOrder(false)]
      });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(specialExtension),
        expect.objectContaining(observationProfile),
        expect.objectContaining(patientProfile),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(valueSetThree)
      ]);

      // Try it both directions to ensure that options.type is not influencing order
      const resources2 = packageDb.findResourceInfos('*', {
        type: ['StructureDefinition', 'ValueSet'],
        sort: [byType('ValueSet', 'StructureDefinition'), byLoadOrder(false)]
      });
      expect(resources2).toHaveLength(5);
      expect(resources2).toEqual([
        expect.objectContaining(valueSetFour),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(specialExtension),
        expect.objectContaining(observationProfile),
        expect.objectContaining(patientProfile)
      ]);
    });

    it('should support SD flavors when sorting results using passed in types', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['Profile', 'ValueSet', 'Extension'],
        sort: [byType('Profile', 'ValueSet', 'Extension')]
      });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(specialExtension)
      ]);

      // Try it both directions to ensure that options.type is not influencing order
      const resources2 = packageDb.findResourceInfos('*', {
        type: ['Profile', 'ValueSet', 'Extension'],
        sort: [byType('Extension', 'ValueSet', 'Profile')]
      });
      expect(resources2).toHaveLength(5);
      expect(resources2).toEqual([
        expect.objectContaining(specialExtension),
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile)
      ]);
    });

    it('should put non-ordered types at end when sorting results using passed in types', () => {
      const resources = packageDb.findResourceInfos('*', {
        type: ['Profile', 'ValueSet', 'Extension'],
        sort: [byType('ValueSet', 'Profile')]
      });
      expect(resources).toHaveLength(5);
      expect(resources).toEqual([
        expect.objectContaining(valueSetThree),
        expect.objectContaining(valueSetFour),
        expect.objectContaining(patientProfile),
        expect.objectContaining(observationProfile),
        expect.objectContaining(specialExtension)
      ]);
    });
  });

  describe('#findResourceInfo', () => {
    let packageDb: SQLJSPackageDB;
    const specialExtension: ResourceInfo = {
      resourceType: 'StructureDefinition',
      id: 'a-special-extension',
      name: 'SpecialExtension',
      url: 'http://example.org/Extensions/a-special-extension',
      version: '4.5.6',
      sdFlavor: 'Extension',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };
    const valueSetThree: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      version: '3.2.2',
      packageName: 'RegularPackage',
      packageVersion: '3.2.2'
    };
    const valueSetFour: ResourceInfo = {
      resourceType: 'ValueSet',
      id: 'my-value-set',
      url: 'http://example.org/ValueSets/my-value-set',
      name: 'MyValueSet',
      version: '4.5.6',
      packageName: 'RegularPackage',
      packageVersion: '4.5.6'
    };

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
      packageDb.saveResourceInfo(specialExtension);
      packageDb.saveResourceInfo(valueSetThree);
      packageDb.saveResourceInfo(valueSetFour);
    });

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.findResourceInfo('my-value-set');
      }).toThrow(/SQLJSPackageDB not initialized/);
    });

    it('should return one resource when there is at least one match by resource id', () => {
      const resource = packageDb.findResourceInfo('my-value-set');
      expect(resource).toBeDefined();
      // both valueSetThree and valueSetFour have a matching id,
      // but the first resource added wins.
      expect(resource).toEqual(expect.objectContaining(valueSetThree));
    });

    it('should return one resource when there is at least one match by resource name', () => {
      const resource = packageDb.findResourceInfo('MyValueSet');
      expect(resource).toBeDefined();
      // both valueSetThree and valueSetFour have a matching id,
      // but the first resource added wins.
      expect(resource).toEqual(expect.objectContaining(valueSetThree));
    });

    it('should return one resource when there is at least one match by resource url', () => {
      const resource = packageDb.findResourceInfo('http://example.org/ValueSets/my-value-set');
      expect(resource).toBeDefined();
      // both valueSetThree and valueSetFour have a matching id,
      // but the first resource added wins.
      expect(resource).toEqual(expect.objectContaining(valueSetThree));
    });

    it('should return one resource when there is at least one match by resource id and the canonical version matches', () => {
      const resource = packageDb.findResourceInfo('my-value-set|3.2.2');
      expect(resource).toBeDefined();
      expect(resource).toEqual(expect.objectContaining(valueSetThree));

      const resource2 = packageDb.findResourceInfo('my-value-set|4.5.6');
      expect(resource2).toBeDefined();
      expect(resource2).toEqual(expect.objectContaining(valueSetFour));
    });

    it('should return one resource when there is at least one match by resource name and the canonical version matches', () => {
      const resource = packageDb.findResourceInfo('MyValueSet|3.2.2');
      expect(resource).toBeDefined();
      expect(resource).toEqual(expect.objectContaining(valueSetThree));

      const resource2 = packageDb.findResourceInfo('MyValueSet|4.5.6');
      expect(resource2).toBeDefined();
      expect(resource2).toEqual(expect.objectContaining(valueSetFour));
    });

    it('should return one resource when there is at least one match by resource url and the canonical version matches', () => {
      const resource = packageDb.findResourceInfo(
        'http://example.org/ValueSets/my-value-set|3.2.2'
      );
      expect(resource).toBeDefined();
      expect(resource).toEqual(expect.objectContaining(valueSetThree));

      const resource2 = packageDb.findResourceInfo(
        'http://example.org/ValueSets/my-value-set|4.5.6'
      );
      expect(resource2).toBeDefined();
      expect(resource2).toEqual(expect.objectContaining(valueSetFour));
    });

    it('should return the first loaded resource when there is at least one match and sorted ByLoadOrder ascending', () => {
      const resource = packageDb.findResourceInfo('my-value-set', { sort: [byLoadOrder()] });
      expect(resource).toBeDefined();
      // both valueSetThree and valueSetFour have a matching id,
      // but the first resource added wins.
      expect(resource).toEqual(expect.objectContaining(valueSetThree));
    });

    it('should return the last loaded resource when there is at least one match and sorted ByLoadOrder descending', () => {
      const resource = packageDb.findResourceInfo('my-value-set', {
        sort: [byLoadOrder(false)]
      });
      expect(resource).toBeDefined();
      // both valueSetThree and valueSetFour have a matching id,
      // but the last resource added wins.
      expect(resource).toEqual(expect.objectContaining(valueSetFour));
    });

    it('should return first loaded resource for wildcard search when no types are passed in', () => {
      const resource = packageDb.findResourceInfo('*');
      expect(resource).toEqual(expect.objectContaining(specialExtension));
    });

    it('should return first loaded resource for wildcard search when no types are passed in and sorted ByLoadOrder ascending', () => {
      const resource = packageDb.findResourceInfo('*', { sort: [byLoadOrder()] });
      expect(resource).toEqual(expect.objectContaining(specialExtension));
    });

    it('should return last loaded resource for wildcard search when no types are passed in and sorted ByLoadOrder descending', () => {
      const resource = packageDb.findResourceInfo('*', { sort: [byLoadOrder(false)] });
      expect(resource).toEqual(expect.objectContaining(valueSetFour));
    });

    it('should return resource of first matching type when types are passed in', () => {
      const resource = packageDb.findResourceInfo('*', {
        type: ['StructureDefinition', 'ValueSet']
      });
      expect(resource).toEqual(expect.objectContaining(specialExtension));
    });

    it('should support SD flavors when types are passed in', () => {
      const resource = packageDb.findResourceInfo('*', {
        type: ['Profile', 'Extension', 'ValueSet']
      });
      expect(resource).toEqual(expect.objectContaining(specialExtension));
    });

    it('should return undefined when there are no matches', () => {
      const resource = packageDb.findResourceInfo('nonexistent-profile');
      expect(resource).toBeUndefined();
    });

    it('should return undefined when the canonical version does not match', () => {
      const resource = packageDb.findResourceInfo('my-value-set|9.9.9');
      expect(resource).toBeUndefined();

      const resource2 = packageDb.findResourceInfo('MyValueSet|9.9.9');
      expect(resource2).toBeUndefined();

      const resource3 = packageDb.findResourceInfo(
        'http://example.org/ValueSets/my-value-set|9.9.9'
      );
      expect(resource3).toBeUndefined();
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

    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
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

    it('should throw if the db has not been initialized', () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      expect(() => {
        uninitializedPackageDB.getPackageStats('CookiePackage', '4.5.6');
      }).toThrow(/SQLJSPackageDB not initialized/);
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

  describe('#exportDB', () => {
    let packageDb: SQLJSPackageDB;
    beforeEach(async () => {
      packageDb = await createSQLJSPackageDB();
      packageDb.savePackageInfo({
        name: 'CookiePackage',
        version: '3.2.2',
        packagePath: '/var/data/.fhir/CookiePackage-3.2.2'
      });
    });

    it('should throw if the db has not been initialized', async () => {
      const uninitializedPackageDB = new SQLJSPackageDB();
      await expect(uninitializedPackageDB.exportDB()).rejects.toThrow(
        /SQLJSPackageDB not initialized/
      );
    });

    it('should return an object with the correct mimetype and some data', async () => {
      const result = await packageDb.exportDB();
      expect(result).toBeDefined();
      expect(result.mimeType).toEqual('application/x-sqlite3');
      // Testing the actual export data for correctness would be tedious, so just check that it's there
      expect(result.data).toBeDefined();
    });
  });
});
