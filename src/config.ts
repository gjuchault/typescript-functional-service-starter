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
  readonly redisUrl: string;
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
    .refine((portAsString) => {
      const port = Number(portAsString);

      return port > 0 && port < 65_536;
    })
    .transform(Number)
    .parse(process.env.PORT),

  databaseUrl: z.string().parse(process.env.DATABASE_URL),

  redisUrl: z.string().parse(process.env.REDIS_URL),
};

export function getConfig(configOverride: Partial<Config> = {}): Config {
  return {
    ...config,
    ...configOverride,
    databaseUrl: process.env.DATABASE_TEST_URL ?? config.databaseUrl,
  };
}
