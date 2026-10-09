#!/usr/bin/env node
/**
 * Builds messages/<locale>.json from messages/_src/<fragment>.<locale>.json.
 *
 *   node scripts/build-messages.mjs            build (fails on conflicts / en<->tr mismatch)
 *   node scripts/build-messages.mjs --check    validate only, write nothing
 *   node scripts/build-messages.mjs --watch    rebuild on change (dev convenience)
 *
 * Rules (see ARCHITECTURE.md > i18n):
 *  - Every fragment exists for every locale: <name>.en.json AND <name>.tr.json.
 *  - A fragment owns its top-level namespace(s). Two fragments must not define the same key path.
 *  - en and tr must have identical key sets and identical ICU argument names per key.
 *  - Values are strings or nested objects. No arrays, numbers or nulls.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, watch } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "messages", "_src");
const OUT = join(root, "messages");
const LOCALES = ["en", "tr"];
const args = new Set(process.argv.slice(2));

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function flatten(obj, prefix = "", out = new Map(), file = "") {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (k.includes(".")) throw new Error(`${file}: key "${key}" contains a dot; use nesting instead`);
    if (typeof v === "string") out.set(key, v);
    else if (isPlainObject(v)) flatten(v, key, out, file);
    else throw new Error(`${file}: value at "${key}" must be a string or object (got ${Array.isArray(v) ? "array" : typeof v})`);
  }
  return out;
}

function icuArgs(str) {
  const names = new Set();
  // Simple argument names at the start of a {...} group: {name}, {count, plural, ...}, {x, select, ...}
  // Branch bodies of plural/select (`one {item}`, `=0 {none}`) are literal text, not arguments.
  const re = /(?<!(?:\b(?:zero|one|two|few|many|other)|=\d+)\s*)\{\s*([A-Za-z_]\w*)\s*[,}]/g;
  let m;
  while ((m = re.exec(str))) names.add(m[1]);
  return [...names].sort().join(",");
}

function setDeep(target, path, value) {
  const parts = path.split(".");
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function sortDeep(obj) {
  if (!isPlainObject(obj)) return obj;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortDeep(obj[k])]));
}

function run() {
  const errors = [];
  if (!existsSync(SRC)) {
    console.error(`messages: ${SRC} does not exist`);
    return false;
  }
  const files = readdirSync(SRC).filter((f) => f.endsWith(".json")).sort();
  const fragments = new Map(); // name -> { locale -> file }
  for (const f of files) {
    const m = /^(.+)\.(en|tr)\.json$/.exec(f);
    if (!m) {
      errors.push(`messages/_src/${f}: file name must be <fragment>.<${LOCALES.join("|")}>.json`);
      continue;
    }
    const [, name, locale] = m;
    if (!fragments.has(name)) fragments.set(name, {});
    fragments.get(name)[locale] = f;
  }
  for (const [name, byLocale] of fragments) {
    for (const l of LOCALES) if (!byLocale[l]) errors.push(`fragment "${name}" is missing its ${l} file (${name}.${l}.json)`);
  }

  /** @type {Record<string, Map<string,string>>} */
  const flat = {};
  /** @type {Record<string, Map<string,string>>} owner of each key */
  const owner = {};
  for (const l of LOCALES) {
    flat[l] = new Map();
    owner[l] = new Map();
  }
  for (const byLocale of fragments.values()) {
    for (const l of LOCALES) {
      const f = byLocale[l];
      if (!f) continue;
      let json;
      try {
        json = JSON.parse(readFileSync(join(SRC, f), "utf8"));
      } catch (e) {
        errors.push(`messages/_src/${f}: invalid JSON (${e.message})`);
        continue;
      }
      if (!isPlainObject(json)) {
        errors.push(`messages/_src/${f}: root must be an object`);
        continue;
      }
      try {
        for (const [k, v] of flatten(json, "", new Map(), f)) {
          if (flat[l].has(k)) errors.push(`duplicate key "${k}" in ${f} and ${owner[l].get(k)}`);
          else {
            flat[l].set(k, v);
            owner[l].set(k, f);
          }
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
  }

  // en <-> tr parity
  const [a, b] = LOCALES;
  for (const k of flat[a].keys()) if (!flat[b].has(k)) errors.push(`key "${k}" exists in ${a} (${owner[a].get(k)}) but not in ${b}`);
  for (const k of flat[b].keys()) if (!flat[a].has(k)) errors.push(`key "${k}" exists in ${b} (${owner[b].get(k)}) but not in ${a}`);
  for (const [k, v] of flat[a]) {
    const w = flat[b].get(k);
    if (w === undefined) continue;
    if (icuArgs(v) !== icuArgs(w)) errors.push(`key "${k}": ICU arguments differ between ${a} {${icuArgs(v)}} and ${b} {${icuArgs(w)}}`);
    if (v.trim() === "" || w.trim() === "") errors.push(`key "${k}": empty translation`);
  }

  if (errors.length) {
    console.error(`\nmessages: ${errors.length} problem(s)\n` + errors.map((e) => "  - " + e).join("\n") + "\n");
    return false;
  }

  if (!args.has("--check")) {
    mkdirSync(OUT, { recursive: true });
    for (const l of LOCALES) {
      const tree = {};
      for (const [k, v] of flat[l]) setDeep(tree, k, v);
      const text = JSON.stringify(sortDeep(tree), null, 2) + "\n";
      const target = join(OUT, `${l}.json`);
      const prev = existsSync(target) ? readFileSync(target, "utf8") : null;
      if (prev !== text) writeFileSync(target, text);
    }
  }
  console.log(`messages: ok (${flat.en.size} keys x ${LOCALES.length} locales, ${fragments.size} fragments)`);
  return true;
}

const ok = run();
if (args.has("--watch")) {
  let t;
  watch(SRC, () => {
    clearTimeout(t);
    t = setTimeout(run, 150);
  });
  console.log("messages: watching messages/_src ...");
} else if (!ok) {
  process.exit(1);
}
