import { errorsAndWarnings, ErrorsAndWarnings } from '../utils';
import { FHIRDefinitions } from './FHIRDefinitions';
import { loadDependencies } from './load';

export async function loadApi(
  fhirPackages: string | string[],
  cachePath?: string,
  options: packageLoadOptions = {}
): Promise<{
  defs: FHIRDefinitions;
  errors: ErrorsAndWarnings['errors'];
  warnings: ErrorsAndWarnings['warnings'];
  failedPackages: string[];
}> {
  // Track errors and warnings
  errorsAndWarnings.reset();
  errorsAndWarnings.shouldTrack = true;

  // Create list of packages
  if (!Array.isArray(fhirPackages)) {
    fhirPackages = fhirPackages.split(',').map(p => p.trim());
  }
  fhirPackages = fhirPackages.map(dep => dep.replace('@', '#'));
  const defs = await loadDependencies(fhirPackages, cachePath, options.log);

  const failedPackages = defs.allUnsuccessfulPackageLoads();

  return {
    defs,
    errors: errorsAndWarnings.errors,
    warnings: errorsAndWarnings.warnings,
    failedPackages
  };
}

type packageLoadOptions = {
  log?: (level: string, message: string) => void;
};
