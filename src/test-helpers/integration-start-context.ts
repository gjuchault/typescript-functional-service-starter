import * as E from "fp-ts/lib/Either";
import { sql } from "slonik";
import { beforeAll } from "vitest";
import { startApp } from "../index";
import {
  buildMigration,
  readMigrations,
} from "../infrastructure/database/migration";
import type { FastifyServer } from "../infrastructure/http";

let http: FastifyServer | undefined;

export function getHttpTestContext() {
  if (!http) {
    throw new Error("http not yet initialized");
  }

  return http;
}

beforeAll(async () => {
  const app = await startApp({
    port: 1987,
    logLevel: "error",
  })();

  if (E.isLeft(app)) {
    throw E.toError(app.left);
  }

  const {
    database,
    http: { fastify },
    shutdown: { shutdown },
  } = app.right;

  http = fastify;

  const dropAllTables = database.runInConnection((pool) =>
    pool.query(
      sql`
        do $$ declare
            r record;
        begin
            for r in (select tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema')) loop
                execute 'drop table if exists ' || quote_ident(r.tablename) || ' cascade';
            end loop;
        end $$;
      `
    )
  );

  const result = await dropAllTables();

  if (E.isLeft(result)) {
    throw result.left;
  }

  const migrationFiles = await readMigrations(database);

  const migration = buildMigration({
    database,
    migrationFiles,
  });

  await migration.up();

  return async () => {
    await shutdown(false)();
  };
});
