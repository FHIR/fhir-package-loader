As of 2024 August 30:

The `npm outdated` command reports a dependency as outdated. It is not being updated at this time for the reason given below:

- `@types/node`: don't update until Node 22 is LTS version (currently Node 20).
- `chalk`: major version 5 causes problems for jest. Keep updated to latest 4.x release.
