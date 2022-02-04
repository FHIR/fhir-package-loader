# FHIR Package Load

FHIR Package Load is a utility that downloads published FHIR packages from the FHIR package registry.

## Usage

This tool can be used directly through a command line interface (CLI) or it can be used as a dependency in another JavaScript/TypeScript project to download FHIR packages and load the contents into memory.

FHIR Package Load requires [Node.js](https://nodejs.org/) to be installed on the user's system. Users should install Node.js 16 (LTS), although the previous LTS versions (Node.js 14 and Node.js 12) are also expected to work.

Once Node.js is installed, use either of the following methods to use the FHIR Package Load.

### Command Line

To download and unzip FHIR packages through the command line, you can run the following command directly:

```sh
$ npx fhir-package-load <package@version...> # downloads specified FHIR packages
```

_Note: `npx` comes with npm 5.2+ and higher._

`npx` will ensure you are using the latest version and will allow you to run the CLI without needing to install and manage any dependency.

Alternatively, if you'd like to install the package, it can be installed globally and used as follows:

```sh
$ npm install -g fhir-package-load # installs the package from npm
```

After installation, the `fhir-package-load` command line will be available on your path:

```sh
$ fhir-package-load --help # outputs information about using the command line

$ fhir-package-load <package@version...> # downloads specified FHIR packages
```

With both approaches, the same arguments and options can be used:

```
Arguments:
  fhirPackages      a list of FHIR packages to load using the format packageId@packageVersion...

Options:
  -s, --save <dir>  where to save packages to and load definitions from (default is the local [FHIR cache](https://confluence.hl7.org/pages/viewpage.action?pageId=66928417#FHIRPackageCache-Location))
  -d, --debug       output extra debugging information
  -v, --version     output the version number
  -h, --help        display help for command

Examples:
  npx fhir-package-load hl7.fhir.r5.core@current
  fhir-package-load hl7.fhir.r4.core@4.0.1 hl7.fhir.us.core@4.0.0 --save ./myProject
```

### JavaScript Project

Additionally, FHIR Package Load can be installed as a dependency of a JavaScript or TypeScript project. It add it as a dependency, navigate to your project directory and use `npm` to install the package:

```sh
$ cd myProject
$ npm install fhir-package-load
```

Once installed as a dependency, various functions are available to use within your project. The main function available is `loadDependencies`. This function provides the same functionality you get through the CLI, but you also have access to the in memory definitions from the packages. The following example shows two ways to use the function in a project:

```javascript
import { loadDependencies } from 'fhir-package-load

async function myApp() {
  // Downloads and unzips packages to FHIR cache or other specified location (if not already present)
  await loadDependencies(['package@version, package2@version']);

  // Does the same as above, and returns a [FHIRDefinition](./src/load/FHIRDefinitions.ts) class, which allows access to each definition in the specified packages
  const definitions = await loadDependencies(['package@version']);
}
```

## Mock Out in Unit Tests

If you use `fhir-package-load` as a dependency in your project, you can choose to mock any function from the package. This may be helpful for writing unit tests that do not need to download packages from the FHIR registry. One way to do this is using the following snippet:

```javascript
jest.mock('fhir-package-load', () => {
  const original = jest.requireActual('fhir-package-load');
  return {
    ...original,
    loadDependency: jest.fn(), // can optionally include a mock implementation
    // any other functions to be mocked out
  }
}
```

The logger can also be silenced during testing by mocking the transport function:

```javascript
import { logger } from 'fhir-package-load';

logger.transports[0]['write'] = jest.fn(() => true);
```

or

```javascript
import { logger } from 'fhir-package-load';

jest.spyOn(logger.transports[0], 'write').mockImplementation(() => true);
```

## Installation for Developers

FHIR Package Load is a [TypeScript](https://www.typescriptlang.org/) project. At a minimum, it requires [Node.js](https://nodejs.org/) to build, test, and run the CLI. Developers should install Node.js 16 (LTS), although the previous LTS versions (Node.js 14 and 12) are also expected to work.

Once Node.js is installed, run the following command from this project's root folder:

```sh
$ npm install
```

# License

Copyright 2022 The MITRE Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
