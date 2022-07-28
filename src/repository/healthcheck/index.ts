import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { sql } from "slonik";
import type {
  Database,
  DatabasePoolConnection,
} from "../../infrastructure/database";

export interface HealthcheckRepository {
  readonly getHealthcheck: () => T.Task<GetHealthcheckResult>;
}

export type GetHealthcheckResult =
  | { readonly outcome: "healthy" }
  | { readonly outcome: "unhealthy" };

export function createHealthcheckRepository({
  database,
}: {
  readonly database: Database;
}): HealthcheckRepository {
  function getHealthcheck(): T.Task<GetHealthcheckResult> {
    return pipe(
      (pool: DatabasePoolConnection) => pool.query(sql`select 1`),
      database.runInConnection,
      TE.fold<Error, unknown, GetHealthcheckResult>(
        () => T.of({ outcome: "unhealthy" }),
        () => T.of({ outcome: "healthy" })
      )
    );
  }

  return { getHealthcheck };
}
