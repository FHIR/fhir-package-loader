import os from 'os';
import path from 'path';
import initSqlJs from 'sql.js';
import { BuildDotFhirDotOrgClient } from '../current';
import { SQLJSPackageDB } from '../db';
import { DefaultRegistryClient } from '../registry';
import { DiskBasedPackageCache } from '../cache/DiskBasedPackageCache';
import { BasePackageLoader, BasePackageLoaderOptions } from './BasePackageLoader';

export async function defaultPackageLoader(options: BasePackageLoaderOptions) {
  return defaultPackageLoaderWithLocalResources([], options);
}

export async function defaultPackageLoaderWithLocalResources(
  localResourceFolders: string[],
  options: BasePackageLoaderOptions
) {
  const SQL = await initSqlJs();
  const packageDB = new SQLJSPackageDB(new SQL.Database());
  const fhirCache = path.join(os.homedir(), '.fhir', 'packages');
  const packageCache = new DiskBasedPackageCache(fhirCache, localResourceFolders, {
    log: options.log
  });
  const registryClient = new DefaultRegistryClient({ log: options.log });
  const buildClient = new BuildDotFhirDotOrgClient({ log: options.log });
  return new BasePackageLoader(packageDB, packageCache, registryClient, buildClient, {
    log: options.log
  });
}
