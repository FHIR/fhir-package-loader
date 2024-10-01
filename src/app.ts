#!/usr/bin/env node

import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import initSqlJs from 'sql.js';
import { logger } from './utils';
import { Command, OptionValues } from 'commander';
import { BasePackageLoader } from './loader';
import { SQLJSPackageDB } from './db';
import { DiskBasedPackageCache } from './cache';
import { DefaultRegistryClient } from './registry';
import { BuildDotFhirDotOrgClient } from './current';

function getVersion(): string {
  const packageJSONPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJSONPath)) {
    const sushiVersion = fs.readJSONSync(packageJSONPath)?.version;
    return `FHIR Package Loader v${sushiVersion}`;
  }
  return 'unknown';
}

function getHelpText(): string {
  return `
Examples:
  fpl install hl7.fhir.us.core#current
  fpl install hl7.fhir.us.core#4.0.0 hl7.fhir.us.mcode#2.0.0 --cachePath ./myProject`;
}

async function install(fhirPackages: string[], options: OptionValues) {
  if (options.debug) logger.level = 'debug';
  const log = (level: string, message: string) => {
    logger.log(level, message);
  };

  const SQL = await initSqlJs();
  const packageDB = new SQLJSPackageDB(new SQL.Database());
  const fhirCache = options.cachePath ?? path.join(os.homedir(), '.fhir', 'packages');
  const packageCache = new DiskBasedPackageCache(fhirCache, [], { log });
  const registryClient = new DefaultRegistryClient({ log });
  const buildClient = new BuildDotFhirDotOrgClient({ log });
  const loader = new BasePackageLoader(packageDB, packageCache, registryClient, buildClient, {
    log
  });

  for (const pkg of fhirPackages) {
    const [name, version] = pkg.split(/[#@]/, 2);
    await loader.loadPackage(name, version);
  }
}

async function app() {
  const program = new Command()
    .name('fpl')
    .description('CLI for downloading FHIR packages')
    .addHelpText('after', getHelpText())
    .version(getVersion(), '-v, --version'); // Use -v (instead of default -V)

  program
    .command('install') // could set default
    .description('download and unzip specified FHIR packages')
    .usage('<fhirPackages...> [options]')
    .argument(
      '<fhirPackages...>',
      'list of FHIR packages to load using the format packageId#packageVersion or packageId@packageVersion'
    )
    .option(
      '-c, --cachePath <dir>',
      'where to save packages to and load definitions from (default is the local FHIR cache)'
    )
    .option('-d, --debug', 'output extra debugging information')
    .action(install);

  await program.parseAsync(process.argv);
}

app();
