import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { cp, mkdir, rm } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.mjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    packages: "external",
    logLevel: "info",
  });

  await mkdir("server/public/downloads", { recursive: true });
  await cp("server/public/downloads", "dist/downloads", {
    recursive: true,
    force: true,
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
