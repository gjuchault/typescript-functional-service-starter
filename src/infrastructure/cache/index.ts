import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { default as Redis } from "ioredis";
import ms from "ms";
import type { Config } from "../../config";
import { promiseWithTimeout } from "../helpers/promise-timeout";
import { createLogger } from "../logger";
import type { Telemetry } from "../telemetry";
import { getSpanOptions } from "../telemetry/instrumentations/ioredis";

interface Dependencies {
  readonly config: Config;
  readonly telemetry: Telemetry;
}

export interface Cache {
  readonly echo: (input: string) => TE.TaskEither<Error, string>;
  readonly quit: () => T.Task<void>;
}

export async function createCacheStorage({
  telemetry,
  config,
}: Dependencies): Promise<{ cache: Cache; redis: Redis }> {
  const logger = createLogger("redis", { config });

  const redis = new Redis(config.redisUrl, {});

  redis.on("error", (error) => {
    if (!isRedisError(error)) {
      throw error;
    }

    // these will be spamming quite a log stderr
    if (isRedisConnRefusedError(error)) {
      return;
    }

    logger.error("redis error", { error });
  });

  return telemetry.startSpan(
    "redis.connect",
    getSpanOptions(config.redisUrl),
    async () => {
      logger.debug("connecting to redis...");

      try {
        await promiseWithTimeout(ms("2s"), () => redis.echo("1"));
      } catch (error) {
        logger.error("redis connection error", { error });
        throw error;
      }

      logger.info("connected to redis");

      return { redis, cache: makeRedisFunctionalWrapper(redis) };
    }
  );
}

function makeRedisFunctionalWrapper(redis: Redis): Cache {
  return {
    echo(input: string) {
      return TE.tryCatch(
        () => redis.echo(input),
        (redisError) => redisError as Error
      );
    },
    quit() {
      return async function () {
        await redis.quit();
      };
    },
  };
}

function isRedisError(error: unknown): error is object {
  return typeof error === "object" && error !== null;
}

function isRedisConnRefusedError(error: object): error is { code: string } {
  if ("code" in error) {
    return (error as { code: string }).code === "ECONNREFUSED";
  }

  return false;
}
