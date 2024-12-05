import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Fhir as FHIRConverter } from 'fhir/fhir';
import fs from 'fs-extra';
import * as tar from 'tar';
import temp from 'temp';
import { LogFunction } from '../utils';
import { PackageCache, PackageCacheOptions } from './PackageCache';

export class DiskBasedPackageCache implements PackageCache {
  private log: LogFunction;
  private fhirConverter: FHIRConverter;

  constructor(
    private cachePath: string,
    options: PackageCacheOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.fhirConverter = new FHIRConverter();
  }

  async cachePackageTarball(name: string, version: string, data: Readable): Promise<string> {
    const packageLabel = `${name}#${version}`;
    // Extract the package to a temporary directory
    temp.track();
    const tempDirectory = temp.mkdirSync();
    await pipeline(data, tar.x({ cwd: tempDirectory }));
    this.log('info', `Downloaded ${packageLabel}`);
    await cleanCachedPackage(tempDirectory);
    // Add or replace the package in the FHIR cache
    const targetDirectory = path.resolve(this.cachePath, packageLabel);
    if (fs.existsSync(targetDirectory)) {
      await fs.remove(targetDirectory);
    }
    await fs.move(tempDirectory, targetDirectory);
    this.log('info', `Cached ${packageLabel} to ${targetDirectory}`);
    return targetDirectory;
  }

  isPackageInCache(name: string, version: string): boolean {
    return fs.existsSync(path.resolve(this.cachePath, `${name}#${version}`));
  }

  getPackagePath(name: string, version: string): string | undefined {
    if (this.isPackageInCache(name, version)) {
      return path.resolve(this.cachePath, `${name}#${version}`);
    }
  }

  getPackageJSONPath(name: string, version: string): string | undefined {
    const jsonPath = path.resolve(this.cachePath, `${name}#${version}`, 'package', 'package.json');
    if (fs.existsSync(jsonPath)) {
      return jsonPath;
    }
  }

  getPotentialResourcePaths(name: string, version: string): string[] {
    if (!this.isPackageInCache(name, version)) {
      return [];
    }

    const contentPath = path.resolve(this.cachePath, `${name}#${version}`, 'package');
    // Since every OS may load paths in a different order, ensure consistency by sorting the final paths
    return fs
      .readdirSync(contentPath, { withFileTypes: true })
      .filter(entry => entry.isFile() && /^[^.].*\.json$/i.test(entry.name))
      .map(entry => path.resolve(entry.path, entry.name))
      .sort();
  }

  getResourceAtPath(resourcePath: string) {
    let resource;
    if (/.xml$/i.test(resourcePath)) {
      try {
        const xml = fs.readFileSync(resourcePath).toString();
        resource = this.fhirConverter.xmlToObj(xml);
      } catch {
        throw new Error(`Failed to get XML resource at path ${resourcePath}`);
      }
    } else if (/.json$/i.test(resourcePath)) {
      try {
        resource = fs.readJSONSync(resourcePath);
      } catch {
        throw new Error(`Failed to get JSON resource at path ${resourcePath}`);
      }
    } else {
      throw new Error(`Failed to find XML or JSON file at path ${resourcePath}`);
    }
    return resource;
  }
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
async function cleanCachedPackage(packageDirectory: string): Promise<void> {
  if (fs.existsSync(path.join(packageDirectory, 'package'))) {
    (await fs.readdir(packageDirectory))
      .filter(file => file !== 'package')
      .forEach(async file => {
        await fs.rename(
          path.join(packageDirectory, file),
          path.join(packageDirectory, 'package', file)
        );
      });
  }
}
