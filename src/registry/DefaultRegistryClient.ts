import { FHIRRegistryClient } from './FHIRRegistryClient';
import { NPMRegistryClient } from './NPMRegistryClient';
import { RedundantRegistryClient } from './RedundantRegistryClient';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

const FHIR_PACKAGES_ENDPOINT = 'https://packages.fhir.org';
const FHIR_PACKAGES2_ENDPOINT = 'https://packages2.fhir.org/packages';

export class DefaultRegistryClient extends RedundantRegistryClient {
  constructor(options?: RegistryClientOptions) {
    let clients: RegistryClient[];
    const customRegistry = process.env.FPL_REGISTRY;
    if (customRegistry?.trimStart().startsWith('[')) {
      const endpoints = parseArray(customRegistry, 'FPL_REGISTRY').map(parseEndpoint);
      if (endpoints.length === 0) {
        throw new Error('FPL_REGISTRY must contain at least one registry URL.');
      }
      const tokens = parseTokens(process.env.FPL_REGISTRY_TOKEN, endpoints.length);
      clients = endpoints.map(
        (endpoint, index) =>
          new NPMRegistryClient(endpoint.href, {
            ...options,
            token: tokens[index] ?? ''
          })
      );
    } else if (customRegistry) {
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

function parseArray(value: string, variable: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Report the expected format without including any part of the input.
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${variable} must be a JSON array.`);
  }
  return parsed;
}

function parseEndpoint(value: unknown, index: number): URL {
  if (typeof value === 'string' && /^https?:\/\//i.test(value) && !/[?#]/.test(value)) {
    try {
      const endpoint = new URL(value);
      if (!endpoint.username && !endpoint.password) {
        endpoint.pathname = endpoint.pathname.replace(/\/+$/, '');
        return endpoint;
      }
    } catch {
      // Report the invalid entry without including the URL.
    }
  }
  throw new Error(
    `FPL_REGISTRY entry ${index + 1} must be an absolute HTTP or HTTPS URL without credentials, query, or fragment.`
  );
}

function parseTokens(value: string | undefined, registryCount: number): string[] {
  if (!value) {
    return [];
  }

  const tokens = parseArray(value, 'FPL_REGISTRY_TOKEN');
  if (tokens.length !== registryCount) {
    throw new Error('FPL_REGISTRY_TOKEN must have the same number of entries as FPL_REGISTRY.');
  }
  return tokens.map((token, index) => {
    if (typeof token !== 'string') {
      throw new Error(`FPL_REGISTRY_TOKEN entry ${index + 1} must be a string.`);
    }
    return token;
  });
}
