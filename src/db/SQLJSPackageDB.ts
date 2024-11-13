import { Database, Statement } from 'sql.js';
import util from 'util';
import { FindResourceInfoOptions, PackageInfo, PackageStats, ResourceInfo } from '../package';
import { PackageDB } from './PackageDB';

const CREATE_PACKAGE_TABLE = `CREATE TABLE package (
  rowId INTEGER PRIMARY KEY,
  name CHAR,
  version CHAR,
  packagePath CHAR,
  packageJSONPath CHAR
);`;

const CREATE_PACKAGE_TABLE_INDICES = [
  'CREATE INDEX idx_package_rowid ON package (rowid);',
  'CREATE INDEX idx_package_name_version ON package (name, version);'
].join(' ');

const INSERT_PACKAGE = `INSERT INTO package
  (
    name,
    version,
    packagePath,
    packageJSONPath
  ) VALUES (
    :name,
    :version,
    :packagePath,
    :packageJSONPath
  )`;

const FIND_ALL_PACKAGES = 'SELECT * FROM package';

const FIND_PACKAGES = 'SELECT * FROM package WHERE name = :name';

const FIND_PACKAGE = 'SELECT * FROM package WHERE name = :name and version = :version LIMIT 1';

const CREATE_RESOURCE_TABLE = `CREATE TABLE resource (
  rowId INTEGER PRIMARY KEY,
  resourceType CHAR,
  id CHAR,
  url CHAR,
  name CHAR,
  version CHAR,
  sdKind CHAR,
  sdDerivation CHAR,
  sdType CHAR,
  sdBaseDefinition CHAR,
  sdAbstract BOOL,
  sdImposeProfiles CHAR,
  sdCharacteristics CHAR,
  sdFlavor CHAR,
  packageName CHAR,
  packageVersion CHAR,
  resourcePath CHAR
);`;

const CREATE_RESOURCE_TABLE_INDICES = [
  'CREATE INDEX idx_resource_rowid ON resource (rowid);',
  'CREATE INDEX idx_resource_id ON resource (id);',
  'CREATE INDEX idx_resource_url ON resource (url);',
  'CREATE INDEX idx_resource_name ON resource (name);',
  'CREATE INDEX idx_resource_sdFlavor ON resource (sdFlavor);',
  'CREATE INDEX idx_resource_resourceType ON resource (resourceType);',
  'CREATE INDEX idx_resource_package ON resource (packageName, packageVersion);'
].join(' ');

const INSERT_RESOURCE = `INSERT INTO resource
  (
    resourceType,
    id,
    url,
    name,
    version,
    sdKind,
    sdDerivation,
    sdType,
    sdBaseDefinition,
    sdAbstract,
    sdImposeProfiles,
    sdCharacteristics,
    sdFlavor,
    packageName,
    packageVersion,
    resourcePath
  ) VALUES (
    :resourceType,
    :id,
    :url,
    :name,
    :version,
    :sdKind,
    :sdDerivation,
    :sdType,
    :sdBaseDefinition,
    :sdAbstract,
    :sdImposeProfiles,
    :sdCharacteristics,
    :sdFlavor,
    :packageName,
    :packageVersion,
    :resourcePath
  );`;

const SD_FLAVORS = ['Extension', 'Logical', 'Profile', 'Resource', 'Type'];

