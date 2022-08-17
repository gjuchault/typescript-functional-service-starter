import { pipe } from 'fp-ts/function';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { sql } from 'slonik';
import type { Database } from '../../infrastructure/database';

interface Dependencies {
  readonly database: Database;
}

export type GetHealthcheckResult =
  | { readonly outcome: 'healthy' }
  | { readonly outcome: 'unhealthy' };

export const getHealthcheck = pipe(
  RT.ask<Dependencies>(),
  RT.chainTaskK(({ database }) =>
    pipe(
      database.runInConnection((pool) => pool.query(sql`select 1`)),
      TE.fold<Error, unknown, GetHealthcheckResult>(
        () => T.of({ outcome: 'unhealthy' }),
        () => T.of({ outcome: 'healthy' })
      )
    )
  )
);
