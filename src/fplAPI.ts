import { FHIRDefinitions, ErrorsAndWarnings, LogFunction, wrapLogger } from './utils';
import { loadDependencies } from './load';

export async function fpl(
  fhirPackages: string | string[],
  options: packageLoadOptions = {}
): Promise<{
  defs: FHIRDefinitions;
  errors: ErrorsAndWarnings['errors'];
  warnings: ErrorsAndWarnings['warnings'];
  failedPackages: string[];
}> {
  // Track errors and warnings
  const errorsAndWarnings = new ErrorsAndWarnings();
  const logWithTrack = wrapLogger(options.log, errorsAndWarnings);

  // Create list of packages
  if (!Array.isArray(fhirPackages)) {
    fhirPackages = fhirPackages.split(',').map(p => p.trim());
  }
  fhirPackages = fhirPackages.map(dep => dep.replace('@', '#'));
  const defs = await loadDependencies(fhirPackages, options.cachePath, logWithTrack);

  const failedPackages = defs.allUnsuccessfulPackageLoads();

  return {
    defs,
    errors: errorsAndWarnings.errors,
    warnings: errorsAndWarnings.warnings,
    failedPackages
  };
}

type packageLoadOptions = {
  log?: LogFunction;
  cachePath?: string;
};
