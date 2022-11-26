import { pipe } from "fp-ts/function";
import * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { sql } from "slonik";
import { z } from "zod";
import type {
  Database,
  DatabasePoolConnection,
} from "../../infrastructure/database";

interface Dependencies {
  readonly database: Database;
}

export type GetHealthcheckResult =
  | { readonly outcome: "healthy" }
  | { readonly outcome: "unhealthy" };

export const getHealthcheck = (): RT.ReaderTask<
  Dependencies,
  GetHealthcheckResult
> =>
  pipe(
    RT.ask<Dependencies>(),
    RT.chain(({ database }) =>
      RT.fromTask(
        pipe(
          (pool: DatabasePoolConnection) =>
            pool.query(sql.type(z.unknown())`select 1`),
          database.runInConnection,
          TE.fold<Error, unknown, GetHealthcheckResult>(
            () => T.of({ outcome: "unhealthy" }),
            () => T.of({ outcome: "healthy" })
          )
        )
      )
    )
  );
