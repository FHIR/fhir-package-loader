export class InvalidPackageError extends Error {
  constructor(
    public packagePath: string,
    public reason: string
  ) {
    super(`The package at ${packagePath} is not a valid FHIR package: ${reason}.`);
  }
}
