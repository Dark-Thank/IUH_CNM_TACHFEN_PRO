import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const sourceRoot = path.resolve(currentDir, "../src");

const collectJavaScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(absolutePath);
    }

    return entry.name.endsWith(".js") ? [absolutePath] : [];
  }));

  return files.flat().sort();
};

const filesToCheck = await collectJavaScriptFiles(sourceRoot);

for (const filePath of filesToCheck) {
  execFileSync(process.execPath, ["--check", filePath], { stdio: "inherit" });
}

console.log(`Validated syntax for ${filesToCheck.length} files.`);