import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import ms from "ms";
import { sql, createPool } from "slonik";
import {
  ConnectionRoutine,
  DatabasePool,
  TransactionFunction,
} from "slonik/dist/src/types";
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

export interface Database {
  readonly runInConnection: <Result>(
    callback: ConnectionRoutine<Result>
  ) => TE.TaskEither<Error, Result>;
  readonly runInTransaction: <Result>(
    callback: TransactionFunction<Result>
  ) => TE.TaskEither<Error, Result>;
  readonly end: () => T.Task<void>;
}

export { DatabasePoolConnection } from "slonik";

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

      return makeSlonikFunctionalWrapper(pool);
    }
  );
}

export function makeSlonikFunctionalWrapper(pool: DatabasePool): Database {
  return {
    runInConnection(callback) {
      return TE.tryCatch(
        async () => pool.connect(callback),
        (error) => error as Error
      );
    },
    runInTransaction(callback) {
      return TE.tryCatch(
        async () => pool.transaction(callback),
        (error) => error as Error
      );
    },
    end() {
      return async function () {
        await pool.end();
      };
    },
  };
}
