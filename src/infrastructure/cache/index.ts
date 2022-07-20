import { default as Redis } from "ioredis";
import ms from "ms";
import { promiseWithTimeout } from "../helpers/promise-timeout";
import { createLogger } from "../logger";
import type { Telemetry } from "../telemetry";
import { getSpanOptions } from "../telemetry/instrumentations/ioredis";

interface Dependencies {
  url: string;
  telemetry: Telemetry;
}

export type Cache = Redis;

export async function createCacheStorage({
  url,
  telemetry,
}: Dependencies): Promise<Cache> {
  const logger = createLogger("redis");

  const redis = new Redis(url, {});

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

  return telemetry.startSpan("redis.connect", getSpanOptions(url), async () => {
    logger.debug("connecting to redis...");

    try {
      await promiseWithTimeout(ms("2s"), () => redis.echo("1"));
    } catch (error) {
      logger.error("redis connection error", { error });
      throw error;
    }

    logger.info("connected to redis");

    return redis;
  });
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
