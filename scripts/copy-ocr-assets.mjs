import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const publicRoot = join(root, "public", "ocr");
const coreRoot = join(publicRoot, "core");
const langRoot = join(publicRoot, "lang");

await mkdir(coreRoot, { recursive: true });
await mkdir(langRoot, { recursive: true });

await copyFile(
  join(root, "node_modules", "tesseract.js", "dist", "worker.min.js"),
  join(publicRoot, "worker.min.js")
);

for (const name of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm"
]) {
  await copyFile(join(root, "node_modules", "tesseract.js-core", name), join(coreRoot, name));
}

await copyFile(
  join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz"),
  join(langRoot, "eng.traineddata.gz")
);
