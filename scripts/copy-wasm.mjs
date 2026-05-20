import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "sim/target/wasm32-unknown-unknown/release/cozy_sandbox_sim.wasm");
const target = resolve(root, "app/public/sim/cozy_sandbox_sim.wasm");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`Copied ${source} -> ${target}`);
