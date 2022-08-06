import * as E from "fp-ts/lib/Either";
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
  readonly quit: () => TE.TaskEither<Error, string>;
}

export function createCacheStorage({
  telemetry,
  config,
}: Dependencies): TE.TaskEither<
  Error,
  { readonly cache: Cache; readonly redis: Redis }
> {
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

    logger.error("redis error", { error })();
  });

  return telemetry.withSpan<
    Error,
    { readonly redis: Redis; readonly cache: Cache }
  >(
    "redis.connect",
    getSpanOptions(config.redisUrl)
  )(async () => {
    logger.debug("connecting to redis...")();

    try {
      await promiseWithTimeout(ms("2s"), () => redis.echo("1"));
    } catch (error) {
      logger.error("redis connection error", { error })();
      return E.left(E.toError(error));
    }

    logger.info("connected to redis")();

    return E.right({ redis, cache: makeRedisFunctionalWrapper(redis) });
  });
}

function makeRedisFunctionalWrapper(redis: Redis): Cache {
  return {
    echo(input: string) {
      return TE.tryCatch(
        () => redis.echo(input),
        (redisError) => E.toError(redisError)
      );
    },
    quit() {
      return TE.tryCatch(
        async () => {
          await redis.quit();
          redis.disconnect();
          return "ok";
        },
        (redisError) => E.toError(redisError)
      );
    },
  };
}

function isRedisError(error: unknown): error is object {
  return typeof error === "object" && error !== null;
}

function isRedisConnRefusedError(
  error: object
): error is { readonly code: string } {
  if ("code" in error) {
    return (error as { readonly code: string }).code === "ECONNREFUSED";
  }

  return false;
}
