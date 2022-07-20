import ms from "ms";
import { sql, createPool, DatabasePool } from "slonik";
import { createLogger } from "../logger";
import type { Telemetry } from "../telemetry";
import {
  getSpanOptions,
  createSlonikTelemetryInterceptor,
} from "../telemetry/instrumentations/slonik";

interface Dependencies {
  url: string;
  telemetry: Telemetry;
}

export type Database = DatabasePool;

export async function createDatabase({
  url,
  telemetry,
}: Dependencies): Promise<Database> {
  const logger = createLogger("database");

  const pool = createPool(url, {
    captureStackTrace: false,
    statementTimeout: ms("20s"),
    interceptors: [createSlonikTelemetryInterceptor({ telemetry })],
  });

  return telemetry.startSpan(
    "database.connect",
    getSpanOptions({ pool }),
    async () => {
      logger.debug(`connecting to database...`);

      await pool.query(sql`select 1`);

      logger.info(`connected to database`);

      return pool;
    }
  );
}
