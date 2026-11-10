import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([
  ".git",
  ".next",
  ".gateway",
  ".local",
  "node_modules",
  "coverage",
]);
async function markdownFiles(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const full = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...(await markdownFiles(full)));
    else if (item.isFile() && item.name.endsWith(".md")) result.push(full);
  }
  return result;
}
function headings(source) {
  const seen = new Map();
  return new Set(
    [...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => {
      const base = match[1]
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\s-]/gu, "")
        .replace(/\s/g, "-");
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count ? `${base}-${count}` : base;
    }),
  );
}
const files = await markdownFiles(root);
const failures = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(
    /\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) continue;
    try {
      const [relative, fragment] = target.split("#");
      const resolved = relative
        ? path.resolve(path.dirname(file), decodeURIComponent(relative))
        : file;
      await access(resolved);
      if (fragment && resolved.endsWith(".md")) {
        const anchors = headings(await readFile(resolved, "utf8"));
        if (!anchors.has(decodeURIComponent(fragment)))
          throw new Error("missing heading");
      }
    } catch {
      failures.push({ file: path.relative(root, file), target });
    }
  }
}
console.log(
  JSON.stringify(
    { documents: files.length, brokenLocalLinks: failures },
    null,
    2,
  ),
);
process.exitCode = failures.length ? 1 : 0;
