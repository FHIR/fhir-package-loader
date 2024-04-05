import initSqlJs from 'sql.js';
import { PackageDB } from './PackageDB';

async function main() {
  const SQL = await initSqlJs();

  const packageDB = new PackageDB(new SQL.Database());
  console.log('========== TEST REGISTER PACKAGE AT PATH ==========');
  console.log(
    "registerPackageAtPath('/Users/cmoesel/.fhir/packages/hl7.fhir.us.core#6.1.0'):",
    await packageDB.registerPackageAtPath('/Users/cmoesel/.fhir/packages/hl7.fhir.us.core#6.1.0')
  );
  console.log('========== TEST FIND PACKAGE ==========');
  console.log(
    "findPackage('hl7.fhir.us.core', '6.1.0'):",
    packageDB.findPackage('hl7.fhir.us.core', '6.1.0')
  );
  console.log('========== TEST GET PACKAGE STATS ==========');
  console.log(
    "getPackageStats('hl7.fhir.us.core', '6.1.0'):",
    packageDB.getPackageStats('hl7.fhir.us.core', '6.1.0')
  );
  console.log('========== TEST FIND IG RESOURCE ==========');
  console.log("findResources('hl7.fhir.us.core'):", packageDB.findResources('hl7.fhir.us.core'));
  console.log('========== TEST FIND PATIENT PROFILE BY NAME ==========');
  console.log(
    "findResources('USCorePatientProfile'):",
    packageDB.findResources('USCorePatientProfile')
  );
  console.log('========== TEST FIND PATIENT PROFILE BY ID ==========');
  console.log("findResources('us-core-patient'):", packageDB.findResources('us-core-patient'));
  console.log('========== TEST FIND PATIENT PROFILE BY URL ==========');
  console.log(
    "findResources('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'):",
    packageDB.findResources('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient')
  );
  console.log(
    '========== TEST REGISTER PACKAGE AT PATH WITH NAME AND VERSION OVERRIDES =========='
  );
  console.log(
    "registerPackageAtPath('/Users/cmoesel/.fhir/packages/hl7.fhir.us.vrdr#current', 'override.vrdr', 'current'):",
    await packageDB.registerPackageAtPath(
      '/Users/cmoesel/.fhir/packages/hl7.fhir.us.vrdr#current',
      'override.vrdr',
      'current'
    )
  );
  console.log('========== TEST FIND PACKAGE WITH NAME AND VERSION OVERRIDES ==========');
  console.log(
    "findPackage('override.vrdr', 'current'):",
    packageDB.findPackage('override.vrdr', 'current')
  );
  console.log('========== TEST GET PACKAGE STATS WITH NAME AND VERSION OVERRIDES ==========');
  console.log(
    "getPackageStats('override.vrdr', 'current'):",
    packageDB.getPackageStats('override.vrdr', 'current')
  );
  console.log(
    '========== TEST FIND PATIENT PROFILE BY NAME FROM PACKAGE WITH NAME AND VERSION OVERRIDES =========='
  );
  console.log("findResources('Decedent'):", packageDB.findResources('Decedent'));
  console.log('========== TEST REGISTER PACKAGE INFO ==========');
  packageDB.clear();
  console.log('Clearing all previous registrations in database...');
  console.log(
    "registerPackageInfo('hl7.fhir.us.core','6.1.0'):",
    await packageDB.registerPackageInfo('hl7.fhir.us.core', '6.1.0')
  );
  console.log('========== TEST REGISTER RESOURCE AT PATH ==========');
  console.log(
    ".registerResourceAtPath('/Users/cmoesel/.fhir/packages/hl7.fhir.us.core#6.1.0/package/StructureDefinition-us-core-patient.json', 'hl7.fhir.us.core','6.1.0')",
    await packageDB.registerResourceAtPath(
      '/Users/cmoesel/.fhir/packages/hl7.fhir.us.core#6.1.0/package/StructureDefinition-us-core-patient.json',
      'hl7.fhir.us.core',
      '6.1.0'
    )
  );
  console.log('========== TEST FIND PACKAGE REGISTERED WITH INFO ==========');
  console.log(
    "findPackage('hl7.fhir.us.core', '6.1.0'):",
    packageDB.findPackage('hl7.fhir.us.core', '6.1.0')
  );
  console.log('========== TEST GET PACKAGE STATS FOR PACKAGE REGISTERED WITH INFO ==========');
  console.log(
    "getPackageStats('hl7.fhir.us.core', '6.1.0'):",
    packageDB.getPackageStats('hl7.fhir.us.core', '6.1.0')
  );
  console.log(
    '========== TEST FIND PATIENT PROFILE BY NAME FROM PACKAGE REGISTERED WITH INFO =========='
  );
  console.log(
    "findResources('USCorePatientProfile'):",
    packageDB.findResources('USCorePatientProfile')
  );
  console.log('========== TEST REGISTER WRONG PACKAGE ==========');
  let result: any;
  try {
    result = await packageDB.registerPackageAtPath(
      '/Users/cmoesel/.fhir/packages/hl7.fhir.america.core#6.1.0'
    );
  } catch (e) {
    result = `Caught ${e.constructor.name}: ${e.message}`;
  }
  console.log(
    "registerPackageAtPath('/Users/cmoesel/.fhir/packages/hl7.fhir.america.core#6.1.0'):",
    result
  );
  console.log('========== TEST FIND PACKAGE WITH WRONG NAME ==========');
  console.log(
    "findPackage('hl7.fhir.america.core', '6.1.0'):",
    packageDB.findPackage('hl7.fhir.america.core', '6.1.0')
  );
  console.log('========== TEST FIND PACKAGE WITH WRONG VERSION ==========');
  console.log(
    "findPackage('hl7.fhir.us.core', '3.1.0'):",
    packageDB.findPackage('hl7.fhir.us.core', '3.1.0')
  );
  console.log('========== TEST GET PACKAGE STATS WITH WRONG NAME ==========');
  console.log(
    "getPackageStats('hl7.fhir.america.core', '6.1.0'):",
    packageDB.getPackageStats('hl7.fhir.america.core', '6.1.0')
  );
  console.log('========== TEST GET PACKAGE STATS WITH WRONG VERSION ==========');
  console.log(
    "getPackageStats('hl7.fhir.us.core', '3.1.0'):",
    packageDB.getPackageStats('hl7.fhir.us.core', '3.1.0')
  );
  console.log('========== TEST FIND WRONG RESOURCE ==========');
  console.log("findResources('spongebob'):", packageDB.findResources('spongebob'));

  // console.log('========== LOG PACKAGE TABLE ==========');
  // packageDB.logPackageTable();
  // console.log('========== LOG RESOURCE TABLE ==========');
  // packageDB.logResourceTable();
}

main();
