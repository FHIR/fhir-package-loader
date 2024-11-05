// A minimal package JSON signature
export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  [key: string]: any;
};
