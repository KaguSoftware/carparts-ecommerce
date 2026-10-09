"use client";

import { useMemo, useSyncExternalStore } from "react";

/** Why the 3D view should not start by itself, when it should not. */
export type LowPowerReason = "saver" | "weak" | null;

export interface EngineEnv {
  /** False during SSR and the first client render: nothing is decided yet. */
  known: boolean;
  reducedMotion: boolean;
  lowPower: LowPowerReason;
  webgl: boolean;
  /** Touch-first device (coarse primary pointer). */
  coarse: boolean;
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}
type NavigatorLike = Navigator & { connection?: NetworkInformationLike; deviceMemory?: number };

let webglMemo: boolean | null = null;
let lowPowerMemo: LowPowerReason | undefined;

function detectWebgl(): boolean {
  if (webglMemo !== null) return webglMemo;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglMemo = Boolean(gl);
    // Release the probe context immediately so it does not count against the browser's context limit.
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglMemo = false;
  }
  return webglMemo;
}

function detectLowPower(): LowPowerReason {
  if (lowPowerMemo !== undefined) return lowPowerMemo;
  const nav = navigator as NavigatorLike;
  const conn = nav.connection;
  if (conn?.saveData || conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") lowPowerMemo = "saver";
  else if ((nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)) lowPowerMemo = "weak";
  else lowPowerMemo = null;
  return lowPowerMemo;
}

const QUERIES = ["(prefers-reduced-motion: reduce)", "(pointer: coarse)"] as const;

function subscribe(onChange: () => void): () => void {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  for (const l of lists) l.addEventListener("change", onChange);
  return () => {
    for (const l of lists) l.removeEventListener("change", onChange);
  };
}

/** A string snapshot keeps useSyncExternalStore referentially stable. */
function getSnapshot(): string {
  const reduced = window.matchMedia(QUERIES[0]).matches ? "1" : "0";
  const coarse = window.matchMedia(QUERIES[1]).matches ? "1" : "0";
  return `${reduced}|${coarse}|${detectLowPower() ?? "-"}|${detectWebgl() ? "1" : "0"}`;
}

const getServerSnapshot = () => "pending";

export function useEngineEnv(): EngineEnv {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    if (snap === "pending") return { known: false, reducedMotion: false, lowPower: null, webgl: false, coarse: false };
    const [reduced, coarse, power, webgl] = snap.split("|");
    return {
      known: true,
      reducedMotion: reduced === "1",
      coarse: coarse === "1",
      lowPower: power === "-" ? null : (power as LowPowerReason),
      webgl: webgl === "1",
    };
  }, [snap]);
}
