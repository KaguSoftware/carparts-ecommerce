/**
 * Regenerates static brand SVGs from the React logo components (single source of truth).
 *   npm run brand:assets
 * Outputs: public/logo.svg, public/og-logo.svg, public/logo-dark.svg, public/logo-mono.svg, public/logo-mark.svg,
 *          src/app/icon.svg (favicon).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logo, LogoMark, type LogoVariant } from "../src/components/brand/Logo";
import { BRAND_COLORS, MARK } from "../src/components/brand/logo-geometry";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function write(rel: string, svg: string) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg.endsWith("\n") ? svg : svg + "\n");
  console.log("wrote", rel);
}

const FONT_STACK = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";

/** Make the markup safe as a standalone file: xmlns, no CSS variables, explicit font stack. */
function standalone(markup: string): string {
  let out = markup;
  if (!out.includes("xmlns=")) out = out.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  out = out.replace(/var\(--ff-display\),\s*/g, "");
  out = out.replace(/font-family:[^;"]*/g, `font-family:${FONT_STACK}`);
  return out;
}

function lockup(variant: Exclude<LogoVariant, "auto">, height = 96) {
  return standalone(renderToStaticMarkup(createElement(Logo, { variant, height, standalone: true, title: "APEXLINE Auto Parts" })));
}

write("public/logo.svg", lockup("light"));
write("public/logo-dark.svg", lockup("dark"));
write("public/logo-mono.svg", lockup("mono"));
// Social card logo: dark variant, no descriptor line (OG renderer has no webfonts).
write(
  "public/og-logo.svg",
  standalone(renderToStaticMarkup(createElement(Logo, { variant: "dark", height: 120, descriptor: false, standalone: true, title: "APEXLINE Auto Parts" }))),
);
write("public/logo-mark.svg", standalone(renderToStaticMarkup(createElement(LogoMark, { variant: "light", height: 128, title: "APEXLINE" }))));

// Favicon: graphite tile with the drafted chevron mark.
const icon = renderToStaticMarkup(createElement(LogoMark, { variant: "dark", tile: true, teeth: 20, height: 64, title: "APEXLINE" }));
write("src/app/icon.svg", standalone(icon));

// Sanity: keep constants referenced so a geometry change that breaks them fails loudly here.
if (!BRAND_COLORS.orange || !MARK.size) throw new Error("brand geometry missing");
