import { sql } from "slonik";
import { beforeAll } from "vitest";
import { startApp } from "../index";
import {
  buildMigration,
  readMigrations,
} from "../infrastructure/database/migration";
import type { HttpServer } from "../infrastructure/http";

let http: HttpServer | undefined;

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
  });

  const {
    database,
    httpServer,
    shutdown: { shutdown },
  } = app;

  http = httpServer;

  await database.query(
    sql`
      do $$ declare
          r record;
      begin
          for r in (select tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema')) loop
              execute 'drop table if exists ' || quote_ident(r.tablename) || ' cascade';
          end loop;
      end $$;
    `
  );

  const migrationFiles = await readMigrations(database);

  const migration = buildMigration({
    database,
    migrationFiles,
  });

  await migration.up();

  return async () => {
    await shutdown(false);
  };
});
