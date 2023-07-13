export class LatestVersionUnavailableError extends Error {
  constructor(
    public packageName: string,
    public customRegistry?: string,
    public isPatchWildCard?: boolean
  ) {
    super(
      `Latest ${
        isPatchWildCard ? 'patch ' : ''
      }version of package ${packageName} could not be determined from the ${
        customRegistry ? 'custom ' : ''
      }FHIR package registry${customRegistry ? ` ${customRegistry}` : ''}`
    );
  }
}
