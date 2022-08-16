#!/usr/bin/env node
import * as Apply from "fp-ts/Apply";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { Config, getConfig } from "./config";
import { createCacheStorage } from "./infrastructure/cache";
import { createDatabase } from "./infrastructure/database";
import { createHttpServer } from "./infrastructure/http";
import { createLogger } from "./infrastructure/logger";
import { createShutdownManager } from "./infrastructure/shutdown";
import { createTelemetry } from "./infrastructure/telemetry";
import { bindHttpRoutes } from "./presentation/http";

export const startApp = (configOverride: Partial<Config> = {}) =>
  pipe(
    getConfig(configOverride),
    (config) =>
      Apply.sequenceS(TE.ApplyPar)({
        telemetry: createTelemetry({ config }),
        logger: TE.of(createLogger("app", { config })),
        appStartedTimestamp: TE.of(Date.now()),
        config: TE.of(config),
      }),
    TE.chainFirstIOK(({ logger, config }) =>
      logger.info(`starting service ${config.name}...`, {
        version: config.version,
        nodeVersion: process.version,
        arch: process.arch,
        platform: process.platform,
      })
    ),
    TE.bind("cache", ({ config, telemetry }) =>
      createCacheStorage({ config, telemetry })
    ),
    TE.bind("database", ({ config, telemetry }) =>
      createDatabase({ config, telemetry })
    ),
    TE.bind("http", ({ cache, config, telemetry }) =>
      createHttpServer({ config, redis: cache.redis, telemetry })
    ),
    TE.chainFirst(({ cache, database, http }) =>
      TE.fromTask(
        pipe(
          { cache: cache.cache, database, httpServer: http.httpServer },
          bindHttpRoutes()
        )
      )
    ),
    TE.bind(
      "shutdown",
      ({ cache, config, database, http, logger, telemetry }) =>
        TE.of(
          createShutdownManager({
            logger,
            cache: cache.cache,
            database,
            fastify: http.fastify,
            telemetry,
            config,
            exit: (statusCode?: number) => {
              logger.flush()();
              process.exit(statusCode);
            },
          })
        )
    ),
    TE.chainFirst(({ shutdown }) => shutdown.listenToProcessEvents()),
    TE.bind("listeningAbsoluteUrl", ({ http, config }) =>
      http.listen(config.address, config.port)
    ),
    TE.chainFirstIOK(
      ({ logger, config, appStartedTimestamp, listeningAbsoluteUrl }) =>
        logger.info(
          `${config.name} server listening on ${listeningAbsoluteUrl}`,
          {
            version: config.version,
            nodeVersion: process.version,
            arch: process.arch,
            platform: process.platform,
            startupTime: Date.now() - appStartedTimestamp,
          }
        )
    )
  );

async function main() {
  const result = await startApp()();

  if (E.isLeft(result)) {
    console.error(result.left);
    process.exit(1);
  }
}

// eslint-disable-next-line unicorn/prefer-module -- Not ESM yet
if (require.main === module) {
  // eslint-disable-next-line unicorn/prefer-top-level-await -- Not ESM yet
  void main();
}
