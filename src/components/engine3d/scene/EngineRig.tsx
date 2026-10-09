"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useFrame, useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { Box3, CanvasTexture, Color, DoubleSide, MathUtils, SRGBColorSpace, Vector3, type Group, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from "three";
import { isPartId, PARTS, type PartDef, type PartId, type StageBridge } from "../parts";

/**
 * The only code that knows how the model moves. It looks parts up BY NAME (the ids in ../parts.ts), so it works the same
 * for the procedural model and for a glTF whose nodes carry those names.
 *
 * - explode: each part slides to base + offset * ease(window(progress))
 * - fit: scales and re-centres the whole engine so the stack fits the `[data-fit-bounds]` rectangle of the stage (which keeps
 *   clear of the headline, the legend and the bottom bar), by shifting the camera's view offset rather than the model
 * - ground: a faint pool of light and a drafting ring under the stack, so the dark parts have a floor to stand on
 * - highlight: emissive glow on the active part, the rest dim slightly
 * - label: projects the active part to screen space and moves the DOM tag (no React state in the frame loop)
 *
 * The per-frame work lives in plain functions (stepRig, collectParts) that mutate a context object, which keeps the
 * hot path out of React's render model and is the idiomatic shape for three.js animation code.
 */

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Amber hover tint. Kept low so pale parts (pistons, gasket, oil pan) keep their shading instead of washing to flat colour. */
const GLOW = new Color("#ffa24a");
const GLOW_INTENSITY = 0.22;
/** How far the other parts dim while one is highlighted (0.3 means they keep 70 percent of their colour). */
const DIM_AMOUNT = 0.42;
/** World gap between the lowest part and the ground pool. It counts towards the fit so the pool never leaves the frame. */
const GROUND_GAP = 0.5;
/** The assembled engine may not be drawn larger than this multiple of the fully exploded scale. */
const MAX_ASSEMBLED_BOOST = 1.7;

interface Tracked {
  def: PartDef;
  obj: Object3D;
  base: Vector3;
  mats: Array<{ m: MeshStandardMaterial; color: Color }>;
  /** Corners of the part's assembled bounding box, used to fit the live (partly exploded) stack to the view. */
  corners: Vector3[];
  glow: number;
}

/** Free area of the stage (stage pixels) the label card may sit in. Measured from the `[data-tag-bounds]` element. */
interface TagBounds {
  key: string;
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Free area of the stage the model is fitted into. Same measurement as TagBounds, from `[data-fit-bounds]`. */
type FitBounds = TagBounds;

/** Extents of the stack as seen from the current yaw. */
interface Extents {
  yMin: number;
  yMax: number;
  reach: number;
  near: number;
  radius: number;
}

interface RigContext {
  tracked: Tracked[];
  ground: Mesh | null;
  fit: FitBounds | null;
  fullExtents: Extents | null;
  active: PartId | null;
  smooth: number;
  dim: number;
  bounds: TagBounds | null;
  frames: number;
  readyFired: boolean;
  box: Box3;
  v: Vector3;
}

function createContext(): RigContext {
  return { tracked: [], ground: null, fit: null, fullExtents: null, active: null, smooth: 0, dim: 0, bounds: null, frames: 0, readyFired: false, box: new Box3(), v: new Vector3() };
}

function getContext(ref: RefObject<RigContext | null>): RigContext {
  ref.current ??= createContext();
  return ref.current;
}

function isStandard(m: Material): m is MeshStandardMaterial {
  return (m as MeshStandardMaterial).isMeshStandardMaterial === true;
}

function partIdOf(object: Object3D | null): PartId | null {
  for (let o: Object3D | null = object; o; o = o.parent) if (isPartId(o.name)) return o.name;
  return null;
}

/** Index parts by name and give each mesh a private material so highlighting one part never bleeds into another. */
function collectParts(group: Group): Tracked[] {
  const seen = new Set<Material>();
  const list: Tracked[] = [];
  for (const def of PARTS) {
    const obj = group.getObjectByName(def.id);
    if (!obj) continue;
    const mats: Tracked["mats"] = [];
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        if (seen.has(m)) {
          const copy = m.clone();
          seen.add(copy);
          return copy;
        }
        seen.add(m);
        return m;
      });
      mesh.material = Array.isArray(mesh.material) ? own : own[0];
      for (const m of own) {
        if (!isStandard(m)) continue;
        m.emissive.copy(GLOW);
        m.emissiveIntensity = 0;
        mats.push({ m, color: m.color.clone() });
      }
    });
    const box = new Box3().setFromObject(obj);
    const corners: Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
    list.push({ def, obj, base: obj.position.clone(), mats, corners, glow: 0 });
  }
  return list;
}

