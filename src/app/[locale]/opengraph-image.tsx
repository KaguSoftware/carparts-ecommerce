import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand } from "@/config/brand";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/routing";

export const alt = `${brand.fullName}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const svg = await readFile(join(process.cwd(), "public", "og-logo.svg"), "utf8");
  const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const { graphite, steel, orange, paper } = brand.colors;

  const ticks = Array.from({ length: 76 }, (_, i) => i);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: graphite,
          color: paper,
          padding: "64px 72px 0 72px",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={Math.round(120 * (180 / 48))} height={120} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", width: 120, height: 10, background: orange }} />
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1, maxWidth: 980 }}>{brand.tagline[locale]}</div>
          <div style={{ fontSize: 30, color: "#a3adbb", maxWidth: 900, lineHeight: 1.35 }}>{brand.description[locale]}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", height: 56, gap: 0, marginLeft: -72, marginRight: -72, paddingLeft: 72, borderTop: `1px solid ${steel}` }}>
          {ticks.map((i) => (
            <div key={i} style={{ display: "flex", width: 16, height: i % 5 === 0 ? 28 : 14, borderLeft: `2px solid ${i % 5 === 0 ? "#6b7482" : steel}` }} />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
