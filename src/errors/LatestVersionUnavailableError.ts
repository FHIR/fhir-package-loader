export class LatestVersionUnavailableError extends Error {
  constructor(
    public packageName: string,
    public isPatchWildCard?: boolean
  ) {
    super(
      `Latest ${
        isPatchWildCard ? 'patch ' : ''
      }version of package ${packageName} could not be determined from the package registry`
    );
  }
}