function attachInvalidate(bridge: StageBridge, invalidate: (() => void) | null) {
  bridge.invalidate = invalidate;
}

function readBounds(ctx: RigContext, tag: HTMLDivElement, w: number, h: number): TagBounds {
  const key = `${w}x${h}`;
  if (ctx.bounds?.key === key) return ctx.bounds;
  const el = tag.parentElement?.querySelector<HTMLElement>("[data-tag-bounds]");
  const bounds: TagBounds = el
    ? { key, l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight }
    : { key, l: 0, t: 0, r: w, b: h };
  ctx.bounds = bounds;
  return bounds;
}

function readFit(ctx: RigContext, tag: HTMLDivElement | null, w: number, h: number): FitBounds {
  const key = `${w}x${h}`;
  if (ctx.fit?.key === key) return ctx.fit;
  const el = tag?.parentElement?.querySelector<HTMLElement>("[data-fit-bounds]");
  const fit: FitBounds = el
    ? { key, l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight }
    : { key, l: 0, t: 0, r: w, b: h };
  // A rectangle that collapsed (hidden or not laid out yet) must not produce a zero scale.
  if (fit.r - fit.l < 40 || fit.b - fit.t < 40) {
    fit.l = 0;
    fit.t = 0;
    fit.r = w;
    fit.b = h;
  }
  ctx.fit = fit;
  return fit;
}

/** Extents of the stack with every part at its offset for explode progress p. */
function measure(tracked: Tracked[], p: number, cosY: number, sinY: number): Extents {
  const out: Extents = { yMin: Infinity, yMax: -Infinity, reach: 0, near: 0, radius: 0 };
  for (const t of tracked) {
    const [w0, w1] = t.def.window;
    const e = easeInOutCubic(clamp01((p - w0) / (w1 - w0)));
    for (const c of t.corners) {
      const x = c.x + t.def.explode[0] * e;
      const y = c.y + t.def.explode[1] * e;
      const z = c.z + t.def.explode[2] * e;
      if (y < out.yMin) out.yMin = y;
      if (y > out.yMax) out.yMax = y;
      const r = x * cosY + z * sinY;
      if (Math.abs(r) > out.reach) out.reach = Math.abs(r);
      const depth = z * cosY - x * sinY;
      if (depth > out.near) out.near = depth;
      const rad = Math.hypot(x, z);
      if (rad > out.radius) out.radius = rad;
    }
  }
  return out;
}

/** Puts the card in the gutter on the side away from the part and draws the leader from the card edge to the part. */
function placeTag(ctx: RigContext, tag: HTMLDivElement, x: number, y: number, w: number, h: number) {
  const bounds = readBounds(ctx, tag, w, h);
  const tw = tag.offsetWidth;
  const th = tag.offsetHeight;
  const pad = 8;
  let left: number;
  let top: number;
  let ax: number;
  let ay: number;
  if (w < 640) {
    // Phone: the stack fills the width, so the card takes the free band above or below the part.
    const below = y < (bounds.t + bounds.b) / 2;
    left = MathUtils.clamp((w - tw) / 2, pad, Math.max(pad, w - tw - pad));
    top = below ? Math.max(bounds.t + pad, bounds.b - th - pad) : bounds.t + pad;
    ax = MathUtils.clamp(x, left + 12, left + tw - 12);
    ay = below ? top : top + th;
  } else {
    const toRight = x < (bounds.l + bounds.r) / 2;
    left = toRight ? Math.max(bounds.l + pad, bounds.r - tw - pad) : bounds.l + pad;
    top = MathUtils.clamp(y - th / 2, bounds.t + pad, Math.max(bounds.t + pad, bounds.b - th - pad));
    ax = toRight ? left : left + tw;
    ay = MathUtils.clamp(y, top + 14, top + th - 14);
  }
  tag.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
  const line = tag.querySelector("line");
  const dot = tag.querySelector("circle");
  if (line) {
    line.setAttribute("x1", (ax - left).toFixed(1));
    line.setAttribute("y1", (ay - top).toFixed(1));
    line.setAttribute("x2", (x - left).toFixed(1));
    line.setAttribute("y2", (y - top).toFixed(1));
  }
  if (dot) {
    dot.setAttribute("cx", (x - left).toFixed(1));
    dot.setAttribute("cy", (y - top).toFixed(1));
  }
}

