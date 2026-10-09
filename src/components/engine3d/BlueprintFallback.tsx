import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { partHref, partNumber, PART_BY_ID, type PartId } from "./parts";

/**
 * Static exploded blueprint of the engine, drawn as inline SVG. It is the first thing painted, the fallback while the
 * 3D chunk loads, and the whole experience under prefers-reduced-motion, data saver or without WebGL.
 *
 * Side elevation in the middle, the timing set (face-on) on the left, the manifolds (end-on) at the sides. Every part is
 * a link to its shop page and highlights with the legend. Strokes use currentColor so a part recolours as one unit.
 * Every part also carries a numbered balloon on a leader (the drafting vocabulary of the product art); the number matches
 * the row in the legend, so a part can be identified without hovering it.
 */

export interface BlueprintLabels {
  names: Record<PartId, string>;
  ariaLabel: string;
}

interface Props {
  labels: BlueprintLabels;
  activeId: PartId | null;
  onActive: (id: PartId | null) => void;
  className?: string;
}

const CX = [252.5, 337.5, 422.5, 507.5] as const;
const LEFT = 205;
const RIGHT = 555;
const CRANK_X = [CX[0] - 42.5, CX[1] - 42.5, CX[2] - 42.5, CX[3] - 42.5, CX[3] + 42.5];
const STAGGER = 16; // cylinders 2 and 3 sit lower on the flat-plane crank

const line = {
  fill: "currentColor",
  fillOpacity: 0.07,
  stroke: "currentColor",
  strokeWidth: 1.25,
  vectorEffect: "non-scaling-stroke",
  strokeLinejoin: "round",
} as const;
const thin = { ...line, fill: "none", strokeWidth: 1 } as const;
const dashed = { ...thin, strokeDasharray: "3 3" } as const;

/** Where each balloon sits: [point on the part, balloon centre], in viewBox units. */
const BALLOON_R = 19;
const BALLOONS: Record<PartId, readonly [px: number, py: number, bx: number, by: number]> = {
  valveCover: [555, 67, 610, 67],
  camshafts: [576, 131, 610, 131],
  camGears: [48, 108, 34, 62],
  rockerArms: [545, 174, 610, 174],
  cylinderHead: [545, 281, 610, 292],
  valves: [546, 328, 610, 338],
  headGasket: [555, 369, 610, 382],
  block: [555, 655, 610, 622],
  pistons: [543, 430, 610, 428],
  conrods: [523, 556, 610, 526],
  crankshaft: [613, 767, 662, 738],
  oilPan: [536, 836, 586, 812],
  intakeManifold: [701, 197, 724, 240],
  exhaustManifold: [96, 340, 44, 344],
  timingChain: [74, 200, 32, 200],
};

/** Numbered balloon and leader: same construction as the bubbles on the product drawings. */
function Balloon({ id, active }: { id: PartId; active: boolean }) {
  const [px, py, bx, by] = BALLOONS[id];
  const dx = px - bx;
  const dy = py - by;
  const len = Math.hypot(dx, dy) || 1;
  // The leader starts on the balloon's rim, not at its centre.
  const sx = bx + (dx / len) * BALLOON_R;
  const sy = by + (dy / len) * BALLOON_R;
  return (
    <g aria-hidden>
      <line x1={sx} y1={sy} x2={px} y2={py} stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" strokeOpacity={active ? 1 : 0.75} />
      <circle cx={px} cy={py} r={3.2} fill="currentColor" />
      <circle cx={bx} cy={by} r={BALLOON_R} strokeWidth={active ? 2.4 : 1.8} vectorEffect="non-scaling-stroke" className={cn("stroke-primary transition-colors duration-200", active ? "fill-primary" : "fill-inverse")} />
      <text
        x={bx}
        y={by + 5.5}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={16}
        fontWeight={700}
        className={cn("transition-colors duration-200", active ? "fill-primary-foreground" : "fill-inverse-foreground")}
      >
        {partNumber(id)}
      </text>
    </g>
  );
}

function Part({ id, labels, activeId, onActive, children }: { id: PartId; labels: BlueprintLabels; activeId: PartId | null; onActive: (id: PartId | null) => void; children: ReactNode }) {
  const active = activeId === id;
  return (
    <Link
      href={partHref(PART_BY_ID[id])}
      aria-label={labels.names[id]}
      onPointerEnter={() => onActive(id)}
      onPointerLeave={() => onActive(null)}
      onFocus={() => onActive(id)}
      onBlur={() => onActive(null)}
      className={cn(
        "group/bp rounded-sm outline-none transition-colors duration-200 focus-visible:text-primary",
        active ? "text-primary" : "text-inverse-muted hover:text-primary",
      )}
    >
      <g className={cn("transition-opacity duration-200", active ? "opacity-100" : "opacity-90")}>{children}</g>
      <Balloon id={id} active={active} />
    </Link>
  );
}

