const fs = require("fs");
const path = require("path");

const srcDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm"
);
const destDir = path.join(__dirname, "..", "public", "wasm");

if (!fs.existsSync(srcDir)) {
  console.warn("copy-wasm: @mediapipe/tasks-vision wasm not found, skip.");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const name of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
}
console.log("copy-wasm: copied MediaPipe WASM to public/wasm");