/** One frame of the rig. Reports whether another frame is needed and whether the first frames have just been drawn. */
function stepRig(
  ctx: RigContext,
  state: RootState,
  delta: number,
  bridge: StageBridge | null,
  root: Group | null,
  tag: HTMLDivElement | null,
): { moving: boolean; justReady: boolean } {
  const dt = Math.min(delta, 0.1);
  const target = clamp01(bridge?.progress ?? 0);
  ctx.smooth = MathUtils.damp(ctx.smooth, target, 6, dt);
  if (Math.abs(ctx.smooth - target) < 0.0008) ctx.smooth = target;
  const p = ctx.smooth;
  let moving = p !== target;

  const active = ctx.active;
  const dimGoal = active ? 1 : 0;
  ctx.dim = MathUtils.damp(ctx.dim, dimGoal, 10, dt);
  if (Math.abs(ctx.dim - dimGoal) < 0.01) ctx.dim = dimGoal;
  else moving = true;

  const e0 = easeInOutCubic(p);
  // Seen from the exhaust side and the timing end (yaw near pi): both manifolds then show their runners, not their flange plates.
  const yaw = MathUtils.lerp(Math.PI - 0.75, Math.PI - 1.05, e0);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  let activeObj: Object3D | null = null;
  for (const t of ctx.tracked) {
    const [w0, w1] = t.def.window;
    const e = easeInOutCubic(clamp01((p - w0) / (w1 - w0)));
    t.obj.position.set(t.base.x + t.def.explode[0] * e, t.base.y + t.def.explode[1] * e, t.base.z + t.def.explode[2] * e);

    const goal = t.def.id === active ? 1 : 0;
    t.glow = MathUtils.damp(t.glow, goal, 14, dt);
    if (Math.abs(t.glow - goal) < 0.01) t.glow = goal;
    else moving = true;
    const shade = 1 - DIM_AMOUNT * ctx.dim * (1 - t.glow);
    for (const { m, color } of t.mats) {
      m.emissiveIntensity = t.glow * GLOW_INTENSITY;
      m.color.copy(color).multiplyScalar(shade);
    }
    if (goal === 1) activeObj = t.obj;
  }

  // Fit the engine into the fit rectangle: scale and centre follow the explode so the stack (and its ground pool) always fits.
  const live = measure(ctx.tracked, p, cosY, sinY);
  if (root && live.yMax > live.yMin) {
    const cam = state.camera as PerspectiveCamera;
    const w = state.size.width;
    const h = Math.max(1, state.size.height);
    const fit = readFit(ctx, tag, w, h);
    const fitW = fit.r - fit.l;
    const fitH = fit.b - fit.t;
    // Aim the camera's principal point at the middle of the fit rectangle, so the model sits there and nowhere else.
    const dx = (fit.l + fit.r) / 2 - w / 2;
    const dy = (fit.t + fit.b) / 2 - h / 2;
    const view = cam.view;
    if (!view?.enabled || view.fullWidth !== w || view.fullHeight !== h || view.offsetX !== -dx || view.offsetY !== -dy) {
      cam.setViewOffset(w, h, -dx, -dy, w, h);
    }

    const dist = cam.position.length();
    const visH = 2 * dist * Math.tan(MathUtils.degToRad(cam.fov) / 2);
    // World size of the fit rectangle at the focal plane (one pixel is visH / h world units both ways).
    const boxH = (visH * fitH) / h;
    const boxW = (visH * fitW) / h;
    // Narrow (portrait) rectangles get a looser margin so the stack fills them.
    const margin = fitW / fitH < 1 ? 0.94 : 0.9;
    const scaleFor = (e: Extents) => {
      const s = margin * Math.min(boxH / (e.yMax - e.yMin + GROUND_GAP), boxW / (2 * Math.max(e.reach, 0.001)));
      // Perspective: the near side of a big model is closer to the camera and draws larger, so pull the scale in.
      return s * Math.max(0.6, (dist - 0.5 * s * e.near) / dist);
    };
    ctx.fullExtents ??= measure(ctx.tracked, 1, Math.cos(Math.PI - 1.05), Math.sin(Math.PI - 1.05));
    // The assembled engine is short, so a pure fit would blow it up; it may not outgrow the exploded stack by more than a boost.
    const s = Math.min(scaleFor(live), scaleFor(ctx.fullExtents) * MAX_ASSEMBLED_BOOST);
    const yLow = live.yMin - GROUND_GAP;
    root.scale.setScalar(s);
    root.position.y = -((live.yMax + yLow) / 2) * s;
    root.rotation.y = yaw;

    if (ctx.ground) {
      const r = Math.max(live.radius, 2.5);
      ctx.ground.position.y = yLow + GROUND_GAP * 0.55;
      ctx.ground.scale.set(r, r, 1);
    }
  }

  // Label card: lives in the free gutter beside the stack (or above / below it on a phone), joined to the part by a leader line.
  if (tag) {
    if (activeObj) {
      ctx.box.setFromObject(activeObj).getCenter(ctx.v).project(state.camera);
      placeTag(ctx, tag, (ctx.v.x * 0.5 + 0.5) * state.size.width, (-ctx.v.y * 0.5 + 0.5) * state.size.height, state.size.width, state.size.height);
      if (tag.dataset.anchor !== "on") tag.dataset.anchor = "on";
    } else if (tag.dataset.anchor !== "off") {
      tag.dataset.anchor = "off";
    }
  }

  ctx.frames += 1;
  const justReady = !ctx.readyFired && ctx.frames >= 3;
  if (justReady) ctx.readyFired = true;
  return { moving: moving || ctx.frames < 4, justReady };
}

