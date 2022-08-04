import path from "node:path";
import fs from "node:fs/promises";
import { format } from "prettier";
import * as ts from "typescript";
import { compilerOptions } from "../tsconfig.json";
import { parse, generate, Endpoint } from "./openapi-client-generator";
import { startApp } from "../src";

const clientDir = path.resolve(__dirname, "../client");
const outputSrc = path.join(clientDir, "./src");
const outputSrcIndex = path.join(clientDir, "./src/index.ts");
const outputBuild = path.join(clientDir, "./build");

async function client() {
  await prepareDirectories();

  const parsedSchema = await startAppAndFetchSchema();

  await createSrcClient(parsedSchema);
  await createBuildClient();
}

async function prepareDirectories() {
  await fs.rm(outputSrc, {
    recursive: true,
    force: true,
  });

  await fs.rm(outputBuild, {
    recursive: true,
    force: true,
  });

  await fs.mkdir(outputSrc, { recursive: true });
  await fs.mkdir(outputBuild, { recursive: true });
}

async function startAppAndFetchSchema() {
  const startTime = Date.now();
  process.stdout.write("Starting app and fetching schema... ");

  const { default: getPort } = await import("get-port");
  const port = await getPort();

  const app = await startApp({
    port,
    logLevel: "error",
  });

  const response = await app.fastify.inject("/docs");
  const schema = response.json();

  await app.shutdown.shutdown(false)();

  const parsedSchema = await parse(schema);
  console.log(`(${Date.now() - startTime}ms)`);

  return parsedSchema;
}

async function createSrcClient(parsedSchema: {
  endpoints: Endpoint[];
  interfaces: string[];
}) {
  const startTime = Date.now();
  process.stdout.write("Running prettier and writing source file... ");

  const client = format(generate(parsedSchema), { parser: "typescript" });
  await fs.writeFile(outputSrcIndex, client);

  console.log(`(${Date.now() - startTime}ms)`);
}

async function createBuildClient() {
  const tsOptions: ts.CompilerOptions = {
    ...compilerOptions,
    module: compilerOptions.module as unknown as ts.ModuleKind,
    target: compilerOptions.target as unknown as ts.ScriptTarget,
    rootDir: clientDir,
    outDir: "build",
    sourceMap: true,
    declaration: true,
  };
  const tsFiles = new Map<string, string>();

  const host = ts.createCompilerHost(tsOptions);
  host.writeFile = (filename, data) => {
    tsFiles.set(filename, data);
  };
  const program = ts.createProgram([outputSrcIndex], tsOptions, host);
  program.emit();

  for (const [filename, content] of tsFiles) {
    await fs.writeFile(
      path.join(clientDir, filename.replace("/src", "")),
      content
    );
  }
}

if (require.main === module) {
  client();
}
