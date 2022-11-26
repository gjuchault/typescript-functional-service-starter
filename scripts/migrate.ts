import path from "node:path";
import fs from "node:fs/promises";
import "dotenv/config";
import { createPool } from "slonik";
import launchEditor from "launch-editor";
import { z } from "zod";
import { getConfig } from "../src/config";
import {
  buildMigration,
  readMigrations,
} from "../src/infrastructure/database/migration";
import { makeSlonikFunctionalWrapper } from "../src/infrastructure/database";

const migrationsPath = path.join(__dirname, "../migrations");

export async function migrate(args = process.argv.slice(2), exit = true) {
  const database = makeSlonikFunctionalWrapper(
    await createPool(getConfig().databaseUrl)
  );
  const migrationFiles = await readMigrations(database);
  const umzug = buildMigration({
    migrationFiles,
    database,
  });

  umzug.on("migrating", ({ name }) => {
    process.stdout.write(`🐘 migrating ${name}`);
  });

  umzug.on("migrated", () => {
    console.log(" ✅");
  });

  const command = z
    .union([z.literal("up"), z.literal("create")])
    .parse(args[0]);

  switch (command) {
    case "up":
      await umzug.up();
      break;
    case "create":
      const name = z.string().parse(args[1]);
      await create(name);
      break;
  }

  if (exit) {
    process.exit(0);
  }
}

async function create(name: string) {
  const now = new Date();
  const prefix = [
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ].join("");

  const slug = name.replace(/^\s+|\s+_$/g, "-");

  const fileName = `${prefix}_${slug}.sql`;
  const filePath = path.join(migrationsPath, fileName);

  await fs.writeFile(filePath, `select 1;\n`);
  await launchEditor(filePath);
}

if (require.main === module) {
  migrate();
}
