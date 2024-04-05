import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { defaultPackageLoader } from './loader/DefaultPackageLoader';

async function main() {
  const log = (level: string, message: string) => console.log(`${level}: ${message}`);
  const loader = await defaultPackageLoader({ log });

  console.log(
    '######################## STANDARD PACKAGE LOADING TESTS #################################'
  );
  console.log();
  console.log('========== TEST MISSING PACKAGE ==========');
  console.log('Deleting hl7.fhir.us.core#6.1.0 from FHIR cache to force download...');
  fs.removeSync(path.join(os.homedir(), '.fhir', 'packages', 'hl7.fhir.us.core#6.1.0'));
  console.log('US Core 6.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '6.1.0'));
  await loader.loadPackage('hl7.fhir.us.core', '6.1.0');
  console.log('US Core 6.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '6.1.0'));
  console.log('========== TEST EXISTING PACKAGE ==========');
  console.log('Clearing loader to force reloading...');
  loader.clear();
  console.log('US Core 6.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '6.1.0'));
  await loader.loadPackage('hl7.fhir.us.core', '6.1.0');
  console.log('US Core 6.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '6.1.0'));
  console.log();

  console.log(
    '######################## NEEDS FIXING PACKAGE LOADING TESTS #################################'
  );
  console.log();
  console.log('========== TEST MISSING PACKAGE THAT NEEDS FIXING ==========');
  console.log('Deleting hl7.fhir.us.core#3.1.0 from FHIR cache to force download...');
  fs.removeSync(path.join(os.homedir(), '.fhir', 'packages', 'hl7.fhir.us.core#3.1.0'));
  console.log('US Core 3.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '3.1.0'));
  await loader.loadPackage('hl7.fhir.us.core', '3.1.0');
  console.log('US Core 3.1.0 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '3.1.0'));
  console.log();

  console.log(
    '######################## CURRENT PACKAGE LOADING TESTS ##################################'
  );
  console.log();
  console.log('========== TEST MISSING CURRENT PACKAGE ==========');
  console.log('Deleting hl7.fhir.us.core#current from FHIR cache to force download...');
  fs.removeSync(path.join(os.homedir(), '.fhir', 'packages', 'hl7.fhir.us.core#current'));
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  await loader.loadPackage('hl7.fhir.us.core', 'current');
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  console.log('========== TEST UP-TO-DATE CURRENT PACKAGE ==========');
  console.log('Clearing loader to force reloading...');
  loader.clear();
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  await loader.loadPackage('hl7.fhir.us.core', 'current');
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  console.log('========== TEST STALE CURRENT PACKAGE ==========');
  console.log('Clearing loader to force reloading...');
  loader.clear();
  console.log('Modifying local package date to 01-01-2024...');
  const uscJSON = fs.readJSONSync(
    path.join(
      os.homedir(),
      '.fhir',
      'packages',
      'hl7.fhir.us.core#current',
      'package',
      'package.json'
    )
  );
  uscJSON.date = '20240101000000';
  fs.writeJSONSync(
    path.join(
      os.homedir(),
      '.fhir',
      'packages',
      'hl7.fhir.us.core#current',
      'package',
      'package.json'
    ),
    uscJSON
  );
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  await loader.loadPackage('hl7.fhir.us.core', 'current');
  console.log(
    'US Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current')
  );
  console.log();

  console.log(
    '######################## CURRENT$BRANCH PACKAGE LOADING TESTS ###########################'
  );
  console.log();
  console.log('========== TEST MISSING CURRENT$BRANCH PACKAGE ==========');
  console.log('Deleting hl7.fhir.us.vrdr#current$pre-STU3 from FHIR cache to force download...');
  fs.removeSync(path.join(os.homedir(), '.fhir', 'packages', 'hl7.fhir.us.vrdr#current$pre-STU3'));
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  await loader.loadPackage('hl7.fhir.us.vrdr', 'current$pre-STU3');
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  console.log('========== TEST UP-TO-DATE CURRENT$BRANCH PACKAGE ==========');
  console.log('Clearing loader to force reloading...');
  loader.clear();
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  await loader.loadPackage('hl7.fhir.us.vrdr', 'current$pre-STU3');
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  console.log('========== TEST STALE CURRENT$BRANCH PACKAGE ==========');
  console.log('Clearing loader to force reloading...');
  loader.clear();
  console.log('Modifying local package date to 01-01-2024...');
  const vrdrJSON = fs.readJSONSync(
    path.join(
      os.homedir(),
      '.fhir',
      'packages',
      'hl7.fhir.us.vrdr#current$pre-STU3',
      'package',
      'package.json'
    )
  );
  vrdrJSON.date = '20240101000000';
  fs.writeJSONSync(
    path.join(
      os.homedir(),
      '.fhir',
      'packages',
      'hl7.fhir.us.vrdr#current$pre-STU3',
      'package',
      'package.json'
    ),
    vrdrJSON
  );
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  await loader.loadPackage('hl7.fhir.us.vrdr', 'current$pre-STU3');
  console.log(
    'VRDR current$pre-STU3 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.vrdr', 'current$pre-STU3')
  );
  console.log();

  console.log(
    '######################## INVALID PACKAGE LOADING TESTS ##################################'
  );
  console.log();
  console.log('========== TEST PACKAGE WITH WRONG NAME ==========');
  console.log(
    'America Core 6.1.0 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.america.core', '6.1.0')
  );
  await loader.loadPackage('hl7.fhir.america.core', '6.1.0');
  console.log(
    'America Core 6.1.0 loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.america.core', '6.1.0')
  );
  console.log('========== TEST PACKAGE WITH WRONG VERSION ==========');
  console.log('US Core 9.9.9 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '9.9.9'));
  await loader.loadPackage('hl7.fhir.us.core', '9.9.9');
  console.log('US Core 9.9.9 loaded? ', loader.getPackageLoadStatus('hl7.fhir.us.core', '9.9.9'));
  console.log('========== TEST CURRENT PACKAGE WITH WRONG NAME ==========');
  console.log(
    'America Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.america.core', 'current')
  );
  await loader.loadPackage('hl7.fhir.america.core', 'current');
  console.log(
    'America Core current loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.america.core', 'current')
  );
  console.log('========== TEST CURRENT PACKAGE WITH WRONG BRANCH ==========');
  console.log(
    'US Core current$baldeagle loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current$baldeagle')
  );
  await loader.loadPackage('hl7.fhir.us.core', 'current$baldeagle');
  console.log(
    'US Core current$baldeagle loaded? ',
    loader.getPackageLoadStatus('hl7.fhir.us.core', 'current$baldeagle')
  );
  console.log();

  console.log(
    '######################## PACKAGE FINDING TESTS ##########################################'
  );
  console.log('Clearing dabase...');
  loader.clear();
  console.log('Loading hl7.fhir.us.core#6.1.0');
  await loader.loadPackage('hl7.fhir.us.core', '6.1.0');
  console.log();
  console.log('========== TEST FIND PACKAGES ==========');
  console.log("findPackageInfos('hl7.fhir.us.core'):", loader.findPackageInfos('hl7.fhir.us.core'));
  console.log();
  console.log('========== TEST FIND PACKAGE ==========');
  console.log(
    "findPackageInfo('hl7.fhir.us.core', '6.1.0'):",
    loader.findPackageInfo('hl7.fhir.us.core', '6.1.0')
  );
  console.log();

  console.log(
    '######################## INVALID PACKAGE FINDING TESTS ##################################'
  );
  console.log();
  console.log('========== TEST FIND PACKAGES WITH WRONG NAME ==========');
  console.log(
    "findPackageInfo('hl7.fhir.america.core'):",
    loader.findPackageInfos('hl7.fhir.america.core')
  );
  console.log();
  console.log('========== TEST FIND PACKAGE WITH WRONG NAME ==========');
  console.log(
    "findPackageInfo('hl7.fhir.america.core', '6.1.0'):",
    loader.findPackageInfo('hl7.fhir.america.core', '6.1.0')
  );
  console.log('========== TEST FIND PACKAGE WITH WRONG VERSION ==========');
  console.log(
    "findPackageInfo('hl7.fhir.us.core', '3.1.0'):",
    loader.findPackageInfo('hl7.fhir.us.core', '3.1.0')
  );
  console.log();

  console.log(
    '######################## RESOURCE INFO FINDING TESTS #########################################'
  );
  console.log();
  console.log('========== TEST FIND IG RESOURCE INFO (SINGLE) ==========');
  console.log("findResourceInfo('hl7.fhir.us.core'):", loader.findResourceInfo('hl7.fhir.us.core'));
  console.log('========== TEST FIND PATIENT PROFILE INFO BY NAME (MULTIPLE) ==========');
  console.log(
    "findResourceInfos('USCorePatientProfile'):",
    loader.findResourceInfos('USCorePatientProfile')
  );
  console.log('========== TEST FIND PATIENT PROFILE INFO BY ID (MULTIPLE) ==========');
  console.log("findResourceInfos('us-core-patient'):", loader.findResourceInfos('us-core-patient'));
  console.log('========== TEST FIND PATIENT PROFILE INFO BY URL (MULTIPLE) ==========');
  console.log(
    "findResourceInfos('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'):",
    loader.findResourceInfos('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient')
  );
  console.log(
    '========== TEST FIND PATIENT PROFILE INFO BY NAME SCOPED BY PACKAGE NAME) =========='
  );
  console.log(
    "findResourceInfos('USCorePatientProfile', { scope: 'hl7.fhir.us.core' }):",
    loader.findResourceInfo('USCorePatientProfile', { scope: 'hl7.fhir.us.core' })
  );
  console.log(
    '========== TEST FIND PATIENT PROFILE INFO BY NAME SCOPED BY PACKAGE NAME AND VERSION) =========='
  );
  console.log(
    "findResourceInfos('USCorePatientProfile', { scope: 'hl7.fhir.us.core|6.1.0' }):",
    loader.findResourceInfo('USCorePatientProfile', { scope: 'hl7.fhir.us.core|6.1.0' })
  );
  console.log(
    '========== TEST FIND ALL CODESYSTEMS BY NAME SCOPED BY PACKAGE NAME AND VERSION) =========='
  );
  console.log(
    "findResourceInfos('*', { type: ['CodeSystem'], scope: 'hl7.fhir.us.core|6.1.0' }):",
    loader.findResourceInfos('*', { type: ['CodeSystem'], scope: 'hl7.fhir.us.core|6.1.0' })
  );
  console.log();

  console.log(
    '######################## INVALID RESOURCE INFO FINDING TESTS #################################'
  );
  console.log();
  console.log('========== TEST FIND WRONG RESOURCE INFO (SINGLE) ==========');
  console.log("findResourceInfo('spongebob'):", loader.findResourceInfo('spongebob'));
  console.log('========== TEST FIND WRONG RESOURCE INFO (MULTIPLE) ==========');
  console.log("findResourceInfos('spongebob'):", loader.findResourceInfos('spongebob'));
  console.log(
    '========== TEST FIND PATIENT PROFILE INFO BY SCOPED BY WRONG PACKAGE NAME) =========='
  );
  console.log(
    "findResourceInfos('USCorePatientProfile', { scope: 'hl7.fhir.america.core' }):",
    loader.findResourceInfo('USCorePatientProfile', { scope: 'hl7.fhir.america.core' })
  );
  console.log(
    '========== TEST FIND PATIENT PROFILE INFO BY NAME SCOPED BY PACKAGE NAME AND WRONG VERSION) =========='
  );
  console.log(
    "findResourceInfos('USCorePatientProfile', { scope: 'hl7.fhir.us.core|9.9.9' }):",
    loader.findResourceInfo('USCorePatientProfile', { scope: 'hl7.fhir.us.core|9.9.9' })
  );
  console.log();

  console.log(
    '######################## RESOURCE JSON FINDING TESTS #########################################'
  );
  console.log();
  console.log('========== TEST FIND IG RESOURCE JSON (SINGLE) ==========');
  console.log(
    "findResourceJSON('hl7.fhir.us.core'):",
    loader.findResourceJSON('hl7.fhir.us.core')?.id
  );
  console.log('========== TEST FIND PATIENT PROFILE JSON BY NAME (MULTIPLE) ==========');
  console.log(
    "findResources('USCorePatientProfile'):",
    loader.findResourceJSONs('USCorePatientProfile').map(j => j.id)
  );
  console.log('========== TEST FIND PATIENT PROFILE JSON BY ID (MULTIPLE) ==========');
  console.log(
    "findResourceJSONs('us-core-patient'):",
    loader.findResourceJSONs('us-core-patient').map(j => j.id)
  );
  console.log('========== TEST FIND PATIENT PROFILE JSON BY URL (MULTIPLE) ==========');
  console.log(
    "findResourceJSONs('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'):",
    loader
      .findResourceJSONs('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient')
      .map(j => j.id)
  );
  console.log();
}

main();
