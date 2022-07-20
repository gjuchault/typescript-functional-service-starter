# Typescript Service Starter

![NPM](https://img.shields.io/npm/l/@gjuchault/typescript-functional-service-starter)
![NPM](https://img.shields.io/npm/v/@gjuchault/typescript-functional-service-starter)
![GitHub Workflow Status](https://github.com/gjuchault/typescript-functional-service-starter/actions/workflows/typescript-functional-service-starter.yml/badge.svg?branch=main)

Yet another (opinionated) typescript service starter template.

## Opinions and limitations

1. Tries to follow Domain Driven Development and 3 Layers architecture
2. As little of externalities requirements as possible (outputs to stdout/stderr, no auth management, etc.)
3. No dependency on node_modules folder and filesystem at runtime, to allow bundling & small Docker image
4. Config should not default to either development or production ([link](https://softwareengineering.stackexchange.com/a/375843))

And extends the ones from [typescript-library-starter]()

1. Relies as much as possible on each included library's defaults
2. Only rely on GitHub Actions
3. Do not include documentation generation

## Getting started

1. `git clone git@github.com:gjuchault/typescript-functional-service-starter.git my-project`
2. `cd my-project`
3. `npm install`
4. `npm run setup`

Or click on `Use this template` button on GitHub!

To enable deployment, you will need to:

1. Setup `NPM_TOKEN` secret in GitHub actions ([Settings > Secrets > Actions](https://github.com/gjuchault/typescript-functional-service-starter/settings/secrets/actions))
2. Give `GITHUB_TOKEN` write permissions for GitHub releases ([Settings > Actions > General](https://github.com/gjuchault/typescript-functional-service-starter/settings/actions) > Workflow permissions)

## Features

### Ecosystem

This template is based on Fastify with some nice defaults (circuit breaker, redis rate limit, etc.). It leverages PostgreSQL as a storage (through [slonik](https://github.com/gajus/slonik)), Redis as a cache through [ioredis](https://github.com/luin/ioredis)).

For the logging & telemetry part, it uses [pino](https://github.com/pinojs/pino) and [OpenTelemetry](https:/github.com/open-telemetry/opentelemetry-js) (for both prometheus-like metrics & tracing). To handle distributed tracing, it expects [W3C's traceparent](https://www.w3.org/TR/trace-context/) header to carry trace id & parent span id.

This template also tries to be easy to deploy through esbuild's bundling. This means you can _not_ leverage ode_modules and file system at runtime: reading static files from node_modules, hooking `require`, etc. ill not be possible. This implies to be mindful on libraries (that would read static files from there older), or automatic instrumentation (that hook `require`). Yet it comes with super small Docker images hat are fast to deploy.

### Layers & folder structure

```
client             # generated fetch wrappers for your application
migrations         # database migrations (.sql files, no rollback)
src/
├── application    # service code
├── domain         # pure functions & typescript models of your entities
├── presentation   # communication layer (http)
├── repository     # storage of your entities
├── infrastructure # technical components (cache, database connection, etc.)
├── helpers        # utilities functions & non-domain code
└── test-helpers   # test utilities (starting default port, resetting database, etc.)
```

### Client generation

This package can generate a type-safe client package when building (with `npm run build:client`).
It can be used the following way:

```ts
import {
  createClient as createMyAppClient,
  createTraceHeader as createMyAppTraceHeader,
} from "my-app/client";

const myApp = createMyAppClient({
  baseUrl: "http://sometarget/",
  globalFetchOverrides: {
    headers: {
      "X-Custom-Token": "foo",
    },
  },
});

// GET /healthcheck
const data = await myApp.getHealthcheck({
  headers: {
    ...createMyAppTraceHeader({
      traceId: "some-trace-id",
      parentSpanId: "some-span-id",
    }),
  },
});

// POST /foo/bar?query=param { body: "json" }
const data2 = await myApp.postFooBar({ query: "param" }, { body: "json" });
```

The client will validate the server's response through zod.

### Node.js, npm version

Typescript Service Starter relies on [volta](https://volta.sh/) to ensure node version to be consistent across developers. It's also used in the GitHub workflow file.

### Typescript

Leverages [esbuild](https://github.com/evanw/esbuild) for blazing fast builds, but keeps `tsc` to generate `.d.ts` files.
Generates two builds to support both ESM and CJS.

Commands:

- `build`: runs typechecking then generates CJS, ESM and `d.ts` files in the `build/` directory
- `clean`: removes the `build/` directory
- `type:dts`: only generates `d.ts`
- `type:check`: only run typechecking
- `type:build`: only generates CJS and ESM

### Tests

typescript-library-starter uses [vitest](https://vitest.dev/). The coverage is done through vitest, using [c8](https://github.com/bcoe/c8).

Commands:

- `test`: runs vitest test runner
- `test:watch`: runs vitest test runner in watch mode
- `test:coverage`: runs vitest test runner and generates coverage reports

### Format & lint

This template relies on the combination of [eslint](https://github.com/eslint/eslint) — through [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) for linting and [prettier](https://github.com/prettier/prettier) for formatting.
It also uses [cspell](https://github.com/streetsidesoftware/cspell) to ensure spelling

Commands:

- `format`: runs prettier with automatic fixing
- `format:check`: runs prettier without automatic fixing (used in CI)
- `lint`: runs eslint with automatic fixing
- `lint:check`: runs eslint without automatic fixing (used in CI)
- `spell:check`: runs spellchecking

### Releasing

Under the hood, this service uses [semantic-release](https://github.com/semantic-release/semantic-release) and [commitizen](https://github.com/commitizen/cz-cli).
The goal is to avoid manual release process. Using `semantic-release` will automatically create a github release (hence tags) as well as an npm release.
Based on your commit history, `semantic-release` will automatically create a patch, feature or breaking release.

Commands:

- `cz`: interactive CLI that helps you generate a proper git commit message, using [commitizen](https://github.com/commitizen/cz-cli)
- `semantic-release`: triggers a release (used in CI)
