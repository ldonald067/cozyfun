import { spawn } from "node:child_process";

const windowsTestToolchain = process.env.COZY_RUST_TEST_TOOLCHAIN ?? "stable-x86_64-pc-windows-gnu";
const cargoArgs =
  process.platform === "win32"
    ? [`+${windowsTestToolchain}`, "test", "--manifest-path", "sim/Cargo.toml"]
    : ["test", "--manifest-path", "sim/Cargo.toml"];

const child = spawn("cargo", cargoArgs, {
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(error.message);
  if (process.platform === "win32") {
    console.error(`Install the Windows GNU test toolchain with: rustup toolchain install ${windowsTestToolchain}`);
  }
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`cargo test stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
