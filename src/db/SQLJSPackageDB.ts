import initSqlJs, { Database, Statement } from 'sql.js';
import { FindResourceInfoOptions, PackageInfo, PackageStats, ResourceInfo } from '../package';
import { PackageDB } from './PackageDB';

const CREATE_PACKAGE_TABLE = `CREATE TABLE package (
  rowid INTEGER PRIMARY KEY,
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
  rowid INTEGER PRIMARY KEY,
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
  'CREATE INDEX idx_resource_id_resourceType_sdFlavor ON resource (id, resourceType, sdFlavor);',
  'CREATE INDEX idx_resource_url_resourceType_sdFlavor ON resource (url, resourceType, sdFlavor);',
  'CREATE INDEX idx_resource_name_resourceType_sdFlavor ON resource (name, resourceType, sdFlavor);',
  'CREATE INDEX idx_resource_sdFlavor ON resource (sdFlavor);',
  'CREATE INDEX idx_resource_resourceType ON resource (resourceType);',
  'CREATE INDEX idx_resource_packageName_packageVersion ON resource (packageName, packageVersion);'
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

type SQLJSPackageDBInitializeOptions = {
  locateFile?: (url: string, scriptDirectory: string) => string; // Based on config option for initSqlJs
};

export class SQLJSPackageDB implements PackageDB {
  private db: Database;
  private insertPackageStmt: Statement;
  private insertResourceStmt: Statement;
  private findAllPackagesStmt: Statement;
  private findPackagesStmt: Statement;
  private findPackageStmt: Statement;
  private optimized: boolean;
  private initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize(options: SQLJSPackageDBInitializeOptions = {}) {
    if (!this.initialized) {
      const SQL = await initSqlJs({
        ...(options.locateFile && { locateFile: options.locateFile })
      });
      // check initialization state once more since initSqlJs call was async (possible race condition)
      if (!this.initialized) {
        this.db = new SQL.Database();
        this.db.run(
          [
            CREATE_PACKAGE_TABLE,
            CREATE_PACKAGE_TABLE_INDICES,
            CREATE_RESOURCE_TABLE,
            CREATE_RESOURCE_TABLE_INDICES
          ].join(';')
        );
        this.insertPackageStmt = this.db.prepare(INSERT_PACKAGE);
        this.insertResourceStmt = this.db.prepare(INSERT_RESOURCE);
        this.findAllPackagesStmt = this.db.prepare(FIND_ALL_PACKAGES);
        this.findPackagesStmt = this.db.prepare(FIND_PACKAGES);
        this.findPackageStmt = this.db.prepare(FIND_PACKAGE);
        this.initialized = true;
        this.optimized = false;
      }
    }
  }

  isInitialized() {
    return this.initialized;
  }

  clear() {
    if (this.db) {
      this.db.exec('DELETE FROM package');
      this.db.exec('DELETE FROM resource');
      this.db.exec('VACUUM');
      this.optimized = false;
    }
  }

  optimize() {
    if (this.db) {
      if (!this.optimized) {
        this.db.exec('PRAGMA optimize=0x10002');
        this.optimized = true;
      } else {
        this.db.exec('PRAGMA optimize');
      }
    }
  }

  savePackageInfo(info: PackageInfo): void {
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
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
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
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
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
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
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
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
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
    // In case a key wasn't supplied, just use empty string. Later we might have it return ALL.
    if (key == null) {
      key = '';
    }
    const [keyText, ...keyVersion] = key.split('|');
    const bindStmt: { [key: string]: string } = {};
    const conditions: string[] = [];
    let findStmt = 'SELECT * FROM resource';
    if (keyText !== '*') {
      // special case for selecting all
      bindStmt[':key'] = keyText;
      conditions.push('(id = :key OR name = :key OR url = :key)');
    }
    if (keyVersion.length) {
      bindStmt[':version'] = keyVersion.join('|');
      conditions.push('version = :version');
    }
    if (options.type?.length) {
      // build condition to take advantage of indices w/ resourceType and sdFlavor
      const sdFlavors: string[] = [];
      const resourceTypes: string[] = [];
      options.type.forEach((t, i) => {
        bindStmt[`:type${i}`] = t;
        (SD_FLAVORS.includes(t) ? sdFlavors : resourceTypes).push(`:type${i}`);
      });
      let rtStatement: string;
      if (resourceTypes.length === 1) {
        rtStatement = `resourceType = ${resourceTypes[0]}`;
      } else if (resourceTypes.length > 1) {
        rtStatement = `resourceType in (${resourceTypes.join(', ')})`;
      }
      let sdfStatement: string;
      if (sdFlavors.length === 1) {
        sdfStatement = `sdFlavor = ${sdFlavors[0]}`;
      } else if (sdFlavors.length > 1) {
        sdfStatement = `sdFlavor in (${sdFlavors.join(', ')})`;
      }
      if (resourceTypes.length) {
        if (sdFlavors.length) {
          conditions.push(`(${rtStatement} OR ${sdfStatement})`);
        } else {
          conditions.push(rtStatement);
        }
      } else {
        conditions.push(`resourceType = "StructureDefinition" AND ${sdfStatement}`);
      }
    }
    if (options.scope?.length) {
      const [packageName, ...packageVersion] = options.scope.split('|');
      bindStmt[':packageName'] = packageName;
      conditions.push('packageName = :packageName');
      if (packageVersion.length) {
        bindStmt[':packageVersion'] = packageVersion.join('|');
        conditions.push('packageVersion = :packageVersion');
      }
    }
    if (conditions.length) {
      findStmt += ` WHERE ${conditions.join(' AND ')}`;
    }
    if (options.sort) {
      const sortExpressions: string[] = [];
      options.sort.forEach(s => {
        switch (s.sortBy) {
          case 'LoadOrder':
            sortExpressions.push(`rowid ${s.ascending ? 'ASC' : 'DESC'}`);
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
    } else {
      findStmt += ' ORDER BY rowid ASC';
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
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
    // TODO: Make this more sophisticated if/when it makes sense
    const results = this.findResourceInfos(key, { ...options, limit: 1 });
    if (results.length > 0) {
      return results[0];
    }
  }

  getPackageStats(name: string, version: string): PackageStats | undefined {
    if (!this.db) {
      throw new Error(
        'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
      );
    }
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

  async exportDB(): Promise<{ mimeType: string; data: Buffer }> {
    if (!this.db) {
      return Promise.reject(
        new Error(
          'SQLJSPackageDB not initialized. Please call the initialize() function before using this class.'
        )
      );
    }
    const data = this.db.export();
    return Promise.resolve({ mimeType: 'application/x-sqlite3', data: Buffer.from(data) });
  }
}

export async function createSQLJSPackageDB(): Promise<SQLJSPackageDB> {
  const packageDB = new SQLJSPackageDB();
  await packageDB.initialize();
  return packageDB;
}
