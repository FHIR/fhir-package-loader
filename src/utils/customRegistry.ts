import process from 'process';
import { LogFunction } from './logger';
import { axiosGet } from './axiosUtils';

let hasLoggedCustomRegistry = false;

export function getCustomRegistry(log: LogFunction = () => {}) {
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

export async function getDistUrl(
  registry: string,
  packageName: string,
  version: string
): Promise<string> {
  const cleanedRegistry = registry.replace(/\/$/, '');
  // 1 get the manifest information about the package from the registry
  const res = await axiosGet(`${cleanedRegistry}/${packageName}`);
  // 2 find the NPM tarball location
  const npmLocation = res.data?.versions?.[version]?.dist?.tarball;

  // 3 if found, use it, otherwise fallback to the FHIR spec location
  if (npmLocation) {
    return npmLocation;
  } else {
    return `${cleanedRegistry}/${packageName}/${version}`;
  }
}
