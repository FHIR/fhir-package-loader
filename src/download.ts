import path from 'path';
import fs from 'fs-extra';
import tar from 'tar';
import temp from 'temp';
import { LogFunction } from './utils';
import { axiosGet } from './utils/axiosUtils';

export async function downloadPackageTarballToCache(
  name: string,
  version: string,
  url: string,
  cachePath: string,
  log: LogFunction
): Promise<string> {
  const packageLabel = `${name}#${version}`;
  log('info', `Attempting to download ${packageLabel} from ${url}`);
  const res = await axiosGet(url, {
    responseType: 'arraybuffer'
  });
  if (res?.data) {
    log('info', `Downloaded ${packageLabel}`);
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
    const targetDirectory = path.join(cachePath, packageLabel);
    if (fs.existsSync(targetDirectory)) {
      fs.removeSync(targetDirectory);
    }
    fs.moveSync(tempDirectory, targetDirectory);
    log('info', `Cached ${packageLabel} to ${targetDirectory}`);
    return targetDirectory;
  }
  throw new Error(`Failed to download ${packageLabel} from ${url}`);
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
function cleanCachedPackage(packageDirectory: string): void {
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
