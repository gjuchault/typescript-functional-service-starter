import { pipe } from "fp-ts/lib/function";
import * as RT from "fp-ts/lib/ReaderTask";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { sql } from "slonik";
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
          (pool: DatabasePoolConnection) => pool.query(sql`select 1`),
          database.runInConnection,
          TE.fold<Error, unknown, GetHealthcheckResult>(
            () => T.of({ outcome: "unhealthy" }),
            () => T.of({ outcome: "healthy" })
          )
        )
      )
    )
  );
