# FHIR Package Load

## Usage

### Command Line

```bash
npx fhir-package-load <package@version...>
```

```bash
npm install -g fhir-package-load
fhir-package-load <package@version...>
```

Optional command line options:

- `-s, --save`: specify where to load packages to (default is local [FHIR cache](https://confluence.hl7.org/pages/viewpage.action?pageId=66928417#FHIRPackageCache-Location))

### Javascript Project

```bash
cd myProject
npm install fhir-package-load
```

```javascript
import { loadDependencies } from 'fhir-package-load

async function myApp() {
  // Downloads and unzips packages to FHIR cache or other specified location (if not already present)
  await loadDependencies(['package@version, package2@version']);

  // Does the same as above, but returns a [FHIRDefinition](./src/load/FHIRDefinitions.ts) class, which allows access to each definition in the specified packages
  const definitions = await loadDependencies(['package@version']);
}
```

## Mock Out in Unit Tests

If you use `fhir-package-load` as a dependency in your project, you can choose to mock any function from the package. One way to do this is using the following snippet:

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
