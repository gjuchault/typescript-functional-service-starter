#!/usr/bin/env node
import type { Redis } from "ioredis";
import { createHealthcheckApplication } from "./application/healthcheck";
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
import { createRepository } from "./repository";

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
    ({ redis, cache } = await createCacheStorage({
      config,
      telemetry,
    }));

    database = await createDatabase({
      config,
      telemetry,
    });

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

  const repository = createRepository({
    database,
  });

  const healthcheckApplication = createHealthcheckApplication({
    cache,
    healthcheckRepository: repository.healthcheck,
  });

  bindHttpRoutes({ httpServer, healthcheckApplication });

  const shutdown = createShutdownManager({
    logger,
    cache,
    database,
    fastify,
    telemetry,
    config,
    exit: (statusCode?: number) => process.exit(statusCode),
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