export class SQLJSPackageDB implements PackageDB {
  private insertPackageStmt: Statement;
  private insertResourceStmt: Statement;
  private findAllPackagesStmt: Statement;
  private findPackagesStmt: Statement;
  private findPackageStmt: Statement;
  constructor(
    private db: Database,
    initialize = true
  ) {
    if (initialize) {
      this.db.run(
        [
          CREATE_PACKAGE_TABLE,
          CREATE_PACKAGE_TABLE_INDICES,
          CREATE_RESOURCE_TABLE,
          CREATE_RESOURCE_TABLE_INDICES
        ].join(';')
      );
    }
    this.insertPackageStmt = this.db.prepare(INSERT_PACKAGE);
    this.insertResourceStmt = this.db.prepare(INSERT_RESOURCE);
    this.findAllPackagesStmt = this.db.prepare(FIND_ALL_PACKAGES);
    this.findPackagesStmt = this.db.prepare(FIND_PACKAGES);
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
    if (info.resourceType === 'StructureDefinition') {
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
      if (info.sdAbstract != null) {
        binding[':sdAbstract'] = info.sdAbstract;
      }
      if (info.sdImposeProfiles?.length) {
        // Technically we could do this w/ join tables, but that makes
        // more complex, so let's try this simpler solution first.
        binding[':sdImposeProfiles'] = JSON.stringify(info.sdImposeProfiles);
      }
      if (info.sdCharacteristics?.length) {
        // Technically we could do this w/ join tables, but that makes
        // more complex, so let's try this simpler solution first.
        binding[':sdCharacteristics'] = JSON.stringify(info.sdCharacteristics);
      }
      if (info.sdFlavor) {
        binding[':sdFlavor'] = info.sdFlavor;
      }
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

  findPackageInfos(name: string): PackageInfo[] {
    const results: PackageInfo[] = [];
    const findStmt = name === '*' ? this.findAllPackagesStmt : this.findPackagesStmt;
    try {
      if (name !== '*') {
        findStmt.bind({ ':name': name });
      }
      while (findStmt.step()) {
        results.push(findStmt.getAsObject() as PackageInfo);
      }
    } finally {
      findStmt.reset();
    }
    return results;
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

  findResourceInfos(key: string, options: FindResourceInfoOptions = {}): ResourceInfo[] {
    // In case a key wasn't supplied, just use empty string. Later we might have it return ALL.
    if (key == null) {
      key = '';
    }
    // TODO: Upgrade to class-level property once query and parameters are sorted out
    const [keyText, ...keyVersion] = key.split('|');
    const bindStmt: { [key: string]: string } = {};
    let findStmt = 'SELECT * FROM resource WHERE ';
    if (keyText !== '*') {
      // special case for selecting all
      bindStmt[':key'] = keyText;
      findStmt += '(id = :key OR name = :key OR url = :key)';
    } else {
      findStmt += '1';
    }
    if (keyVersion.length) {
      bindStmt[':version'] = keyVersion.join('|');
      findStmt += ' AND version = :version';
    }
    if (options.scope?.length) {
      const [packageName, ...packageVersion] = options.scope.split('|');
      bindStmt[':packageName'] = packageName;
      findStmt += ' AND packageName = :packageName';
      if (packageVersion.length) {
        bindStmt[':packageVersion'] = packageVersion.join('|');
        findStmt += ' AND packageVersion = :packageVersion';
      }
    }
    if (options.type?.length) {
      const conditions = options.type.map((t, i) => {
        bindStmt[`:type${i}`] = t;
        const field = SD_FLAVORS.includes(t) ? 'sdFlavor' : 'resourceType';
        return `${field} = :type${i}`;
      });
      findStmt += ` AND (${conditions.join(' OR ')})`;
    }
    if (options.sort) {
      const sortExpressions: string[] = [];
      options.sort.forEach(s => {
        switch (s.sortBy) {
          case 'LoadOrder':
            sortExpressions.push(`rowId ${s.ascending ? 'ASC' : 'DESC'}`);
            break;
          case 'Type':
            (s.types as string[]).forEach((t, i) => {
              bindStmt[`:sortType${i}`] = t;
              const field = SD_FLAVORS.includes(t) ? 'sdFlavor' : 'resourceType';
              // This sort expression is weird, but... it's the only way it works as expected!
              sortExpressions.push(`(${field} = :sortType${i} OR NULL) DESC`);
            });
            break;
        }
      });
      findStmt += ` ORDER BY ${sortExpressions.join(', ')}`;
    }
    if (options.limit) {
      bindStmt[':limit'] = String(options.limit);
      findStmt += ' LIMIT :limit';
    }

    const stmt = this.db.prepare(findStmt);
    stmt.bind(bindStmt);
    const results: ResourceInfo[] = [];
    while (stmt.step()) {
      const result = stmt.getAsObject() as any;
      if (result.sdImposeProfiles) {
        result.sdImposeProfiles = JSON.parse(result.sdImposeProfiles);
      }
      if (result.sdCharacteristics) {
        result.sdCharacteristics = JSON.parse(result.sdCharacteristics);
      }
      if (result.sdAbstract != null) {
        result.sdAbstract = result.sdAbstract ? true : false;
      }
      results.push(result as ResourceInfo);
    }
    stmt.free();

    return results;
  }

  findResourceInfo(key: string, options: FindResourceInfoOptions = {}): ResourceInfo | undefined {
    // TODO: Make this more sophisticated if/when it makes sense
    const results = this.findResourceInfos(key, { ...options, limit: 1 });
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

  exportDB(): Promise<{ mimeType: string; data: Buffer }> {
    const data = this.db.export();
    return Promise.resolve({ mimeType: 'application/x-sqlite3', data: Buffer.from(data) });
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
