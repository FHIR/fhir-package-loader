export class PackageLoadError extends Error {
  specReferences = ['https://confluence.hl7.org/display/FHIR/NPM+Package+Specification'];
  constructor(public fullPackageName: string, public customRegistry?: string) {
    super(
      `The package ${fullPackageName} could not be loaded locally or from the ${
        customRegistry ? 'custom ' : ''
      }FHIR package registry${customRegistry ? ` ${customRegistry}` : ''}.`
    );
  }
}
