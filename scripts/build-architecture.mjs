#!/usr/bin/env node
/**
 * Refreshes the appendix of ARCHITECTURE.md: replaces everything between
 *   <!-- BEGIN:path -->  and  <!-- END:path -->
 * with a fenced ts block containing the verbatim file. Run: npm run docs:arch
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(root, "ARCHITECTURE.md");
let doc = readFileSync(docPath, "utf8");

const re = /<!-- BEGIN:(.+?) -->[\s\S]*?<!-- END:\1 -->/g;
let count = 0;
doc = doc.replace(re, (_m, rel) => {
  const src = readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n").trimEnd();
  count++;
  return `<!-- BEGIN:${rel} -->\n\`\`\`ts\n${src}\n\`\`\`\n<!-- END:${rel} -->`;
});

writeFileSync(docPath, doc);
console.log(`architecture: refreshed ${count} appendix block(s)`);
