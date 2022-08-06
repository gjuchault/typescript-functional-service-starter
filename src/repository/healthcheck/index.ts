import { pipe } from "fp-ts/function";
import * as R from "fp-ts/Reader";
import * as T from "fp-ts/Task";
import type { Database } from "../../infrastructure/database";
import { getHealthcheck, GetHealthcheckResult } from "./get-healthcheck";

interface Dependencies {
  readonly database: Database;
}

export interface HealthcheckRepository {
  readonly getHealthcheck: () => T.Task<GetHealthcheckResult>;
}

export const getHealthcheckRepository = (): R.Reader<
  Dependencies,
  HealthcheckRepository
> =>
  pipe(
    R.ask<Dependencies>(),
    R.chain(({ database }) =>
      R.of({
        getHealthcheck: () => getHealthcheck()({ database }),
      })
    )
  );
