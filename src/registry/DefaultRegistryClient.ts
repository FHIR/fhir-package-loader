import { LogFunction } from '../utils';
import { FHIRRegistryClient } from './FHIRRegistryClient';
import { NPMRegistryClient } from './NPMRegistryClient';
import { RedundantRegistryClient } from './RedundantRegistryClient';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

const FHIR_PACKAGES_ENDPOINT = 'https://packages.fhir.org';
const FHIR_PACKAGES2_ENDPOINT = 'https://packages2.fhir.org/packages';

export class DefaultRegistryClient extends RedundantRegistryClient {
  constructor(options?: RegistryClientOptions) {
    let clients: RegistryClient[];
    // If a custom registry has been specified, use that
    const customRegistry = getCustomRegistry(options.log);
    if (customRegistry) {
      clients = [new NPMRegistryClient(customRegistry, options)];
    }
    // Otherwise use packages.fhir.org w/ packages2.fhir.org fallback
    else {
      clients = [
        new FHIRRegistryClient(FHIR_PACKAGES_ENDPOINT, options),
        new FHIRRegistryClient(FHIR_PACKAGES2_ENDPOINT, options)
      ];
    }
    super(clients, options);
  }
}

let hasLoggedCustomRegistry = false;

function getCustomRegistry(log: LogFunction = () => {}) {
  if (process.env.FPL_REGISTRY) {
    if (!hasLoggedCustomRegistry) {
      hasLoggedCustomRegistry = true;
      log(
        'info',
        `Using custom registry specified by FPL_REGISTRY environment variable: ${process.env.FPL_REGISTRY}`
      );
    }
    return process.env.FPL_REGISTRY;
  }
}
