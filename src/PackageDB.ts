import path from 'path';
import util from 'util';
import fs from 'fs-extra';
import { Database, Statement } from 'sql.js';
import { PackageStats } from './PackageStats';
import { InvalidPackageError } from './errors/InvalidPackageError';
import { InvalidResourceError } from './errors/InvalidResourceError';

const CREATE_PACKAGE_TABLE =
  'CREATE TABLE package (rowId INTEGER PRIMARY KEY, name char, version char, packagePath char, packageJsonPath char);';
const INSERT_PACKAGE =
  'INSERT INTO package (name, version, packagePath, packageJsonPath) VALUES (:name, :version, :packagePath, :packageJsonPath)';
const RESOURCE_PROPERTIES = [
  'resourceType',
  'id',
  'url',
  'name',
  'version',
  'sdKind',
  'sdDerivation',
  'sdType',
  'sdBaseDefinition',
  'packageName',
  'packageVersion',
  'path'
];
const CREATE_RESOURCE_TABLE = `CREATE TABLE resource (rowId INTEGER PRIMARY KEY, ${RESOURCE_PROPERTIES.map(
  p => `${p} char`
).join(', ')});`;
const INSERT_RESOURCE = `INSERT INTO resource (${RESOURCE_PROPERTIES.join(
  ', '
)}) VALUES (${RESOURCE_PROPERTIES.map(p => `:${p}`).join(', ')})`;
const FIND_PACKAGE = 'SELECT * FROM package WHERE name = :name and version = :version';

export class PackageDB {
  private insertPackageStmt: Statement;
  private insertResourceStmt: Statement;
  private findPackageStmt: Statement;
  constructor(private db: Database, initialize = true) {
    if (initialize) {
      this.db.run([CREATE_PACKAGE_TABLE, CREATE_RESOURCE_TABLE].join(';'));
    }
    this.insertPackageStmt = this.db.prepare(INSERT_PACKAGE);
    this.insertResourceStmt = this.db.prepare(INSERT_RESOURCE);
    this.findPackageStmt = this.db.prepare(FIND_PACKAGE);
  }

  clear() {
    this.db.exec('DELETE FROM package');
    this.db.exec('DELETE FROM resource');
    this.db.exec('VACUUM');
  }

  async registerPackageAtPath(
    packagePath: string,
    overrideName?: string,
    overrideVersion?: string,
    registerResources = true
  ) {
    // Check that we have a valid package
    const packageContentDir = path.join(packagePath, 'package');
    try {
      if (!(await fs.stat(packageContentDir)).isDirectory()) {
        throw new Error(); // will be caught directly below
      }
    } catch (e) {
      throw new InvalidPackageError(
        packagePath,
        `${packageContentDir} does not exist or is not a directory`
      );
    }

    // Load the package.json file
    const packageJSONPath = path.join(packageContentDir, 'package.json');
    let packageJSON = null;
    try {
      packageJSON = await fs.readJSON(packageJSONPath);
    } catch {
      throw new InvalidPackageError(
        packagePath,
        `${packageJSONPath} does not exist or is not a valid JSON file`
      );
    }

    // Get the name and version from the package.json file (or use overrides if applicable)
    const name = overrideName ?? packageJSON.name;
    if (name == null) {
      throw new InvalidPackageError(packagePath, `${packageJSONPath} is missing the name property`);
    }
    const version = overrideVersion ?? packageJSON.version;
    if (version == null) {
      throw new InvalidPackageError(
        packagePath,
        `${packageJSONPath} is missing the version property`
      );
    }

    // Register the package information
    this.registerPackageInfo(name, version, packagePath, packageJSONPath);

    // Register the package's resources (if indicated)
    if (registerResources) {
      const files = await fs.readdir(packageContentDir);
      await Promise.all(
        files.map(async f => {
          const filePath = path.join(packageContentDir, f);
          if (/\.json$/i.test(filePath)) {
            try {
              await this.registerResourceAtPath(filePath, name, version);
            } catch (e) {
              // swallow this error because some JSON files will not be resources
            }
          }
        })
      );
    }

    return this.getPackageStats(name, version);
  }

  registerPackageInfo(
    packageName: string,
    packageVersion: string,
    packagePath?: string,
    packageJSONPath?: string
  ) {
    const binding: any = {
      ':name': packageName,
      ':version': packageVersion
    };
    if (packagePath) {
      binding[':packagePath'] = packagePath;
    }
    if (packageJSONPath) {
      binding[':packageJsonPath'] = packageJSONPath;
    }
    this.insertPackageStmt.run(binding);
  }

  async registerResourceAtPath(filePath: string, packageName?: string, packageVersion?: string) {
    let resourceJSON: any;
    try {
      resourceJSON = await fs.readJSON(filePath);
    } catch (e) {
      throw new InvalidResourceError(filePath, 'invalid FHIR resource file');
    }
    this.registerResourceInfo(resourceJSON, filePath, packageName, packageVersion);
  }

  registerResourceInfo(
    resourceJSON: any,
    resourcePath: string,
    packageName?: string,
    packageVersion?: string
  ) {
    const { resourceType, id, url, name, version } = resourceJSON;
    if (typeof resourceType !== 'string' || resourceType === '') {
      throw new InvalidResourceError(resourcePath, 'resource does not specify its resourceType');
    }
    const preparedData: any = {
      ':resourceType': resourceType,
      ':id': typeof id === 'string' ? id : null,
      ':url': typeof url === 'string' ? url : null,
      ':name': typeof name === 'string' ? name : null,
      ':version': typeof version === 'string' ? version : null,
      ':sdKind': resourceType === 'StructureDefinition' ? resourceJSON.kind ?? null : null,
      ':sdDerivation':
        resourceType === 'StructureDefinition' ? resourceJSON.derivation ?? null : null,
      ':sdType': resourceType === 'StructureDefinition' ? resourceJSON.type ?? null : null,
      ':sdBaseDefinition':
        resourceType === 'StructureDefinition' ? resourceJSON.baseDefinition ?? null : null,
      ':packageName': packageName ?? null,
      ':packageVersion': packageVersion ?? null,
      ':path': path.resolve(resourcePath)
    };
    this.insertResourceStmt.run(preparedData);
  }

  findResources(key: string) {
    const res = this.db.exec(
      'SELECT * FROM resource WHERE id = :key OR name = :key OR url = :key',
      { ':key': key }
    );
    return res.length && res[0].values.length ? res[0].values[0] : [];
  }

  findPackage(name: string, version: string) {
    try {
      this.findPackageStmt.bind({ ':name': name, ':version': version });
      if (this.findPackageStmt.step()) {
        return this.findPackageStmt.getAsObject();
      }
    } finally {
      this.findPackageStmt.reset();
    }
  }

  getPackageStats(name: string, version: string): PackageStats {
    const pkg = this.findPackage(name, version);
    if (pkg == null) {
      return;
    }
    const count = this.db.exec(
      'SELECT COUNT(*) from resource where packageName = :name and packageVersion = :version',
      { ':name': name, ':version': version }
    )[0].values[0][0] as number;
    return {
      name,
      version,
      packageJSON: (pkg.packageJsonPath as string) ?? null,
      resourceCount: count
    };
  }

  logPackageTable() {
    const res = this.db.exec('SELECT * FROM package');
    console.log(util.inspect(res, false, 3, true));
  }

  logResourceTable() {
    const res = this.db.exec('SELECT * FROM resource');
    console.log(util.inspect(res, false, 3, true));
  }
}
