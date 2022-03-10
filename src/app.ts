#!/usr/bin/env node

import { program, OptionValues } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { loadDependencies } from './load';
import { logger } from './utils';

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
  npx fpl install hl7.fhir.r5.core@current
  fpl install hl7.fhir.r4.core@4.0.1 hl7.fhir.us.core@4.0.0 --save ./myProject`;
}

async function install(fhirPackages: string[], options: OptionValues) {
  if (options.debug) logger.level = 'debug';

  const packages = fhirPackages.map(dep => dep.replace('@', '#'));
  const cachePath = options.cachePath;

  const logMessage = (level: string, message: string) => {
    logger.log(level, message);
  };

  await loadDependencies(packages, cachePath, logMessage);
}

async function app() {
  program
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
      'list of FHIR packages to load using the format packageId@packageVersion...'
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
