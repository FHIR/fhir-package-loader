export enum Type {
  Profile,
  Extension,
  ValueSet,
  CodeSystem,
  Instance,
  Invariant, // NOTE: only defined in FSHTanks, not FHIR defs
  RuleSet, // NOTE: only defined in FSHTanks, not FHIR defs
  Mapping, // NOTE: only defined in FSHTanks, not FHIR defs
  Resource,
  Type, // NOTE: only defined in FHIR defs, not FSHTanks
  Logical
}

export interface Metadata {
  id: string;
  name: string;
  sdType?: string;
  resourceType?: string;
  url?: string;
  parent?: string;
  abstract?: boolean;
  instanceUsage?: InstanceUsage;
}

type InstanceUsage = 'Example' | 'Definition' | 'Inline';
