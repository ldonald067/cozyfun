// node .tmp/phoneperf/build.mjs -> .tmp/phoneperf/phone-timer.html
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
const here = import.meta.dirname, commit = execSync("git rev-parse --short HEAD").toString().trim();
const js = (await build({ entryPoints: [resolve(here, "bench.ts")], bundle: true, minify: true, write: false, format: "iife", target: "es2020", define: { __BUILD__: JSON.stringify(commit) } })).outputFiles[0].text;
writeFileSync(resolve(here, "phone-timer.html"), readFileSync(resolve(here, "shell.html"), "utf8") + "<script>" + js.replace(/<\/script/g, "<\\/script") + "</script>\n");
console.log("ok", Math.round(js.length / 1024), "KB at", commit);
