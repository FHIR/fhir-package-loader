import os from 'os';
import path from 'path';
import { DiskBasedPackageCache } from '../cache/DiskBasedPackageCache';
import { BuildDotFhirDotOrgClient } from '../current';
import { createSQLJSPackageDB } from '../db';
import { DefaultRegistryClient } from '../registry';
import { BasePackageLoader, BasePackageLoaderOptions } from './BasePackageLoader';

export async function defaultPackageLoader(options: BasePackageLoaderOptions) {
  const packageDB = await createSQLJSPackageDB();
  const fhirCache = path.join(os.homedir(), '.fhir', 'packages');
  const packageCache = new DiskBasedPackageCache(fhirCache, {
    log: options.log
  });
  const registryClient = new DefaultRegistryClient({ log: options.log });
  const buildClient = new BuildDotFhirDotOrgClient({ log: options.log });
  return new BasePackageLoader(packageDB, packageCache, registryClient, buildClient, options);
}
