export class InvalidResourceError extends Error {
  constructor(
    public resourcePath: string,
    public reason: string
  ) {
    super(`The resource at ${resourcePath} is not a valid FHIR resource: ${reason}.`);
  }
}
