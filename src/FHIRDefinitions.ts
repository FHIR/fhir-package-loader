import { cloneDeep } from 'lodash';

/** Class representing the FHIR definitions in one or more FHIR packages */
export class FHIRDefinitions {
  protected resources: Map<string, any>;
  protected logicals: Map<string, any>;
  protected profiles: Map<string, any>;
  protected extensions: Map<string, any>;
  protected types: Map<string, any>;
  protected valueSets: Map<string, any>;
  protected codeSystems: Map<string, any>;
  protected implementationGuides: Map<string, any>;
  protected packageJsons: Map<string, any>;
  childFHIRDefs: FHIRDefinitions[];
  package: string;
  unsuccessfulPackageLoad: boolean;

  /** Create a FHIRDefinitions */
  constructor() {
    this.package = '';
    this.resources = new Map();
    this.logicals = new Map();
    this.profiles = new Map();
    this.extensions = new Map();
    this.types = new Map();
    this.valueSets = new Map();
    this.codeSystems = new Map();
    this.implementationGuides = new Map();
    this.packageJsons = new Map();
    this.childFHIRDefs = [];
    this.unsuccessfulPackageLoad = false;
  }

  /** Get the total number of definitions */
  size(): number {
    return (
      this.resources.size +
      this.logicals.size +
      this.profiles.size +
      this.extensions.size +
      this.types.size +
      this.valueSets.size +
      this.codeSystems.size +
      this.implementationGuides.size +
      this.childFHIRDefs.map(def => def.size()).reduce((a, b) => a + b, 0)
    );
  }

  // NOTE: These all return clones of the JSON to prevent the source values from being overwritten

