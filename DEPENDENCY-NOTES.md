As of 2025 March 28:

The `npm outdated` command reports a dependency as outdated. It is not being updated at this time for the reason given below:

- `@types/node`: don't update until Node 22 is LTS version (currently Node 20).
- `chalk`: major version 5 is an esmodule and causes problems for jest. Keep updated to latest 4.x release.
- `commander`: major version 14 requires Node 20 and higher. Wait until community has had sufficient time to move off Node 18.
