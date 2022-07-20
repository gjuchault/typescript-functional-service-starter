import path from "node:path";
import { build as esbuild, BuildOptions } from "esbuild";

export async function build(opts: Partial<BuildOptions> = {}) {
  const result = await esbuild({
    platform: "node",
    target: "esnext",
    format: "cjs",
    nodePaths: [path.join(__dirname, "../src")],
    sourcemap: true,
    external: ["pg-native"],
    bundle: true,
    outdir: path.join(__dirname, "../build"),
    entryPoints: [path.join(__dirname, "../src/index.ts")],
    ...opts,
  });

  return result;
}

if (require.main === module) {
  build();
}
