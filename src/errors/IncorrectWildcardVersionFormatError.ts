export class IncorrectWildcardVersionFormatError extends Error {
  constructor(
    public packageName: string,
    version: string
  ) {
    super(
      `Incorrect version format for package ${packageName}: ${version}. Wildcard should only be used to specify patch versions.`
    );
  }
}
