import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { PackageDB } from './PackageDB';
import initSqlJs from 'sql.js';
import { DefaultRegistryClient } from './RegistryClient';
import { BuildDotFHIRClient } from './CurrentBuildClient';
import { PackageLoader } from './PackageLoader';

async function main() {
  const log = (level: string, message: string) => console.log(`${level}: ${message}`);
  const SQL = await initSqlJs();
  const packageDB = new PackageDB(new SQL.Database());
  const registryClient = new DefaultRegistryClient({ log });
  const buildClient = new BuildDotFHIRClient({ log });
  const loader = new PackageLoader(packageDB, registryClient, buildClient, { log });
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
}

main();
