import ms from "ms";
import "dotenv/config";
import { z } from "zod";

import { version, description } from "../package.json";

export interface Config {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly env: "development" | "production" | "test";
  readonly logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  readonly address: string;
  readonly secret: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databaseMaximumPoolSize: number;
  readonly databaseIdleTimeout: number;
  readonly databaseStatementTimeout: number;
  readonly redisUrl: string;
  readonly tracingSampling: number;
}

const config: Config = {
  name: "app",
  version,
  description,
  env: z
    .union([
      z.literal("development"),
      z.literal("production"),
      z.literal("test"),
    ])
    .parse(process.env.NODE_ENV),
  logLevel: z
    .union([
      z.literal("fatal"),
      z.literal("error"),
      z.literal("warn"),
      z.literal("info"),
      z.literal("debug"),
      z.literal("trace"),
    ])
    .parse(process.env.LOG_LEVEL),
  address: z.string().parse(process.env.ADDRESS),
  /**
   * Used for cookie signing
   */
  secret: z.string().uuid().parse(process.env.SECRET),

  port: z
    .string()
    .refine((databaseMaximumPoolSize) =>
      refineMinMaxInteger(databaseMaximumPoolSize, { min: 10, max: 65_536 })
    )
    .transform(Number)
    .parse(process.env.PORT),

  databaseUrl: z.string().parse(process.env.DATABASE_URL),

  databaseMaximumPoolSize: z
    .string()
    .refine((databaseMaximumPoolSize) =>
      refineMinMaxInteger(databaseMaximumPoolSize, { min: 0, max: 5000 })
    )
    .transform(Number)
    .parse(process.env.DATABASE_MAXIMUM_POOL_SIZE),

  databaseIdleTimeout: z
    .string()
    .min(1)
    .refine(refineMs)
    .transform(ms)
    .parse(process.env.DATABASE_IDLE_TIMEOUT),

  databaseStatementTimeout: z
    .string()
    .min(1)
    .refine(refineMs)
    .transform(ms)
    .parse(process.env.DATABASE_STATEMENT_TIMEOUT),

  redisUrl: z.string().parse(process.env.REDIS_URL),

  tracingSampling: z
    .string()
    .refine((tracingSampling) =>
      refineMinMaxFloat(tracingSampling, { min: 0, max: 1 })
    )
    .transform(Number)
    .parse(process.env.TRACING_SAMPLING),
};

export function getConfig(configOverride: Partial<Config> = {}): Config {
  return {
    ...config,
    ...configOverride,
  };
}

export function refineMs(value: string): boolean {
  // ms might come with a validation function starting v3.0.0
  // eslint-disable-next-line functional/no-try-statement
  try {
    return Number.isSafeInteger(ms(value));
  } catch {
    return false;
  }
}

export function refineMinMaxInteger(
  valueAsString: string,
  { min, max }: { readonly min: number; readonly max: number }
): boolean {
  const value = Number(valueAsString);

  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function refineMinMaxFloat(
  valueAsString: string,
  { min, max }: { readonly min: number; readonly max: number }
): boolean {
  const value = Number(valueAsString);

  return value >= min && value <= max;
}
