import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { createHttpTerminator } from "http-terminator";
import ms from "ms";
import type { Config } from "../../config";
import type { FastifyServer } from "../../infrastructure/http";
import type { Cache } from "../cache";
import type { Database } from "../database";
import { noConcurrency } from "../helpers/no-concurrency";
import { taskEitherWithTimeout } from "../helpers/promise-timeout";
import type { Logger } from "../logger";
import type { Telemetry } from "../telemetry";

interface Dependencies {
  readonly logger: Logger;
  readonly fastify: FastifyServer;
  readonly database: Database;
  readonly cache: Cache;
  readonly telemetry: Telemetry;
  readonly config: Config;
  readonly exit: (statusCode: number) => void;
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
  const gracefulShutdownTimeout = "20s";
  const httpTerminator = createHttpTerminator({
    server: fastify.server,
    gracefulTerminationTimeout: ms("10s"),
  });

  const gracefulShutdown = () =>
    pipe(
      pipe(
        logger.info("received termination event, shutting down..."),
        () => TE.tryCatch(httpTerminator.terminate, E.toError),
        TE.chainFirstIOK(() => logger.debug("http server shut down")),
        TE.chain(() => database.end()),
        TE.chainFirstIOK(() => logger.debug("database shut down")),
        TE.chain(() => cache.quit()),
        TE.chainFirstIOK(() => logger.debug("cache shut down")),
        TE.chain(() => telemetry.shutdown()),
        TE.chainFirstIOK(() => logger.debug("telemetry shut down"))
      ),
      noConcurrency(),
      taskEitherWithTimeout(ms(gracefulShutdownTimeout))
    );

  const shutdown = (shouldExit = true) =>
    pipe(
      gracefulShutdown(),
      TE.bimap(
        flow(
          (error) =>
            logger.fatal(
              `could not gracefully shut down service ${config.name} after ${gracefulShutdownTimeout}`,
              {
                version: config.version,
                nodeVersion: process.version,
                arch: process.arch,
                platform: process.platform,
                error: error.message,
              }
            )(),
          () => (shouldExit ? exit(1) : undefined)
        ),
        flow(
          logger.info(`gracefully shut down service ${config.name}`, {
            version: config.version,
            nodeVersion: process.version,
            arch: process.arch,
            platform: process.platform,
          }),
          () => (shouldExit ? exit(0) : undefined)
        )
      )
    );

  function listenToProcessEvents() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.addListener("SIGTERM", async () => {
      await shutdown()();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.addListener("SIGINT", async () => {
      await shutdown()();
    });
  }

  return { listenToProcessEvents, shutdown };
}