export function BlueprintFallback({ labels, activeId, onActive, className }: Props) {
  const p = { labels, activeId, onActive };
  const segs: Array<[number, number]> = [];
  let from = LEFT;
  for (const x of CX) {
    segs.push([from, x - 38]);
    from = x + 38;
  }
  segs.push([from, RIGHT]);

  return (
    <svg viewBox="0 0 760 900" role="img" aria-label={labels.ariaLabel} className={cn("block h-full w-full", className)} preserveAspectRatio="xMidYMid meet">
      <title>{labels.ariaLabel}</title>

      {/* explode axes through every cylinder */}
      <g aria-hidden className="text-inverse-border">
        {CX.map((x) => (
          <line key={x} x1={x} x2={x} y1={14} y2={892} stroke="currentColor" strokeWidth={1} strokeDasharray="1 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      <Part id="valveCover" {...p}>
        <rect x={LEFT} y={44} width={RIGHT - LEFT} height={46} rx={8} {...line} />
        <path d="M225 44 Q380 20 535 44" {...thin} />
        {CX.map((x) => (
          <rect key={x} x={x - 12} y={32} width={24} height={13} rx={3} {...line} />
        ))}
        <rect x={214} y={37} width={24} height={8} rx={2} {...line} />
      </Part>

      <Part id="camshafts" {...p}>
        <rect x={170} y={126} width={420} height={10} rx={2} {...line} />
        {CRANK_X.map((x) => (
          <rect key={x} x={x - 8} y={122} width={16} height={18} rx={2} {...line} />
        ))}
        {CX.flatMap((x) => [-22, 0, 22].map((d) => <ellipse key={`${x}${d}`} cx={x + d} cy={131} rx={7} ry={d === 0 ? 20 : 15} {...line} />))}
      </Part>

      <Part id="rockerArms" {...p}>
        <line x1={LEFT} x2={RIGHT} y1={174} y2={174} {...dashed} />
        {CX.flatMap((x) => [-22, 22].map((d) => <rect key={`${x}${d}`} x={x + d - 15} y={166} width={30} height={15} rx={7.5} {...line} />))}
      </Part>

      <Part id="cylinderHead" {...p}>
        <rect x={LEFT} y={205} width={RIGHT - LEFT} height={76} rx={6} {...line} />
        {CRANK_X.map((x) => (
          <rect key={x} x={x - 7} y={196} width={14} height={10} rx={2} {...line} />
        ))}
        {CX.map((x) => (
          <rect key={x} x={x - 8} y={212} width={16} height={46} rx={3} {...dashed} />
        ))}
        <rect x={LEFT - 8} y={226} width={8} height={34} rx={2} {...line} />
        <rect x={RIGHT} y={226} width={8} height={34} rx={2} {...line} />
      </Part>

      <Part id="valves" {...p}>
        {CX.flatMap((x) =>
          [-24, 24].map((d) => (
            <g key={`${x}${d}`}>
              <path d={`M${x + d} 298 l${d > 0 ? 3 : -3} 42`} {...thin} />
              <path d={`M${x + d - 5} 303 l10 5 l-10 5 l10 5 l-10 5 l10 5`} {...thin} />
              <path d={`M${x + d + (d > 0 ? 3 : -3) - 10} 346 l20 0 l-5 -7 l-10 0 z`} {...line} />
            </g>
          )),
        )}
      </Part>

      <Part id="headGasket" {...p}>
        {segs.map(([a, b]) => (
          <rect key={a} x={a} y={366} width={Math.max(2, b - a)} height={6} {...line} />
        ))}
      </Part>

      <Part id="pistons" {...p}>
        {CX.map((x, i) => {
          const y = 392 + (i === 1 || i === 2 ? STAGGER : 0);
          return (
            <g key={x}>
              <rect x={x - 36} y={y} width={72} height={44} rx={4} {...line} />
              {[10, 16, 22].map((o) => (
                <line key={o} x1={x - 36} x2={x + 36} y1={y + o} y2={y + o} {...thin} />
              ))}
              <circle cx={x} cy={y + 31} r={6} {...thin} />
            </g>
          );
        })}
      </Part>

      <Part id="conrods" {...p}>
        {CX.map((x, i) => {
          const o = i === 1 || i === 2 ? STAGGER : 0;
          return (
            <g key={x}>
              <circle cx={x} cy={462 + o} r={9} {...line} />
              <rect x={x - 4} y={470 + o} width={8} height={72} {...line} />
              <circle cx={x} cy={556 + o} r={15} {...line} />
              <circle cx={x} cy={556 + o} r={8} {...thin} />
            </g>
          );
        })}
      </Part>

      <Part id="block" {...p}>
        <rect x={LEFT} y={598} width={RIGHT - LEFT} height={116} rx={6} {...line} />
        <rect x={LEFT} y={714} width={RIGHT - LEFT} height={18} rx={4} {...line} />
        {CX.map((x) => (
          <rect key={x} x={x - 38} y={598} width={76} height={70} {...dashed} />
        ))}
        {CRANK_X.map((x) => (
          <line key={x} x1={x} x2={x} y1={714} y2={732} {...thin} />
        ))}
      </Part>

      <Part id="crankshaft" {...p}>
        <rect x={150} y={762} width={460} height={10} rx={2} {...line} />
        {CRANK_X.map((x) => (
          <rect key={x} x={x - 9} y={758} width={18} height={18} rx={2} {...line} />
        ))}
        {CX.map((x, i) => (
          <rect key={x} x={x - 17} y={i === 0 || i === 3 ? 778 : 744} width={34} height={25} rx={10} {...line} />
        ))}
        <rect x={134} y={752} width={14} height={30} rx={2} {...line} />
        <rect x={604} y={746} width={9} height={42} rx={2} {...line} />
      </Part>

      <Part id="oilPan" {...p}>
        <rect x={LEFT} y={822} width={RIGHT - LEFT} height={9} rx={2} {...line} />
        <path d="M222 831 H538 L518 884 H242 Z" {...line} />
        <rect x={290} y={884} width={14} height={6} rx={1} {...line} />
      </Part>

      {/* timing set, face-on */}
      <Part id="camGears" {...p}>
        {[70, 134].map((x) => (
          <g key={x}>
            <circle cx={x} cy={128} r={28} {...line} />
            <circle cx={x} cy={128} r={32} {...thin} strokeDasharray="2 2.4" />
            <circle cx={x} cy={128} r={10} {...thin} />
          </g>
        ))}
      </Part>
      <Part id="timingChain" {...p}>
        <path d="M70 96 H134 A32 32 0 0 1 134 160 L128 282 A26 26 0 0 1 76 282 L70 160 A32 32 0 0 1 70 96 Z" {...thin} strokeWidth={5} strokeOpacity={0.35} strokeDasharray="3 2" />
        <circle cx={102} cy={282} r={20} {...line} />
        <circle cx={102} cy={282} r={7} {...thin} />
      </Part>

      {/* manifolds, end-on */}
      <Part id="exhaustManifold" {...p}>
        <rect x={166} y={226} width={8} height={36} rx={2} {...line} />
        <path d="M166 244 C 112 244 96 290 96 360 L 96 400" {...thin} strokeWidth={14} strokeOpacity={0.2} strokeLinecap="round" />
        <path d="M166 244 C 112 244 96 290 96 360 L 96 400" {...thin} strokeDasharray="3 3" />
        <rect x={80} y={398} width={32} height={8} rx={2} {...line} />
      </Part>
      <Part id="intakeManifold" {...p}>
        <rect x={586} y={226} width={8} height={36} rx={2} {...line} />
        <path d="M594 244 C 650 244 672 232 676 196" {...thin} strokeWidth={14} strokeOpacity={0.2} strokeLinecap="round" />
        <path d="M594 244 C 650 244 672 232 676 196" {...thin} strokeDasharray="3 3" />
        <circle cx={676} cy={172} r={36} {...line} />
        <circle cx={676} cy={172} r={13} {...thin} />
      </Part>

      {/* title block */}
      <g aria-hidden className="text-inverse-muted" fontFamily="var(--font-display)" fontSize={13} letterSpacing="0.08em">
        <path d="M624 824 H744 V884 H624 Z" fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={624} x2={744} y1={846} y2={846} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={634} y={840} fill="currentColor">
          K24 · DOHC
        </text>
        <text x={634} y={866} fill="currentColor">
          87 x 99 mm
        </text>
        <text x={634} y={880} fill="currentColor">
          NTS
        </text>
      </g>
    </svg>
  );
}
