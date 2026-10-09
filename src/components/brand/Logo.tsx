import { useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import {
  BRAND_COLORS,
  MARK,
  WORDMARK_HEIGHT,
  WORDMARK_LETTERS,
  WORDMARK_STROKE,
  WORDMARK_WIDTH,
} from "./logo-geometry";

/**
 * - `auto`  : follows the theme (ink = var(--logo-ink)); the default for in-app use.
 * - `light` : for LIGHT backgrounds (graphite ink).
 * - `dark`  : for DARK backgrounds (paper ink).
 * - `mono`  : single colour = currentColor (stamps, print, emails).
 */
export type LogoVariant = "auto" | "light" | "dark" | "mono";
export type LogoLayout = "lockup" | "mark" | "wordmark";

interface Palette {
  ink: string;
  accent: string;
}

export function paletteFor(variant: LogoVariant): Palette {
  switch (variant) {
    case "light":
      return { ink: BRAND_COLORS.graphite, accent: BRAND_COLORS.orange };
    case "dark":
      return { ink: BRAND_COLORS.paper, accent: BRAND_COLORS.orange };
    case "mono":
      return { ink: "currentColor", accent: "currentColor" };
    default:
      return { ink: "var(--logo-ink, currentColor)", accent: "var(--brand-orange, #ff5a1f)" };
  }
}

/* ---------- parts ---------------------------------------------------------------------- */

/**
 * The mark is drafted, not illustrated: a monoline apex chevron standing on a dimension line (end ticks, orange
 * centre gap), the same stroke weight as the wordmark. `teeth` is accepted for API compatibility and ignored.
 */
function MarkShapes({ palette, bg }: { palette: Palette; teeth?: number; bg?: string }) {
  const c = MARK.center;
  return (
    <>
      {bg ? <rect width={MARK.size} height={MARK.size} rx="6" fill={bg} /> : null}
      <path d={`M ${c - 21} 44 L ${c} 11 L ${c + 21} 44`} fill="none" stroke={palette.accent} strokeWidth="5" strokeLinejoin="miter" strokeMiterlimit="10" />
      <path d={`M ${c - 9.5} 44 H ${c + 9.5}`} fill="none" stroke={palette.ink} strokeWidth="5" />
      <path d={`M 8 54 H 56 M 8 49 V 59 M 56 49 V 59`} fill="none" stroke={palette.ink} strokeWidth="2.2" />
    </>
  );
}

function WordmarkShapes({ palette, clipId }: { palette: Palette; clipId: string }) {
  return (
    <>
      <clipPath id={clipId}>
        <rect x="-1" y="0" width={WORDMARK_WIDTH + 2} height={WORDMARK_HEIGHT} />
      </clipPath>
      <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={WORDMARK_STROKE} strokeLinejoin="miter" strokeMiterlimit="10">
        {WORDMARK_LETTERS.map((l, i) => (
          <path key={`${l.char}${i}`} d={l.d} transform={`translate(${l.x} 0)`} stroke={l.accent ? palette.accent : palette.ink} />
        ))}
      </g>
    </>
  );
}

/* ---------- public components ------------------------------------------------------------- */

interface CommonProps extends Omit<SVGProps<SVGSVGElement>, "viewBox" | "children" | "height" | "width"> {
  variant?: LogoVariant;
  /** Rendered height in px (width follows the aspect ratio). Omit to size with CSS. */
  height?: number;
  /** Accessible name. Pass `""` for purely decorative use next to visible text. */
  title?: string;
}

export function LogoMark({
  variant = "auto",
  height,
  title = "APEXLINE",
  teeth,
  tile,
  className,
  ...rest
}: CommonProps & { teeth?: number; tile?: boolean }) {
  const palette = paletteFor(variant);
  return (
    <svg
      viewBox={`0 0 ${MARK.size} ${MARK.size}`}
      width={height}
      height={height}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...rest}
    >
      <MarkShapes palette={palette} teeth={teeth} bg={tile ? BRAND_COLORS.graphite : undefined} />
    </svg>
  );
}

export function Wordmark({ variant = "auto", height, title = "APEXLINE", className, ...rest }: CommonProps) {
  const palette = paletteFor(variant);
  const clipId = useId().replace(/:/g, "");
  const pad = 0.5;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${WORDMARK_WIDTH + pad * 2} ${WORDMARK_HEIGHT + pad * 2}`}
      width={height ? (height * (WORDMARK_WIDTH + pad * 2)) / (WORDMARK_HEIGHT + pad * 2) : undefined}
      height={height}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...rest}
    >
      <WordmarkShapes palette={palette} clipId={`wm-${clipId}`} />
    </svg>
  );
}

const LOCKUP = {
  height: 48,
  markScale: 0.75,
  gap: 10,
  wordScale: 1.1,
};
const LOCKUP_WORD_X = MARK.size * LOCKUP.markScale + LOCKUP.gap;
export const LOCKUP_WIDTH = Math.ceil(LOCKUP_WORD_X + WORDMARK_WIDTH * LOCKUP.wordScale + 1);
export const LOCKUP_HEIGHT = LOCKUP.height;

/**
 * Primary lockup: mark + wordmark (+ "AUTO PARTS" descriptor line). Use this in headers, footers,
 * auth screens. `layout="mark"` for avatars/favicons, `layout="wordmark"` where space is tight.
 */
export function Logo({
  variant = "auto",
  layout = "lockup",
  height = 40,
  descriptor = true,
  descriptorText = "AUTO PARTS",
  title = "APEXLINE Auto Parts",
  className,
  standalone = false,
  ...rest
}: CommonProps & { layout?: LogoLayout; descriptor?: boolean; descriptorText?: string; standalone?: boolean }) {
  const palette = paletteFor(variant);
  const clipId = `lk-${useId().replace(/:/g, "")}`;
  if (layout === "mark") return <LogoMark variant={variant} height={height} title={title} className={className} {...rest} />;
  if (layout === "wordmark") return <Wordmark variant={variant} height={height} title={title} className={className} {...rest} />;

  const wordY = descriptor ? 3 : (LOCKUP.height - WORDMARK_HEIGHT * LOCKUP.wordScale) / 2;
  const width = (height * LOCKUP_WIDTH) / LOCKUP_HEIGHT;
  return (
    <svg
      xmlns={standalone ? "http://www.w3.org/2000/svg" : undefined}
      viewBox={`0 0 ${LOCKUP_WIDTH} ${LOCKUP_HEIGHT}`}
      width={width}
      height={height}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...rest}
    >
      <g transform={`scale(${LOCKUP.markScale})`}>
        <MarkShapes palette={palette} />
      </g>
      <g transform={`translate(${LOCKUP_WORD_X} ${wordY}) scale(${LOCKUP.wordScale})`}>
        <WordmarkShapes palette={palette} clipId={clipId} />
      </g>
      {descriptor ? (
        <text
          x={LOCKUP_WORD_X + 0.5}
          y={LOCKUP.height - 3.5}
          fill={palette.ink}
          fillOpacity="0.72"
          fontSize="9.5"
          fontWeight="600"
          textLength={(WORDMARK_WIDTH * LOCKUP.wordScale * 0.8).toFixed(2)}
          lengthAdjust="spacing"
          style={{ fontFamily: "var(--ff-display), 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif", textTransform: "uppercase" }}
        >
          {descriptorText}
        </text>
      ) : null}
    </svg>
  );
}
