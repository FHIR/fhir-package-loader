As of 2026 Oct 31:

The `npm outdated` command reports a dependency as outdated. It is not being updated at this time for the reason given below:

- `@types/node`: don't update until Node 22 is LTS version (currently Node 20).
- `chalk`: major version 5 is an esmodule and causes problems for jest. Keep updated to latest 4.x release.
- `commander`: major version 14 requires Node 20 and higher. Wait until community has had sufficient time to move off Node 18.
- `nock`: major version 15 is an esmodule and causes problems for jest. Keep updated to latest 14.x release.
- `typescript`: typescript versions over 5.x have compatibility problems with some jest modules.
