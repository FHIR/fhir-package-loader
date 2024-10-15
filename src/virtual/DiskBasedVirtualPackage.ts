import fs from 'fs-extra';
import path from 'path';
import { Fhir as FHIRConverter } from 'fhir/fhir';
import { PackageJSON } from '../package/PackageJSON';
import { LogFunction } from '../utils/logger';
import { VirtualPackage, VirtualPackageOptions } from './VirtualPackage';

export class DiskBasedVirtualPackage implements VirtualPackage {
  private log: LogFunction;
  private fhirConverter: FHIRConverter;

  constructor(
    private packageJSON: PackageJSON,
    private paths: string[] = [],
    options: VirtualPackageOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.fhirConverter = new FHIRConverter();
  }

  async registerResources(register: (key: string, resource: any) => void): Promise<void> {
    const spreadSheetCounts = new Map<string, number>();
    const invalidFileCounts = new Map<string, number>();

    const filePaths = getFilePaths(this.paths);
    for (const filePath of filePaths) {
      try {
        const name = path.basename(filePath);
        const parent = path.dirname(filePath);
        // Is it a potential resource?
        if (/\.json$/i.test(name)) {
          // TODO: Error handling?
          register(filePath, this.getResourceByKey(filePath));
        } else if (/-spreadsheet.xml/i.test(name)) {
          spreadSheetCounts.set(parent, (spreadSheetCounts.get(parent) ?? 0) + 1);
          this.log('debug', `Skipped spreadsheet XML file: ${filePath}`);
        } else if (/\.xml/i.test(name)) {
          const xml = fs.readFileSync(filePath).toString();
          if (/<\?mso-application progid="Excel\.Sheet"\?>/m.test(xml)) {
            spreadSheetCounts.set(parent, (spreadSheetCounts.get(parent) ?? 0) + 1);
            this.log('debug', `Skipped spreadsheet XML file: ${filePath}`);
          }
          // TODO: Error handling?
          register(filePath, this.getResourceByKey(filePath));
        } else {
          invalidFileCounts.set(parent, (invalidFileCounts.get(parent) ?? 0) + 1);
          this.log('debug', `Skipped non-JSON / non-XML file: ${filePath}`);
        }
      } catch {
        this.log('error', `Failed to load resource from path: ${filePath}`);
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
      try {
        const xml = fs.readFileSync(key).toString();
        resource = this.fhirConverter.xmlToObj(xml);
      } catch {
        throw new Error(`Failed to get XML resource at path ${key}`);
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

function getFilePaths(paths: string[]): string[] {
  const filePaths: string[] = [];
  paths.forEach(p => {
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      filePaths.push(path.resolve(p));
    } else if (stat.isDirectory()) {
      fs.readdirSync(p, { withFileTypes: true }).forEach(entry => {
        // NOTE: This is not a recursive crawl, so we only care about files
        if (entry.isFile) {
          filePaths.push(path.resolve(entry.parentPath, entry.name));
        }
      });
    }
  });
  return filePaths;
}
