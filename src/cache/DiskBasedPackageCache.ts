import path from 'path';
import fs from 'fs-extra';
import { LogFunction } from '../utils';
import {
  PackageCache,
  PackageCacheOptions,
  LOCAL_PACKAGE_NAME,
  LOCAL_PACKAGE_VERSION
} from './PackageCache';
import temp from 'temp';
import tar from 'tar';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { LRUCache } from 'mnemonist';
import { Fhir as FHIRConverter } from 'fhir/fhir';

export class DiskBasedPackageCache implements PackageCache {
  private log: LogFunction;
  private localResourceFolders: string[];
  private fhirConverter: FHIRConverter;
  private lruCache: LRUCache<string, any>;

  constructor(
    private cachePath: string,
    localResourceFolders: string[] = [],
    options: PackageCacheOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.localResourceFolders = localResourceFolders.map(f => path.resolve(f));
    this.fhirConverter = new FHIRConverter();
    // TODO: Make Cache Size Configurable
    this.lruCache = new LRUCache<string, any>(500);
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
    if (isLocalPackage(name, version)) {
      return true;
    }
    return fs.existsSync(path.resolve(this.cachePath, `${name}#${version}`));
  }

  getPackagePath(name: string, version: string): string | undefined {
    if (this.isPackageInCache(name, version)) {
      if (isLocalPackage(name, version)) {
        return this.localResourceFolders.join(';');
      }
      return path.resolve(this.cachePath, `${name}#${version}`);
    }
  }

  getPackageJSONPath(name: string, version: string): string | undefined {
    if (!isLocalPackage(name, version)) {
      const jsonPath = path.resolve(
        this.cachePath,
        `${name}#${version}`,
        'package',
        'package.json'
      );
      if (fs.existsSync(jsonPath)) {
        return jsonPath;
      }
    }
  }

  getPotentialResourcePaths(name: string, version: string): string[] {
    if (!this.isPackageInCache(name, version)) {
      return [];
    }

    if (isLocalPackage(name, version)) {
      const spreadSheetCounts = new Map<string, number>();
      const invalidFileCounts = new Map<string, number>();
      const resourcePaths: string[] = [];
      this.localResourceFolders.forEach(folder => {
        let spreadSheetCount = 0;
        let invalidFileCount = 0;
        fs.readdirSync(folder, { withFileTypes: true })
          .filter(entry => {
            if (!entry.isFile()) {
              return false;
            } else if (/\.json$/i.test(entry.name)) {
              return true;
            } else if (/-spreadsheet.xml/i.test(entry.name)) {
              spreadSheetCount++;
              this.log(
                'debug',
                `Skipped spreadsheet XML file: ${path.resolve(entry.path, entry.name)}`
              );
              return false;
            } else if (/\.xml/i.test(entry.name)) {
              const xml = fs.readFileSync(path.resolve(entry.path, entry.name)).toString();
              if (/<\?mso-application progid="Excel\.Sheet"\?>/m.test(xml)) {
                spreadSheetCount++;
                this.log(
                  'debug',
                  `Skipped spreadsheet XML file: ${path.resolve(entry.path, entry.name)}`
                );
                return false;
              }
              return true;
            }
            invalidFileCount++;
            this.log(
              'debug',
              `Skipped non-JSON / non-XML file: ${path.resolve(entry.path, entry.name)}`
            );
            return false;
          })
          .forEach(entry => resourcePaths.push(path.resolve(entry.path, entry.name)));
        spreadSheetCounts.set(folder, spreadSheetCount);
        invalidFileCounts.set(folder, invalidFileCount);
      });
      spreadSheetCounts.forEach((count, folder) => {
        if (count) {
          this.log(
            'info',
            `Found ${count} spreadsheet(s) in directory: ${folder}. SUSHI does not support spreadsheets, so any resources in the spreadsheets will be ignored. To see the skipped files in the logs, run SUSHI with the "--log-level debug" flag.`
          );
        }
      });
      invalidFileCounts.forEach((count, folder) => {
        if (count) {
          this.log(
            'info',
            `Found ${count} non-JSON / non-XML file(s) in directory: ${folder}. SUSHI only processes resource files with JSON or XML extensions. To see the skipped files in the logs, run SUSHI with the "--log-level debug" flag.`
          );
        }
      });
      return resourcePaths;
    } else {
      const contentPath = path.resolve(this.cachePath, `${name}#${version}`, 'package');
      return fs
        .readdirSync(contentPath, { withFileTypes: true })
        .filter(entry => entry.isFile() && /^[^.].*\.json$/i.test(entry.name))
        .map(entry => path.resolve(entry.path, entry.name));
    }
  }

  getResourceAtPath(resourcePath: string) {
    let resource = this.lruCache.get(resourcePath);
    if (!resource) {
      if (/.xml$/i.test(resourcePath)) {
        // TODO: Consider error handling
        const xml = fs.readFileSync(resourcePath).toString();
        resource = this.fhirConverter.xmlToObj(xml);
      } else {
        resource = fs.readJSONSync(resourcePath);
      }
      this.lruCache.set(resourcePath, resource);
    }
    return resource;
  }
}

function isLocalPackage(name: string, version: string) {
  return name === LOCAL_PACKAGE_NAME && version === LOCAL_PACKAGE_VERSION;
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
