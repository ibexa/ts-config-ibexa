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

## Assets packages in a standalone bundle

The global declarations of the Ibexa bundles reach into sources that import the npm packages shipped by `ibexa/admin-ui-assets` and `ibexa/headless-assets` (for example `@ibexa/types` and `@ibexa/utils` used by page-builder). A standalone bundle checkout usually has neither in its `vendor/`, so `tsc` fails with `Cannot find module`.

When the generator runs in a standalone bundle checkout it makes sure both are available:

- `ibexa/admin-ui-assets` for every bundle,
- `ibexa/headless-assets` for every bundle with `"license": "proprietary"` in its `composer.json`.

The version is `dev-X.Y-next`, with `X.Y` taken from the bundle's `extra.branch-alias`. Each package is installed with Composer into a project of its own under `node_modules/.cache/ibexa-ts-config/packages/` and symlinked into `vendor/ibexa/`. The bundle's `composer.json` and `composer.lock` are not touched. The side project reuses the bundle's `repositories` and its `auth.json` when there is one, so the same credentials work as for `composer install`.

Every run refreshes the side projects with `composer update`, so `yarn install` always leaves the assets at the current state of their `-next` branch, the same way `composer install` without a lock file does for the bundle's own dependencies. When nothing changed this costs about a second per package. A real package directory or a symlink made by something else in `vendor/ibexa/` is left alone. Removing `node_modules` removes the installed assets as well; the next `yarn install` brings them back.

## Generating API schema for TS
Download openapi.yaml
```wget https://raw.githubusercontent.com/ibexa/documentation-developer/refs/heads/5.0/docs/api/rest_api/rest_api_reference/openapi.yaml```

Due to current bug in openapi file parts of file that starts with `$ref: '#/components/examples` needs to be removed before generating .d.ts file.

Generate schema.d.ts file:
```npx openapi-typescript ./openapi.yaml -o ./types/schema.d.ts```

## COPYRIGHT
Copyright (C) 1999-2025 Ibexa AS (formerly eZ Systems AS). All rights reserved.

## LICENSE
This source code is available separately under the following licenses:

A - Ibexa Business Use License Agreement (Ibexa BUL),
version 2.4 or later versions (as license terms may be updated from time to time)
Ibexa BUL is granted by having a valid Ibexa DXP (formerly eZ Platform Enterprise) subscription,
as described at: https://www.ibexa.co/product
For the full Ibexa BUL license text, please see:
- LICENSE-bul file placed in the root of this source code, or
- https://www.ibexa.co/software-information/licenses-and-agreements (latest version applies)

AND

B - Ibexa Trial and Test License Agreement (Ibexa TTL),
version 2.2 or later versions (as license terms may be updated from time to time)
Trial can be granted by Ibexa, reach out to Ibexa AS for evaluation access: https://www.ibexa.co/about-ibexa/contact-us
For the full Ibexa TTL license text, please see:
- LICENSE file placed in the root of this source code, or
- https://www.ibexa.co/software-information/licenses-and-agreements (latest version applies)
