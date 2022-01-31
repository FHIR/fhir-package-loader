// import { Annotated } from './Annotated';

export class PackageLoadError extends Error {
  specReferences = ['https://confluence.hl7.org/display/FHIR/NPM+Package+Specification'];
  constructor(public fullPackageName: string) {
    super(
      `The package ${fullPackageName} could not be loaded locally or from the FHIR package registry.`
    );
  }
}