/** Radial pool of cool light with a drafting ring on its rim: lays the stack on a floor and lifts it off the dark section. */
function makeGroundTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, "rgba(168,196,235,0.30)");
    grad.addColorStop(0.55, "rgba(140,172,218,0.12)");
    grad.addColorStop(1, "rgba(120,150,200,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(190,212,245,0.34)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(c, c, c * 0.8, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([3, 6]);
    g.strokeStyle = "rgba(190,212,245,0.2)";
    g.beginPath();
    g.arc(c, c, c * 0.93, 0, Math.PI * 2);
    g.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function GroundPool({ meshRef }: { meshRef: RefObject<Mesh | null> }) {
  const texture = useMemo(() => makeGroundTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    // The pool is scenery: it never takes pointer events and never hides a part (no depth write, drawn first).
    <mesh ref={meshRef} rotation-x={-Math.PI / 2} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}

export interface EngineRigProps {
  bridge: RefObject<StageBridge>;
  activeId: PartId | null;
  labelRef: RefObject<HTMLDivElement | null>;
  onHover: (id: PartId | null) => void;
  onSelect: (id: PartId) => void;
  onReady: () => void;
  children: ReactNode;
}

export function EngineRig({ bridge, activeId, labelRef, onHover, onSelect, onReady, children }: EngineRigProps) {
  const invalidate = useThree((s) => s.invalidate);
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);
  const ground = useRef<Mesh>(null);
  const ctxRef = useRef<RigContext | null>(null);

  useLayoutEffect(() => {
    const ctx = getContext(ctxRef);
    if (model.current) ctx.tracked = collectParts(model.current);
    ctx.fullExtents = null;
    ctx.ground = ground.current;
    invalidate();
    return () => {
      ctx.tracked = [];
      ctx.ground = null;
    };
  }, [invalidate]);

  useEffect(() => {
    const shared = bridge.current;
    if (shared) attachInvalidate(shared, invalidate);
    return () => {
      if (shared) attachInvalidate(shared, null);
    };
  }, [bridge, invalidate]);

  useEffect(() => {
    getContext(ctxRef).active = activeId;
    invalidate();
  }, [activeId, invalidate]);

  useFrame((state, delta) => {
    const { moving, justReady } = stepRig(getContext(ctxRef), state, delta, bridge.current, root.current, labelRef.current);
    if (justReady) onReady();
    if (moving) invalidate();
  });

  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>) => partIdOf(e.object);

  return (
    <group ref={root}>
      <GroundPool meshRef={ground} />
      <group
        ref={model}
        onPointerOver={(e) => {
          const id = hit(e);
          if (!id) return;
          e.stopPropagation();
          onHover(id);
        }}
        onPointerMove={(e) => {
          const id = hit(e);
          if (!id) return;
          e.stopPropagation();
          if (id !== getContext(ctxRef).active) onHover(id);
        }}
        onPointerOut={(e) => {
          if (hit(e)) onHover(null);
        }}
        onClick={(e) => {
          const id = hit(e);
          if (!id) return;
          e.stopPropagation();
          onSelect(id);
        }}
      >
        {children}
      </group>
    </group>
  );
}
