import { FHIRDefinitions } from './FHIRDefinitions';
import { PackageLoadError, CurrentPackageLoadError } from '../errors';
import { logWithTrack } from '../utils';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import tar from 'tar';
import temp from 'temp';

export async function loadDependencies(
  fhirPackages: string[],
  cachePath: string = path.join(os.homedir(), '.fhir', 'packages'),
  log: (level: string, message: string) => void = () => {}
): Promise<FHIRDefinitions> {
  const promises = fhirPackages.map(fhirPackage => {
    const [fhirPackageId, fhirPackageVersion] = fhirPackage.split('#');
    const fhirDefs = new FHIRDefinitions();
    // Testing Hack: Use exports.loadDependency instead of loadDependency so that this function
    // calls the mocked loadDependency in unit tests.  In normal (non-test) use, this should
    // have no negative effects.
    return exports
      .loadDependency(fhirPackageId, fhirPackageVersion, fhirDefs, cachePath, log)
      .catch((e: Error) => {
        let message = `Failed to load ${fhirPackageId}#${fhirPackageVersion}: ${e.message}`;
        if (/certificate/.test(e.message)) {
          message +=
            '\n\nSometimes this error occurs in corporate or educational environments that use proxies and/or SSL ' +
            'inspection.\nTroubleshooting tips:\n' +
            '  1. If a non-proxied network is available, consider connecting to that network instead.\n' +
            '  2. Set NODE_EXTRA_CA_CERTS as described at https://bit.ly/3ghJqJZ (RECOMMENDED).\n' +
            '  3. Disable certificate validation as described at https://bit.ly/3syjzm7 (NOT RECOMMENDED).\n';
        }
        logWithTrack('error', message, log);
        fhirDefs.unsuccessfulPackageLoad = true;
        fhirDefs.package = `${fhirPackageId}#${fhirPackageVersion}`;
        return fhirDefs;
      });
  });
  return await Promise.all(promises).then(fhirDefs => {
    if (fhirDefs.length > 1) {
      const mainFHIRDefs = new FHIRDefinitions();
      fhirDefs.forEach(v => mainFHIRDefs.childFHIRDefs.push(v));
      return mainFHIRDefs;
    }
    return fhirDefs[0];
  });
}

/**
 * Loads a dependency from user FHIR cache or from online
 * @param {string} packageName - The name of the package to load
 * @param {string} version - The version of the package to load
 * @param {FHIRDefinitions} FHIRDefs - The FHIRDefinitions to load the dependencies into
 * @param {string} cachePath - The path to load the package into
 * @returns {Promise<FHIRDefinitions>} the loaded FHIRDefs
 * @throws {PackageLoadError} when the desired package can't be loaded
 */
