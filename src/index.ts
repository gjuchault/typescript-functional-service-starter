#!/usr/bin/env node
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import type { Redis } from "ioredis";
import { Config, getConfig } from "./config";
import { createCacheStorage, Cache } from "./infrastructure/cache";
import { createDatabase, Database } from "./infrastructure/database";
import {
  createHttpServer,
  HttpServer,
  FastifyServer,
} from "./infrastructure/http";
import { createLogger } from "./infrastructure/logger";
import { createShutdownManager } from "./infrastructure/shutdown";
import { createTelemetry } from "./infrastructure/telemetry";
import { bindHttpRoutes } from "./presentation/http";

export async function startApp(configOverride: Partial<Config> = {}) {
  const config = getConfig(configOverride);
  const telemetry = await createTelemetry({ config });

  const logger = createLogger("app", { config });

  const appStartedTimestamp = Date.now();
  logger.info(`starting service ${config.name}...`, {
    version: config.version,
    nodeVersion: process.version,
    arch: process.arch,
    platform: process.platform,
  })();

  let database: Database;
  let redis: Redis;
  let cache: Cache;
  let httpServer: HttpServer;
  let fastify: FastifyServer;

  try {
    const cacheResult = await createCacheStorage({
      config,
      telemetry,
    })();

    if (E.isLeft(cacheResult)) {
      logger.error(`${config.name} startup error: cache connection failed`, {
        error: cacheResult.left,
      })();

      process.exit(1);
    }

    ({ cache, redis } = cacheResult.right);

    const databaseResult = await createDatabase({
      config,
      telemetry,
    })();

    if (E.isLeft(databaseResult)) {
      logger.error(`${config.name} startup error: database connection failed`, {
        error: databaseResult.left,
      })();

      process.exit(1);
    }

    database = databaseResult.right;

    ({ fastify, httpServer } = await createHttpServer({
      config,
      redis,
      telemetry,
    }));
  } catch (error) {
    logger.error(`${config.name} startup error`, {
      error: (error as Record<string, unknown>).message ?? error,
    })();
    process.exit(1);
  }

  await pipe({ cache, database, httpServer }, bindHttpRoutes())();

  const shutdown = createShutdownManager({
    logger,
    cache,
    database,
    fastify,
    telemetry,
    config,
    exit: (statusCode?: number) => {
      logger.flush()();
      process.exit(statusCode);
    },
  });

  shutdown.listenToProcessEvents();

  const listeningAbsoluteUrl = await fastify.listen({
    host: config.address,
    port: config.port,
  });

  logger.info(`${config.name} server listening on ${listeningAbsoluteUrl}`, {
    version: config.version,
    nodeVersion: process.version,
    arch: process.arch,
    platform: process.platform,
    startupTime: Date.now() - appStartedTimestamp,
  })();

  return {
    httpServer,
    fastify,
    database,
    cache,
    shutdown,
  };
}

// eslint-disable-next-line unicorn/prefer-module -- Not ESM yet
if (require.main === module) {
  // eslint-disable-next-line unicorn/prefer-top-level-await -- Not ESM yet
  startApp().catch((error) => {
    throw error;
  });
}
