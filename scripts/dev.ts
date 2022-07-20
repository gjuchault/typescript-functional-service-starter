import path from "node:path";
import ms from "ms";
import { ChildProcess, fork } from "node:child_process";
import { build } from "./build";

const rootPath = path.join(__dirname, "..");
const bundleFilePath = path.join(rootPath, "build", "index.js");

async function main() {
  await build({
    watch: {
      onRebuild(error) {
        if (error) {
          console.error(error);
          return;
        }

        onBuild(true);
      },
    },
  });

  onBuild();
}

let subProcess: ChildProcess | undefined = undefined;

async function onBuild(isRebuild = false) {
  await killSubProcess();

  if (isRebuild) {
    console.log();
    console.log("=".repeat(50));
    console.log("=".repeat(50));
    console.log();
  }

  subProcess = fork(bundleFilePath, [], {
    cwd: rootPath,
    execPath: process.execPath,
    env: {
      NODE_ENV: "development",
    },
    execArgv: ["--inspect=0.0.0.0:9229"],
  });
}

async function killSubProcess() {
  return new Promise((resolve) => {
    if (!subProcess) {
      resolve(undefined);
      return;
    }

    subProcess.on("close", () => {
      subProcess = undefined;
      resolve(undefined);
    });

    setTimeout(() => {
      subProcess?.kill("SIGKILL");
      subProcess = undefined;
      resolve(subProcess);
    }, ms("5s"));

    subProcess.kill();
  });
}

if (require.main === module) {
  main();
}
