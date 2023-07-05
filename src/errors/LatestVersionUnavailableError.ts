export class LatestVersionUnavailableError extends Error {
  constructor(public packageName: string, public customRegistry?: string) {
    super(
      `Latest version of package ${packageName} could not be determined from the ${
        customRegistry ? 'custom ' : ''
      }FHIR package registry${customRegistry ? ` ${customRegistry}` : ''}`
    );
  }
}