  /**
   * Get all resources
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of resources
   */
  allResources(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allResources(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let resources = this.resources;
    if (fhirPackage) {
      resources = new Map();
      if (this.package === fhirPackage) {
        resources = this.resources;
      }
    }
    return cloneJsonMapValues(resources).concat(childValues);
  }

  /**
   * Get all logicals
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of logicals
   */
  allLogicals(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allLogicals(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let logicals = this.logicals;
    if (fhirPackage) {
      logicals = new Map();
      if (this.package === fhirPackage) {
        logicals = this.logicals;
      }
    }
    return cloneJsonMapValues(logicals).concat(childValues);
  }

  /**
   * Get all profiles
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of profiles
   */
  allProfiles(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allProfiles(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let profiles = this.profiles;
    if (fhirPackage) {
      profiles = new Map();
      if (this.package === fhirPackage) {
        profiles = this.profiles;
      }
    }
    return cloneJsonMapValues(profiles).concat(childValues);
  }

  /**
   * Get all extensions
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of extensions
   */
  allExtensions(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allExtensions(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let extensions = this.extensions;
    if (fhirPackage) {
      extensions = new Map();
      if (this.package === fhirPackage) {
        extensions = this.extensions;
      }
    }
    return cloneJsonMapValues(extensions).concat(childValues);
  }

  /**
   * Get all types
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of types
   */
  allTypes(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allTypes(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let types = this.types;
    if (fhirPackage) {
      types = new Map();
      if (this.package === fhirPackage) {
        types = this.types;
      }
    }
    return cloneJsonMapValues(types).concat(childValues);
  }

  /**
   * Get all value sets
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of value sets
   */
  allValueSets(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allValueSets(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let valueSets = this.valueSets;
    if (fhirPackage) {
      valueSets = new Map();
      if (this.package === fhirPackage) {
        valueSets = this.valueSets;
      }
    }
    return cloneJsonMapValues(valueSets).concat(childValues);
  }

  /**
   * Get all code systems
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of code systems
   */
  allCodeSystems(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allCodeSystems(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let codeSystems = this.codeSystems;
    if (fhirPackage) {
      codeSystems = new Map();
      if (this.package === fhirPackage) {
        codeSystems = this.codeSystems;
      }
    }
    return cloneJsonMapValues(codeSystems).concat(childValues);
  }

  /**
   * Get all implementation guides
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of implementation guides
   */
  allImplementationGuides(fhirPackage?: string): any[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allImplementationGuides(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    let implementationGuides = this.implementationGuides;
    if (fhirPackage) {
      implementationGuides = new Map();
      if (this.package === fhirPackage) {
        implementationGuides = this.implementationGuides;
      }
    }
    return cloneJsonMapValues(implementationGuides).concat(childValues);
  }

  /**
   * Get a list of packages that encountered errors while downloaded and were not loaded
   * @param {string} [fhirPackage] - The package (packageId#version) to search in. If not provided, searches all packages.
   * @returns array of packages (packageId#version) that were not successfully loaded
   */
  allUnsuccessfulPackageLoads(fhirPackage?: string): string[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allUnsuccessfulPackageLoads(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    if (fhirPackage) {
      if (this.package === fhirPackage && this.unsuccessfulPackageLoad) {
        return childValues.concat(this.package);
      }
    } else if (this.unsuccessfulPackageLoad) {
      return childValues.concat(this.package);
    }
    return childValues;
  }

  /**
   * Get a list of all packages that are contained in this FHIRDefinitions
   * @param {string} [fhirPackage] The package (packageId#version) to get all packages from. If not provided, all packages are returned.
   * @returns array of packages (packageId#version) that are loaded
   */
  allPackages(fhirPackage?: string): string[] {
    const childValues = this.childFHIRDefs
      .map(def => def.allPackages(fhirPackage))
      .reduce((a, b) => a.concat(b), []);
    if (fhirPackage) {
      if (this.package === fhirPackage && this.package !== '') {
        return childValues.concat(this.package);
      }
    } else if (this.package !== '') {
      return childValues.concat(this.package);
    }
    return childValues;
  }

  /**
   * Add a definition
   * @param definition - The definition to add
   */
  add(definition: any): void {
    if (definition.resourceType === 'StructureDefinition') {
      if (
        definition.type === 'Extension' &&
        definition.baseDefinition !== 'http://hl7.org/fhir/StructureDefinition/Element'
      ) {
        addDefinitionToMap(definition, this.extensions);
      } else if (
        definition.kind === 'primitive-type' ||
        definition.kind === 'complex-type' ||
        definition.kind === 'datatype'
      ) {
        addDefinitionToMap(definition, this.types);
      } else if (definition.kind === 'resource') {
        if (definition.derivation === 'constraint') {
          addDefinitionToMap(definition, this.profiles);
        } else {
          addDefinitionToMap(definition, this.resources);
        }
      } else if (definition.kind === 'logical') {
        if (definition.derivation === 'specialization') {
          addDefinitionToMap(definition, this.logicals);
        } else {
          addDefinitionToMap(definition, this.profiles);
        }
      }
    } else if (definition.resourceType === 'ValueSet') {
      addDefinitionToMap(definition, this.valueSets);
    } else if (definition.resourceType === 'CodeSystem') {
      addDefinitionToMap(definition, this.codeSystems);
    } else if (definition.resourceType === 'ImplementationGuide') {
      addDefinitionToMap(definition, this.implementationGuides);
    }
  }

  /**
   * Add a package.json
   * @param {string} id - package id
   * @param {string} definition - package JSON definition
   */
  addPackageJson(id: string, definition: any): void {
    this.packageJsons.set(id, definition);
  }

  /**
   * Get a package's package.json
   * @param {string} id - package id
   * @returns package.json definition
   */
  getPackageJson(id: string): any {
    return this.packageJsons.get(id);
  }

  /**
   * Private function for search through current FHIRDefinitions and all childFHIRDefs
   * for a specified definition. Uses get for efficient retrieves.
   * Breath-first search through childFHIRDefinitions for the item.
   * @param item name, id, or url of definition to find
   * @param map name of the map to search in
   * @returns definition or undefined if it is not found
   */
  private getDefinition(item: string, map: maps): any | undefined {
    const defsToSearch: FHIRDefinitions[] = [this];
    while (defsToSearch.length > 0) {
      const currentFHIRDefs = defsToSearch.shift();
      const def = currentFHIRDefs[map].get(item);
      if (def) {
        return def;
      }
      if (currentFHIRDefs.childFHIRDefs.length > 0) {
        defsToSearch.push(...currentFHIRDefs.childFHIRDefs);
      }
    }

    return;
  }

  /**
   * Search for a definition based on the type it could be
   * @param {string} item - the item to search for
   * @param {Type[]} types - the possible type the item could be
   * @returns the definition that is returned or undefined if none is found
   */
  fishForFHIR(item: string, ...types: Type[]): any | undefined {
    // No types passed in means to search ALL supported types
    if (types.length === 0) {
      types = [
        Type.Resource,
        Type.Logical,
        Type.Type,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.CodeSystem
      ];
    }

    for (const type of types) {
      let def;
      switch (type) {
        case Type.Resource:
          def = cloneDeep(this.getDefinition(item, 'resources'));
          break;
        case Type.Logical:
          def = cloneDeep(this.getDefinition(item, 'logicals'));
          break;
        case Type.Type:
          def = cloneDeep(this.getDefinition(item, 'types'));
          break;
        case Type.Profile:
          def = cloneDeep(this.getDefinition(item, 'profiles'));
          break;
        case Type.Extension:
          def = cloneDeep(this.getDefinition(item, 'extensions'));
          break;
        case Type.ValueSet:
          def = cloneDeep(this.getDefinition(item, 'valueSets'));
          break;
        case Type.CodeSystem:
          def = cloneDeep(this.getDefinition(item, 'codeSystems'));
          break;
        case Type.Instance: // don't support resolving to FHIR instances
        default:
          break;
      }
      if (def) {
        return def;
      }
    }
  }
}

function addDefinitionToMap(def: any, defMap: Map<string, any>): void {
  if (def.id) {
    defMap.set(def.id, def);
  }
  if (def.url) {
    defMap.set(def.url, def);
  }
  if (def.name) {
    defMap.set(def.name, def);
  }
}

function cloneJsonMapValues(map: Map<string, any>): any {
  return Array.from(map.values()).map(v => cloneDeep(v));
}

export enum Type {
  Profile = 'Profile',
  Extension = 'Extension',
  ValueSet = 'ValueSet',
  CodeSystem = 'CodeSystem',
  Instance = 'Instance',
  Invariant = 'Invariant', // NOTE: only defined in FSHTanks, not FHIR defs
  RuleSet = 'RuleSet', // NOTE: only defined in FSHTanks, not FHIR defs
  Mapping = 'Mapping', // NOTE: only defined in FSHTanks, not FHIR defs
  Resource = 'Resource',
  Type = 'Type', // NOTE: only defined in FHIR defs, not FSHTanks
  Logical = 'Logical'
}

// Type to represent the names of the FHIRDefinition maps of definitions
type maps =
  | 'resources'
  | 'logicals'
  | 'profiles'
  | 'extensions'
  | 'types'
  | 'valueSets'
  | 'codeSystems';
