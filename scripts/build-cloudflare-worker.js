import { build } from "esbuild";

await build({
  entryPoints: ["src/cloudflare/worker.ts"],
  outfile: "public/_worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
