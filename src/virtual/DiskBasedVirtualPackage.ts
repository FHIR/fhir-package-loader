import fs from 'fs-extra';
import path from 'path';
import { Fhir as FHIRConverter } from 'fhir/fhir';
import { PackageJSON } from '../package/PackageJSON';
import { LogFunction } from '../utils/logger';
import { VirtualPackage, VirtualPackageOptions } from './VirtualPackage';

export type DiskBasedVirtualPackageOptions = VirtualPackageOptions & {
  recursive?: boolean;
};

export class DiskBasedVirtualPackage implements VirtualPackage {
  private log: LogFunction;
  private allowNonResources: boolean;
  private recursive: boolean;
  private fhirConverter: FHIRConverter;

  constructor(
    private packageJSON: PackageJSON,
    private paths: string[] = [],
    options: DiskBasedVirtualPackageOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.allowNonResources = options.allowNonResources ?? false;
    this.recursive = options.recursive ?? false;
    this.fhirConverter = new FHIRConverter();
  }

  async registerResources(
    register: (key: string, resource: any, allowNonResources?: boolean) => void
  ): Promise<void> {
    const spreadSheetCounts = new Map<string, number>();
    const invalidFileCounts = new Map<string, number>();

    const filePaths = getFilePaths(this.paths, this.recursive);
    for (const filePath of filePaths) {
      try {
        const name = path.basename(filePath);
        const parent = path.dirname(filePath);
        // Is it a potential resource?
        if (/\.json$/i.test(name)) {
          // TODO: Error handling?
          register(filePath, this.getResourceByKey(filePath), this.allowNonResources);
        } else if (/-spreadsheet\.xml$/i.test(name)) {
          spreadSheetCounts.set(parent, (spreadSheetCounts.get(parent) ?? 0) + 1);
          this.log('debug', `Skipped spreadsheet XML file: ${filePath}`);
        } else if (/\.xml$/i.test(name)) {
          const xml = fs.readFileSync(filePath).toString();
          if (/<\?mso-application progid="Excel\.Sheet"\?>/m.test(xml)) {
            spreadSheetCounts.set(parent, (spreadSheetCounts.get(parent) ?? 0) + 1);
            this.log('debug', `Skipped spreadsheet XML file: ${filePath}`);
          }
          // TODO: Error handling?
          register(filePath, this.getResourceByKey(filePath), this.allowNonResources);
        } else {
          invalidFileCounts.set(parent, (invalidFileCounts.get(parent) ?? 0) + 1);
          this.log('debug', `Skipped non-JSON / non-XML file: ${filePath}`);
        }
      } catch (e) {
        if (/convert XML .* Unknown resource type/.test(e.message)) {
          // Skip unknown FHIR resource types. When we have instances of Logical Models,
          // the resourceType will not be recognized as a known FHIR resourceType, but that's okay.
        } else {
          this.log('error', `Failed to load resource from path: ${filePath}`);
          if (e.stack) {
            this.log('debug', e.stack);
          }
        }
      }
    }

    spreadSheetCounts.forEach((count, folder) => {
      if (count) {
        this.log(
          'info',
          `Found ${count} spreadsheet(s) in directory: ${folder}. Spreadsheets are not supported, so any resources in the spreadsheets will be ignored. To see the skipped files in the logs, use debug logging.`
        );
      }
    });
    invalidFileCounts.forEach((count, folder) => {
      if (count) {
        this.log(
          'info',
          `Found ${count} non-JSON / non-XML file(s) in directory: ${folder}. Only resource files with JSON or XML extensions are supported. To see the skipped files in the logs, use debug logging.`
        );
      }
    });
  }

  getPackageJSON(): PackageJSON {
    return this.packageJSON;
  }

  getResourceByKey(key: string) {
    let resource: any;
    if (/.xml$/i.test(key)) {
      let xml: string;
      try {
        xml = fs.readFileSync(key).toString();
      } catch {
        throw new Error(`Failed to get XML resource at path ${key}`);
      }
      try {
        // TODO: Support other versions of FHIR during conversion
        resource = this.fhirConverter.xmlToObj(xml);
      } catch (e) {
        throw new Error(`Failed to convert XML resource at path ${key}: ${e.message}`);
      }
    } else if (/.json$/i.test(key)) {
      try {
        resource = fs.readJSONSync(key);
      } catch {
        throw new Error(`Failed to get JSON resource at path ${key}`);
      }
    } else {
      throw new Error(`Failed to find XML or JSON file at path ${key}`);
    }
    return resource;
  }
}

function getFilePaths(paths: string[], recursive: boolean): string[] {
  const filePaths = new Set<string>();
  paths.forEach(p => {
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      filePaths.add(path.resolve(p));
    } else if (stat.isDirectory()) {
      fs.readdirSync(p, { withFileTypes: true }).forEach(entry => {
        if (entry.isFile()) {
          filePaths.add(path.resolve(entry.parentPath, entry.name));
        } else if (recursive && entry.isDirectory()) {
          getFilePaths([path.resolve(entry.parentPath, entry.name)], recursive).forEach(fp =>
            filePaths.add(fp)
          );
        }
      });
    }
  });
  return Array.from(filePaths);
}
