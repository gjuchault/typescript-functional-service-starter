import { exec } from "node:child_process";
import { build } from "./build";

async function main() {
  await build();

  const appProcess = exec("node build", {
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  appProcess.stdout?.pipe(process.stdout);
  appProcess.stderr?.pipe(process.stderr);

  let interval = setInterval(async () => {
    try {
      const fetchResult = await fetch("http://127.0.0.1:8080/healthcheck");

      if (fetchResult.ok || process.env.CI !== undefined) {
        process.exit(0);
      }
    } catch {}
  }, 1000);

  setTimeout(() => {
    clearInterval(interval);
    console.error(
      "Server did not return HTTP 200 on GET /healthcheck after 10 seconds"
    );
    process.exit(1);
  }, 10 * 1000);
}

if (require.main === module) {
  main();
}
