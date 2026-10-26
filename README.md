Ibexa TypeScript Config

## Generating aliases for project repository
From project repository run with optional arguments:
```node node_modules/@ibexa/ts-config/scripts/generate-aliases.mjs```

### Available arguments
`--project-path` - if run from other place than DXP installation or bundle with installed vendors
`--design-system-path` - absolute path to Design System repository, only needed in dev environment if you're working on DS components
`--tsconfig-filename` - allows to generate aliases to file different than `tsconfig.json`
`--relative-to` - required, has three options:

#### project
Creates aliases relative to project directory (`cwd` or `--project-path`)

#### bundle
Creates aliases relative to current bundle directory (like `vendor/ibexa/admin-ui`)

#### custom
Used with `--custom-relative-path` argument, it creates aliases relative to path from this argument

## Release

A release is a bump commit and a `v<version>` tag on the `X.x` branch being released:

```sh
yarn create-tag 1.1.5            # checks, bump, commit "Released 1.1.5" and tag v1.1.5 locally
git push origin HEAD v1.1.5
```

`create-tag --dry-run` does the same from any branch without intending a push; drop the commit and the tag afterwards.

The same steps run in GitHub Actions through the **Tag** workflow (`workflow_dispatch` with the version, `dry-run` on by default). The version has to be the next patch or the next minor of the latest stable tag on that major line; prereleases such as `1.1.5-alpha.1` only have to be new. Consumers pin the package by the tag (`https://github.com/ibexa/ts-config-ibexa#~v1.1.0`), so the tag is the release: nothing is published to a registry.

## COPYRIGHT
Copyright (C) 1999-2025 Ibexa AS (formerly eZ Systems AS). All rights reserved.

## LICENSE

This source code is available separately under the following licenses:

A - Ibexa Business Use License Agreement (Ibexa BUL),
version 2.4 or later versions (as license terms may be updated from time to time)
Ibexa BUL is granted by having a valid Ibexa DXP (formerly eZ Platform Enterprise) subscription,
as described at: https://www.ibexa.co/product
For the full Ibexa BUL license text, please see:
https://www.ibexa.co/software-information/licenses-and-agreements (latest version applies)

AND

B - GNU General Public License, version 2
Grants an copyleft open source license with ABSOLUTELY NO WARRANTY. For the full GPL license text, please see:
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
