import fs from "node:fs/promises";
import path from "node:path";
import * as E from "fp-ts/lib/Either";
import { sql } from "slonik";
import { InputMigrations, Umzug } from "umzug";
import { z } from "zod";
import type { Database } from ".";

export function buildMigration({
  migrationFiles,
  database,
}: {
  readonly migrationFiles: InputMigrations<Record<never, never>>;
  readonly database: Database;
}) {
  async function ensureTable() {
    await database.runInConnection((pool) =>
      pool.query(sql.type(z.unknown())`
        create table if not exists "public"."migrations" (
          "name" varchar, primary key ("name")
        );
      `)
    )();
  }

  async function executed() {
    await ensureTable();
    const migrationsResult = await database.runInConnection((pool) =>
      pool.anyFirst(sql.type(z.object({ name: z.string() }))`
        select "name"
        from "public"."migrations"
        order by "name" asc;
      `)
    )();

    if (E.isLeft(migrationsResult)) {
      throw migrationsResult.left;
    }

    return [...migrationsResult.right];
  }

  async function logMigration({ name }: { readonly name: string }) {
    await database.runInConnection((pool) =>
      pool.query(sql.type(z.unknown())`
        insert into "public"."migrations" ("name")
        values (${name});
      `)
    )();
  }

  async function unlogMigration({ name }: { readonly name: string }) {
    await ensureTable();

    await database.runInConnection((pool) =>
      pool.query(sql.type(z.unknown())`
        delete from "public"."migrations"
        where "name" = ${name};
      `)
    )();
  }

  const umzug = new Umzug<Record<never, never>>({
    migrations: migrationFiles,
    logger: undefined,
    storage: {
      executed,
      logMigration,
      unlogMigration,
    },
  });

  return umzug;
}

// eslint-disable-next-line unicorn/prefer-module
const migrationsPath = path.join(__dirname, "../../../migrations");

/**
 * Do not use this in production, as it assumes the file structure
 * Should only be used in tests
 */
export async function readMigrations(database: Database) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const migrationsFiles = await fs.readdir(migrationsPath);
  return await Promise.all(
    migrationsFiles
      .filter((file) => file.endsWith(".sql"))
      .map(async (file) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = await fs.readFile(
          path.join(migrationsPath, file),
          "utf8"
        );

        const query = sql.type(z.unknown())([content]);

        return {
          name: file.slice(file.indexOf("_") + 1, -1 * ".sql".length),
          async up() {
            await database.runInConnection((pool) => pool.query(query))();
          },
          async down() {
            // nothing to do
          },
        };
      })
  );
}
