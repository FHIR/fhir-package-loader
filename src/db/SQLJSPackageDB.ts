import { Database, Statement } from 'sql.js';
import util from 'util';
import { PackageInfo, PackageStats, ResourceInfo } from '../package';
import { PackageDB } from './PackageDB';

const CREATE_PACKAGE_TABLE =
  'CREATE TABLE package (rowId INTEGER PRIMARY KEY, name char, version char, packagePath char, packageJSONPath char);';
const INSERT_PACKAGE =
  'INSERT INTO package (name, version, packagePath, packageJSONPath) VALUES (:name, :version, :packagePath, :packageJSONPath)';
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
  'resourcePath'
];
const CREATE_RESOURCE_TABLE = `CREATE TABLE resource (rowId INTEGER PRIMARY KEY, ${RESOURCE_PROPERTIES.map(
  p => `${p} char`
).join(', ')});`;
const INSERT_RESOURCE = `INSERT INTO resource (${RESOURCE_PROPERTIES.join(
  ', '
)}) VALUES (${RESOURCE_PROPERTIES.map(p => `:${p}`).join(', ')})`;
const FIND_PACKAGE = 'SELECT * FROM package WHERE name = :name and version = :version LIMIT 1';

export class SQLJSPackageDB implements PackageDB {
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

  savePackageInfo(info: PackageInfo): void {
    const binding: any = {
      ':name': info.name,
      ':version': info.version
    };
    if (info.packagePath) {
      binding[':packagePath'] = info.packagePath;
    }
    if (info.packageJSONPath) {
      binding[':packageJSONPath'] = info.packageJSONPath;
    }
    this.insertPackageStmt.run(binding);
  }

  saveResourceInfo(info: ResourceInfo): void {
    const binding: any = {
      ':resourceType': info.resourceType
    };
    if (info.id) {
      binding[':id'] = info.id;
    }
    if (info.url) {
      binding[':url'] = info.url;
    }
    if (info.name) {
      binding[':name'] = info.name;
    }
    if (info.version) {
      binding[':version'] = info.version;
    }
    if (info.sdKind) {
      binding[':sdKind'] = info.sdKind;
    }
    if (info.sdDerivation) {
      binding[':sdDerivation'] = info.sdDerivation;
    }
    if (info.sdType) {
      binding[':sdType'] = info.sdType;
    }
    if (info.sdBaseDefinition) {
      binding[':sdBaseDefinition'] = info.sdBaseDefinition;
    }
    if (info.packageName) {
      binding[':packageName'] = info.packageName;
    }
    if (info.packageVersion) {
      binding[':packageVersion'] = info.packageVersion;
    }
    if (info.resourcePath) {
      binding[':resourcePath'] = info.resourcePath;
    }
    this.insertResourceStmt.run(binding);
  }

  findPackageInfo(name: string, version: string): PackageInfo | undefined {
    try {
      this.findPackageStmt.bind({ ':name': name, ':version': version });
      if (this.findPackageStmt.step()) {
        return this.findPackageStmt.getAsObject() as PackageInfo;
      }
    } finally {
      this.findPackageStmt.reset();
    }
  }

  findResourceInfos(key: string): ResourceInfo[] {
    // TODO: Upgrade to class-level property once query and parameters are sorted out
    const stmt = this.db.prepare(
      'SELECT * FROM resource WHERE id = :key OR name = :key OR url = :key'
    );
    stmt.bind({ ':key': key });
    const results: ResourceInfo[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as ResourceInfo);
    }
    stmt.free();
    return results;
  }

  findResourceInfo(key: string): ResourceInfo | undefined {
    // TODO: Make this more sophisticate if/when it makes sense
    const results = this.findResourceInfos(key);
    if (results.length > 0) {
      return results[0];
    }
  }

  getPackageStats(name: string, version: string): PackageStats | undefined {
    const pkg = this.findPackageInfo(name, version);
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