export async function loadDependency(
  packageName: string,
  version: string,
  FHIRDefs: FHIRDefinitions,
  cachePath: string = path.join(os.homedir(), '.fhir', 'packages'),
  log: (level: string, message: string) => void = () => {}
): Promise<FHIRDefinitions> {
  let fullPackageName = `${packageName}#${version}`;
  const loadPath = path.join(cachePath, fullPackageName, 'package');
  let loadedPackage: string;

  // First, try to load the package from the local cache
  logWithTrack('info', `Checking ${cachePath} for ${fullPackageName}...`, log);
  loadedPackage = loadFromPath(cachePath, fullPackageName, FHIRDefs);
  if (loadedPackage) {
    logWithTrack('info', `Found ${fullPackageName} in ${cachePath}.`, log);
  } else {
    logWithTrack('info', `Did not find ${fullPackageName} in ${cachePath}.`, log);
  }

  // When a dev package is not present locally, fall back to using the current version
  // as described here https://confluence.hl7.org/pages/viewpage.action?pageId=35718627#IGPublisherDocumentation-DependencyList
  if (version === 'dev' && !loadedPackage) {
    logWithTrack(
      'info',
      `Falling back to ${packageName}#current since ${fullPackageName} is not locally cached. To avoid this, add ${fullPackageName} to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.`,
      log
    );
    version = 'current';
    fullPackageName = `${packageName}#${version}`;
    loadedPackage = loadFromPath(cachePath, fullPackageName, FHIRDefs);
  }

  let packageUrl;
  if (packageName.startsWith('hl7.fhir.r5.') && version === 'current') {
    packageUrl = `https://build.fhir.org/${packageName}.tgz`;
    // TODO: Figure out how to determine if the cached package is current
    // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/Registry.20for.20FHIR.20Core.20packages.20.3E.204.2E0.2E1
    if (loadedPackage) {
      logWithTrack(
        'info',
        `Downloading ${fullPackageName} since FHIR Package Loader cannot determine if the version in ${cachePath} is the most recent build.`,
        log
      );
    }
  } else if (version === 'current') {
    // Even if a local current package is loaded, we must still check that the local package date matches
    // the date on the most recent version on build.fhir.org. If the date does not match, we re-download to the cache
    const baseUrl = 'https://build.fhir.org/ig';
    const res = await axios.get(`${baseUrl}/qas.json`);
    const qaData: { 'package-id': string; date: string; repo: string }[] = res?.data;
    // Find matching packages and sort by date to get the most recent
    let newestPackage;
    if (qaData?.length > 0) {
      const matchingPackages = qaData.filter(p => p['package-id'] === packageName);
      newestPackage = matchingPackages.sort((p1, p2) => {
        return Date.parse(p2['date']) - Date.parse(p1['date']);
      })[0];
    }
    if (newestPackage?.repo) {
      const [org, repo] = newestPackage.repo.split('/');
      const igUrl = `${baseUrl}/${org}/${repo}`;
      // get the package.manifest.json for the newest version of the package on build.fhir.org
      const manifest = await axios.get(`${igUrl}/package.manifest.json`);
      let cachedPackageJSON;
      if (fs.existsSync(path.join(loadPath, 'package.json'))) {
        cachedPackageJSON = fs.readJSONSync(path.join(loadPath, 'package.json'));
      }
      // if the date on the package.manifest.json does not match the date on the cached package
      // set the packageUrl to trigger a re-download of the package
      if (manifest?.data?.date !== cachedPackageJSON?.date) {
        packageUrl = `${igUrl}/package.tgz`;
        if (cachedPackageJSON) {
          logWithTrack(
            'debug',
            `Cached package date for ${fullPackageName} (${formatDate(
              cachedPackageJSON.date
            )}) does not match last build date on build.fhir.org (${formatDate(
              manifest?.data?.date
            )})`,
            log
          );
          logWithTrack(
            'info',
            `Cached package ${fullPackageName} is out of date and will be replaced by the more recent version found on build.fhir.org.`,
            log
          );
        }
      } else {
        logWithTrack(
          'debug',
          `Cached package date for ${fullPackageName} (${formatDate(
            cachedPackageJSON.date
          )}) matches last build date on build.fhir.org (${formatDate(
            manifest?.data?.date
          )}), so the cached package will be used`,
          log
        );
      }
    } else {
      throw new CurrentPackageLoadError(fullPackageName);
    }
  } else if (!loadedPackage) {
    packageUrl = `https://packages.fhir.org/${packageName}/${version}`;
  }

  // If the packageUrl is set, we must download the package from that url, and extract it to our local cache
  if (packageUrl) {
    const doDownload = async (url: string) => {
      logWithTrack('info', `Downloading ${fullPackageName}... ${url}`, log);
      const res = await axios.get(url, {
        responseType: 'arraybuffer'
      });
      if (res?.data) {
        logWithTrack('info', `Downloaded ${fullPackageName}`, log);
        // Create a temporary file and write the package to there
        temp.track();
        const tempFile = temp.openSync();
        fs.writeFileSync(tempFile.path, res.data);
        // Extract the package to a temporary directory
        const tempDirectory = temp.mkdirSync();
        tar.x({
          cwd: tempDirectory,
          file: tempFile.path,
          sync: true,
          strict: true
        });
        cleanCachedPackage(tempDirectory);
        // Add or replace the package in the FHIR cache
        const targetDirectory = path.join(cachePath, fullPackageName);
        if (fs.existsSync(targetDirectory)) {
          fs.removeSync(targetDirectory);
        }
        fs.moveSync(tempDirectory, targetDirectory);
        // Now try to load again from the path
        loadedPackage = loadFromPath(cachePath, fullPackageName, FHIRDefs);
      } else {
        logWithTrack('info', `Unable to download most current version of ${fullPackageName}`, log);
      }
    };
    try {
      await doDownload(packageUrl);
    } catch (e) {
      if (packageUrl === `https://packages.fhir.org/${packageName}/${version}`) {
        // It didn't exist in the normal registry.  Fallback to packages2 registry.
        // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/Registry.20for.20FHIR.20Core.20packages.20.3E.204.2E0.2E1
        // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/fhir.2Edicom/near/262334652
        packageUrl = `https://packages2.fhir.org/packages/${packageName}/${version}`;
        try {
          await doDownload(packageUrl);
        } catch (e) {
          throw new PackageLoadError(fullPackageName);
        }
      } else {
        throw new PackageLoadError(fullPackageName);
      }
    }
  }

  if (!loadedPackage) {
    // If we fail again, then we couldn't get the package locally or from online
    throw new PackageLoadError(fullPackageName);
  }
  logWithTrack('info', `Loaded package ${fullPackageName}`, log);
  return FHIRDefs;
}

