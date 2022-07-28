import { context, trace } from "@opentelemetry/api";
import { createHttpTerminator } from "http-terminator";
import ms from "ms";
import type { Config } from "../../config";
import type { FastifyServer } from "../../infrastructure/http";
import type { Cache } from "../cache";
import type { Database } from "../database";
import { promiseWithTimeout } from "../helpers/promise-timeout";
import type { Logger } from "../logger";
import type { Telemetry } from "../telemetry";

interface Dependencies {
  logger: Logger;
  fastify: FastifyServer;
  database: Database;
  cache: Cache;
  telemetry: Telemetry;
  config: Config;
  exit: (statusCode: number) => void;
}

export function createShutdownManager({
  logger,
  fastify,
  database,
  cache,
  telemetry,
  config,
  exit,
}: Dependencies) {
  const httpTerminator = createHttpTerminator({
    server: fastify.server,
    gracefulTerminationTimeout: ms("10s"),
  });

  let isShuttingDown = false;

  async function shutdown(shouldExit = true) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    logger.info("received termination event, shutting down...")();

    const gracefulShutdownTimeout = "20s";

    async function gracefulShutdown() {
      await httpTerminator.terminate();
      logger.debug("http server shut down")();
      await database.end()();
      logger.debug("database shut down")();
      await cache.quit()();
      logger.debug("cache shut down")();
      await telemetry.shutdown();
      context.disable();
      trace.disable();
      logger.debug("telemetry shut down")();

      return true;
    }

    let success = true;
    try {
      await promiseWithTimeout(ms(gracefulShutdownTimeout), gracefulShutdown);
    } catch {
      success = false;
    }

    if (!success) {
      logger.fatal(
        `could not gracefully shut down service ${config.name} after ${gracefulShutdownTimeout}`,
        {
          version: config.version,
          nodeVersion: process.version,
          arch: process.arch,
          platform: process.platform,
        }
      )();

      if (shouldExit) {
        return exit(1);
      }
    } else {
      logger.info(`gracefully shut down service ${config.name}`, {
        version: config.version,
        nodeVersion: process.version,
        arch: process.arch,
        platform: process.platform,
      })();
    }

    logger.flush()();

    if (shouldExit) {
      return exit(0);
    }
  }

  function listenToProcessEvents() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.addListener("SIGTERM", async () => {
      await shutdown();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.addListener("SIGINT", async () => {
      await shutdown();
    });
  }

  return { listenToProcessEvents, shutdown };
}
