export type FindResourceInfoOptions = {
  // type can be any FHIR resource type or special "StructureDefinition flavors":
  // - 'Resource': a StructureDefinition w/ kind "resource" & derivation "specialization"
  // - 'Type': a StructureDefinition w/ kind "primitive-type", "complex-type", or "datatype" & derivation "specialization"
  // - 'Logical': a StructureDefinition w/ kind "logical" & derivation "specialization"
  // - 'Profile': a StructureDefinition w/ derivation "constraint"
  // - 'Extension': a StructureDefinition w/ type "Extension" and baseDefinition NOT "http://hl7.org/fhir/StructureDefinition/Element"
  type?: string[];
  // search only within a specific package, identified by a package id with an optional "|version" suffix
  scope?: string;
  // sort algorithm(s)
  sort?: SortBy[];
  // limit the number of results returned
  limit?: number;
};

export type SortBy = {
  sortBy: string;
  [key: string]: any;
};

export type ResourceInfo = {
  resourceType: string;
  id?: string;
  url?: string;
  name?: string;
  version?: string;
  sdKind?: string;
  sdDerivation?: string;
  sdType?: string;
  sdBaseDefinition?: string;
  sdAbstract?: boolean;
  sdImposeProfiles?: string[];
  sdCharacteristics?: string[];
  sdFlavor?: string;
  packageName?: string;
  packageVersion?: string;
  resourcePath?: string;
};
