import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { sql, createPool } from "slonik";
import {
  ConnectionRoutine,
  DatabasePool,
  TransactionFunction,
} from "slonik/dist/src/types";
import { z } from "zod";
import type { Config } from "../../config";
import { createLogger } from "../logger";
import type { Telemetry } from "../telemetry";
import {
  getSpanOptions,
  createSlonikTelemetryInterceptor,
} from "../telemetry/instrumentations/slonik";

interface Dependencies {
  readonly config: Config;
  readonly telemetry: Telemetry;
}

export interface Database {
  readonly runInConnection: <Result>(
    callback: ConnectionRoutine<Result>
  ) => TE.TaskEither<Error, Result>;
  readonly runInTransaction: <Result>(
    callback: TransactionFunction<Result>
  ) => TE.TaskEither<Error, Result>;
  readonly end: () => TE.TaskEither<Error, boolean>;
}

export { DatabasePoolConnection } from "slonik";

export function createDatabase({
  config,
  telemetry,
}: Dependencies): TE.TaskEither<Error, Database> {
  const logger = createLogger("database", { config });

  const {
    databaseIdleTimeout: idleTimeout,
    databaseStatementTimeout: statementTimeout,
    databaseMaximumPoolSize: maximumPoolSize,
    databaseUrl: url,
  } = config;

  return telemetry.withSpan<Error, Database>(
    "database.connect",
    getSpanOptions({ idleTimeout, maximumPoolSize })
  )(async () => {
    logger.debug(`connecting to database...`)();

    let pool: DatabasePool;

    try {
      pool = await createPool(url, {
        captureStackTrace: false,
        statementTimeout,
        interceptors: [createSlonikTelemetryInterceptor({ telemetry })],
        idleTimeout,
        maximumPoolSize,
      });

      await pool.query(sql.type(z.unknown())`select 1`);
    } catch (error) {
      return E.left(E.toError(error));
    }

    logger.info(`connected to database`)();

    return E.right(makeSlonikFunctionalWrapper(pool));
  });
}

export function makeSlonikFunctionalWrapper(pool: DatabasePool): Database {
  return {
    runInConnection(callback) {
      return TE.tryCatch(() => pool.connect(callback), E.toError);
    },
    runInTransaction(callback) {
      return TE.tryCatch(() => pool.transaction(callback), E.toError);
    },
    end() {
      return TE.tryCatch(async () => {
        await pool.end();
        return true;
      }, E.toError);
    },
  };
}
