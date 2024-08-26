# FHIR Package Loader

FHIR Package Loader provides TypeScript/JavaScript classes for loading FHIR packages and querying them for FHIR resources. It can load FHIR packages from a local cache, the FHIR registry, an NPM registry, and/or the FHIR build server.

## FHIR Foundation Project Statement

- Maintainers: This project is maintained by the HL7 community.
- Issues / Discussion: For FHIR Package Loader issues, such as bug reports, comments, suggestions, questions, and feature requests, visit [FHIR Package Loader GitHub Issues](https://github.com/standardhealth/fhir-package-loader/issues). For discussion of FHIR Shorthand and its associated projects, visit the FHIR Community Chat @ https://chat.fhir.org. The [#shorthand stream](https://chat.fhir.org/#narrow/stream/215610-shorthand) is used for all FHIR Shorthand questions and discussion.
- License: All contributions to this project will be released under the Apache 2.0 License, and a copy of this license can be found in [LICENSE](LICENSE).
- Contribution Policy: The FHIR Package Loader Contribution Policy can be found in [CONTRIBUTING.md](CONTRIBUTING.md).
- Security Information: The FHIR Package Loader Security Information can be found in [SECURITY.md](SECURITY.md).
- Compliance Information: FHIR Package Loader is designed to work with FHIR packages that are based on FHIR R4, FHIR R4B, or FHIR R5.

# Usage

FHIR Package Loader can be used directly via a command line interface (CLI) or it can be used as a dependency library in another JavaScript/TypeScript project.

The current implementation of FHIR Package Loader requires [Node.js](https://nodejs.org/) to be installed on the user's system. Users should install Node.js 18, although other current LTS versions are also expected to work. Future versions of FHIR Package Loader may provide web-friendly JavaScript implementations that do not require Node.js.

## Using the FHIR Package Loader Command Line Interface (CLI)

To download and install FHIR packages through the command line, you can run the following command directly:

```sh
npx fhir-package-loader install <package#version...> # downloads specified FHIR packages
```

_Note: `package@version` is also supported to maintain backwards-compatibility with fhir-package-loader 1.x._

`npx` will ensure you are using the latest version and will allow you to run the CLI without needing to install and manage any dependency.

Alternately, if you'd like to install the fhir-package-loader package, it can be installed globally:

```sh
npm install -g fhir-package-loader # installs FHIR Package Loader utility from npm
```

After installation, the `fhir-package-loader` command line will be available on your path. Use the `fpl` command to invoke it:

```sh
fpl --help # outputs information about using the command line
fpl install --help

fpl install <package#version...> # downloads specified FHIR packages
```

With both approaches, the same commands are available. The install command allows you to specify the FHIR packages to download, along with a few additional options:

```sh
Usage: fpl install <fhirPackages...> [options]

download and unzip specified FHIR packages

Arguments:
  fhirPackages      list of FHIR packages to load using the format packageId#packageVersion or packageId@packageVersion

Options:
  -c, --cachePath <dir>  where to save packages to and load definitions from (default is the local [FHIR cache](https://confluence.hl7.org/pages/viewpage.action?pageId=66928417#FHIRPackageCache-Location))
  -d, --debug       output extra debugging information
  -h, --help        display help for command
```

General information about any command can be found with `fpl --help`:

```sh
Usage: fpl [options] [command]

CLI for downloading FHIR packages

Options:
  -v, --version                        output the version number
  -h, --help                           display help for command

Commands:
  install [options] <fhirPackages...>  download and unzip specified FHIR packages
  help [command]                       display help for command

Examples:
  fpl install hl7.fhir.us.core#current
  fpl install hl7.fhir.us.core#4.0.0 hl7.fhir.us.mcode@2.0.0 --cachePath ./myProject
```

## Using FHIR Package Loader as a Library

FHIR Package Loader can be used as a library to download FHIR packages, query their contents, and retrieve FHIR resources. The primary interface of interest is the `PackageLoader`:

```ts
export interface PackageLoader {
  loadPackage(name: string, version: string): Promise<LoadStatus>;
  getPackageLoadStatus(name: string, version: string): LoadStatus;
  findPackageInfos(name: string): PackageInfo[];
  findPackageInfo(name: string, version: string): PackageInfo | undefined;
  findPackageJSONs(name: string): any[];
  findPackageJSON(name: string, version: string): any | undefined;
  findResourceInfos(key: string, options?: FindResourceInfoOptions): ResourceInfo[];
  findResourceInfo(key: string, options?: FindResourceInfoOptions): ResourceInfo | undefined;
  findResourceJSONs(key: string, options?: FindResourceInfoOptions): any[];
  findResourceJSON(key: string, options?: FindResourceInfoOptions): any | undefined;
  clear(): void;
}
```

> _NOTE: The FHIR Package Loader 1.x API is no longer supported. FHIR Package Loader 2.0 is a complete rewrite with an entirely different API._

### PackageLoader Implementations

The [default PackageLoader](src/loader/DefaultPackageLoader.ts) implementation provides the most common package loader approach:
* package and resource metadata is stored and queried in an in-memory [sql.js](https://github.com/sql-js/sql.js) database
* the standard FHIR cache is used for local storage of unzipped packages (`$USER_HOME/.fhir/packages`)
* the standard FHIR registry is used (`packages.fhir.org`) for downloading published packages, falling back to `packages2.fhir.org` when necessary
  * unless an `FPL_REGISTRY` environment variable is defined, in which case its value is used as the URL for an NPM registry to use _instead_ of the standard FHIR registry
* the `build.fhir.org` build server is used for downloading _current_ builds of packages

To instantiate the default `PackageLoader`, import the asynchronous `defaultPackageLoader` function and invoke it, optionally passing in an `options` object with a log method to use for logging:

```ts
import { defaultPackageLoader, LoadStatus } from 'fhir-package-loader';

// somewhere in your code...
const log = (level: string, message: string) => console.log(`${level}: ${message}`);
const loader = await defaultPackageLoader({ log });
const status = await loader.loadPackage('hl7.fhir.us.core', '6.1.0');
if (status !== LoadStatus.LOADED) {
  // ...
}
```

To instantiate the default `PackageLoader` with a set of standalone JSON or XML resources that should be pre-loaded, use the `defaultPackageLoaderWithLocalResources` function instead, passing in an array of file paths to folders containing the resources to load.

For more control over the `PackageLoader`, use the [BasePackageLoader](src/loader/BasePackageLoader.ts). This allows you to specify the [PackageDB](src/db), [PackageCache](src/cache), [RegistryClient](src/registry), and [CurrentBuildClient](src/current) you wish to use. FHIRPackageLoader comes with implementations of each of these, but you may also provide your own implementations that adhere to the relevant interfaces.

### PackageLoader Functions

The `PackageLoader` interface provides the following functions:

#### `loadPackage(name: string, version: string): Promise<LoadStatus>`

Loads the specified package version. The version may be a specific version (e.g., `1.2.3`), a wildcard patch version (e.g., `1.2.x`), `dev` (to indicate the local development build in your FHIR cache), `current` (to indicate the current master/main build), `current$branchname` (to indicate the current build on a specific branch), or `latest` (to indicate the most recent published version). Returns the [LoadStatus](src/loader/PackageLoader.ts).

#### `getPackageLoadStatus(name: string, version: string): LoadStatus`

Gets the [LoadStatus](src/loader/PackageLoader.ts) for the specified package version. The returned value will be `LoadStatus.LOADED` if it is already loaded, `LoadStatus.NOT_LOADED` if it has not yet been loaded, or `LoadStatus.FAILED` if it was attempted but failed to load. This function supports specific versions (e.g. `1.2.3`), `dev`, `current`, and `current$branchname`. It does _not_ support wildcard patch versions (e.g., `1.2.x`) nor does it support the `latest` version.

#### `findPackageInfos(name: string): PackageInfo[]`

Finds loaded packages by name and returns the corresponding array of [PackageInfo](src/package/PackageInfo.ts) objects or an empty array if there are no matches.

#### `findPackageInfo(name: string, version: string): PackageInfo | undefined`

Finds a loaded package by its name and version, and returns the corresponding [PackageInfo](src/package/PackageInfo.ts) or `undefined` is there is not a match. In the case of multiple matches, the info for last package loaded will be returned. This function supports specific versions (e.g. `1.2.3`), `dev`, `current`, and `current$branchname`.

#### `findPackageJSONs(name: string): any[]`

Finds loaded packages by name and returns the corresponding array of `package.json` JSON objects from the packages, or an empty array if there are no matches. 

#### `findPackageJSON(name: string, version: string): any | undefined`

Finds a loaded package by name and version, and returns the corresponding `package.json` JSON object from the packages, or `undefined` if there is not a match. In the case of multiple matches, the `package.json` from the last package loaded will be returned. This function supports specific versions (e.g. `1.2.3`), `dev`, `current`, and `current$branchname`.

#### `findResourceInfos(key: string, options?: FindResourceInfoOptions): ResourceInfo[]`

Finds loaded resources by a key and returns the corresponding array of [ResourceInfo](src/package/ResourceInfo.ts) objects or an empty array if there are no matches. The key will be matched against resources by their `id`, `name`, or `url`. An [options](src/package/ResourceInfo.ts) object may also be passed in to scope the search to a specific set of resource types and/or a specific package, and/or to limit the number of results returned.

#### `findResourceInfo(key: string, options?: FindResourceInfoOptions): ResourceInfo | undefined`

Finds a loaded resource by a key and returns the corresponding [ResourceInfo](src/package/ResourceInfo.ts) or `undefined` if there is not a match. The key will be matched against resources by their `id`, `name`, or `url`. An [options](src/package/ResourceInfo.ts) object may also be passed in to scope the search to a specific set of resource types and/or a specific package. If a set of resource types is specified in the options, then the order of the resource types determines which resource is returned in the case of multiple matches (i.e., the resource types are assumed to be in priority order). If there are still multiple matches, the info for the last resource loaded will be returned. 

#### `findResourceJSONs(key: string, options?: FindResourceInfoOptions): any[]`

Finds loaded resources by a key and returns the corresponding array of JSON FHIR definitions or an empty array if there are no matches. The key will be matched against resources by their `id`, `name`, or `url`. An [options](src/package/ResourceInfo.ts) object may also be passed in to scope the search to a specific set of resource types and/or a specific package, and/or to limit the number of results returned.

#### `findResourceJSON(key: string, options?: FindResourceInfoOptions): any | undefined`

Finds a loaded resource by a key and returns the corresponding FHIR JSON definition or `undefined` if there is not a match. The key will be matched against resources by their `id`, `name`, or `url`. An [options](src/package/ResourceInfo.ts) object may also be passed in to scope the search to a specific set of resource types and/or a specific package. If a set of resource types is specified in the options, then the order of the resource types determines which resource is returned in the case of multiple matches (i.e., the resource types are assumed to be in priority order). If there are still multiple matches, the the last resource loaded will be returned. 

#### `clear(): void`

Clears all packages and resources from the loader.

# For Developers

## Intro to FHIR Package Loader

To learn more about FHIR Package Loader, watch the Knowledge Sharing Sessions for [Developing FSH Tools](https://vimeo.com/990594228/056b5c075f) (view the slides [here](https://confluence.hl7.org/display/FHIR/FSH+Knowledge+Sharing+Sessions?preview=/256509612/256514908/KSS%203%20-%20Developing%20FSH%20Tools.pdf)) and [Developing FHIR Package Loader](https://vimeo.com/1008502493/76aba15913) (view the slides [here](https://confluence.hl7.org/display/FHIR/FSH+Knowledge+Sharing+Sessions?preview=/256509612/265096146/KSS%208%20-%20Developing%20FHIR%20Package%20Loader.pdf)).
These sessions provide a technical overview of the codebase and summarize key concepts for developers.

## Installation

FHIR Package Loader is a [TypeScript](https://www.typescriptlang.org/) project. At a minimum, it requires [Node.js](https://nodejs.org/) to build, test, and run the CLI. Developers should install Node.js 18, although other current LTS versions are also expected to work.

Once Node.js is installed, run the following command from this project's root folder:

```sh
npm install
```

# License

Copyright 2022-2024 Health Level Seven International

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
