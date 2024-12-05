import os from 'os';
import path from 'path';
import initSqlJs from 'sql.js';
import { BasePackageLoader, BasePackageLoaderOptions } from './BasePackageLoader';
import { DiskBasedPackageCache } from '../cache/DiskBasedPackageCache';
import { BuildDotFhirDotOrgClient } from '../current';
import { SQLJSPackageDB } from '../db';
import { DefaultRegistryClient } from '../registry';

export async function defaultPackageLoader(options: BasePackageLoaderOptions) {
  const SQL = await initSqlJs();
  const packageDB = new SQLJSPackageDB(new SQL.Database());
  const fhirCache = path.join(os.homedir(), '.fhir', 'packages');
  const packageCache = new DiskBasedPackageCache(fhirCache, {
    log: options.log
  });
  const registryClient = new DefaultRegistryClient({ log: options.log });
  const buildClient = new BuildDotFhirDotOrgClient({ log: options.log });
  return new BasePackageLoader(packageDB, packageCache, registryClient, buildClient, options);
}