/**
 * This function takes a package which contains contents at the same level as the "package" folder, and nests
 * all that content within the "package" folder.
 *
 * A package should have the format described here https://confluence.hl7.org/pages/viewpage.action?pageId=35718629#NPMPackageSpecification-Format
 * in which all contents are within the "package" folder. Some packages (ex US Core 3.1.0) have an incorrect format in which folders
 * are not sub-folders of "package", but are instead at the same level. The IG Publisher fixes these packages as described
 * https://chat.fhir.org/#narrow/stream/215610-shorthand/topic/dev.20dependencies, so we should as well.
 *
 * @param {string} packageDirectory - The directory containing the package
 */
export function cleanCachedPackage(packageDirectory: string): void {
  if (fs.existsSync(path.join(packageDirectory, 'package'))) {
    fs.readdirSync(packageDirectory)
      .filter(file => file !== 'package')
      .forEach(file => {
        fs.renameSync(
          path.join(packageDirectory, file),
          path.join(packageDirectory, 'package', file)
        );
      });
  }
}

/**
 * Locates the targetPackage within the cachePath and loads the set of JSON files into FHIRDefs
 * @param {string} cachePath - The path to the directory containing cached packages
 * @param {string} targetPackage - The name of the package we are trying to load
 * @param {FHIRDefinitions} FHIRDefs - The FHIRDefinitions object to load defs into
 * @returns {string} the name of the loaded package if successful
 */
export function loadFromPath(
  cachePath: string,
  targetPackage: string,
  FHIRDefs: FHIRDefinitions
): string {
  const originalSize = FHIRDefs.size();
  const packages = fs.existsSync(cachePath) ? fs.readdirSync(cachePath) : [];
  const cachedPackage = packages.find(packageName => packageName.toLowerCase() === targetPackage);
  if (cachedPackage) {
    const files = fs.readdirSync(path.join(cachePath, cachedPackage, 'package'));
    for (const file of files) {
      if (file.endsWith('.json')) {
        const def = JSON.parse(
          fs.readFileSync(path.join(cachePath, cachedPackage, 'package', file), 'utf-8').trim()
        );
        FHIRDefs.add(def);
        if (file === 'package.json') {
          FHIRDefs.addPackageJson(targetPackage, def);
        }
      }
    }
  }
  // If we did successfully load definitions, mark this package as loaded
  if (FHIRDefs.size() > originalSize) {
    FHIRDefs.package = targetPackage;
    return targetPackage;
  }
  // If the package has already been loaded, just return the targetPackage string
  if (originalSize > 0) {
    return targetPackage;
  }
}

/**
 * Takes a date in format YYYYMMDDHHmmss and converts to YYYY-MM-DDTHH:mm:ss
 * @param {string} date - The date to format
 * @returns {string} the formatted date
 */
function formatDate(date: string): string {
  return date
    ? date.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
    : '';
}
