"use client";

import { Component, useEffect, type ErrorInfo, type ReactNode, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Bvh, OrbitControls } from "@react-three/drei";
import { ProceduralEngine } from "./model/ProceduralEngine";
import type { PartId, StageBridge } from "./parts";
import { EngineRig } from "./scene/EngineRig";
import { Lighting } from "./scene/Lighting";

export interface EngineStageProps {
  bridge: RefObject<StageBridge>;
  activeId: PartId | null;
  /** Offscreen: stop rendering entirely. */
  paused: boolean;
  /** Touch-first device: lower DPR cap, vertical swipes keep scrolling the page. */
  coarse: boolean;
  /** DOM tag the rig positions next to the active part. */
  labelRef: RefObject<HTMLDivElement | null>;
  onHover: (id: PartId | null) => void;
  onSelect: (id: PartId) => void;
  onMiss: () => void;
  onReady: () => void;
  onFail: () => void;
}

/**
 * @react-three/fiber 9.8 (the latest release) still creates a THREE.Clock, which three 0.186 flags as deprecated on every
 * Canvas mount. It is not first-party code and nothing here can fix it, so that one message is dropped; everything else
 * still reaches the console. Remove this when fiber moves to THREE.Timer.
 */
const CLOCK_NOTICE = "THREE.Clock: This module has been deprecated";
const muted = Symbol.for("apexline.engine3d.clockNoticeMuted");
function muteClockNotice() {
  const warn = console.warn as typeof console.warn & { [muted]?: true };
  if (warn[muted]) return;
  const filtered = ((...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes(CLOCK_NOTICE)) return;
    warn.apply(console, args);
  }) as typeof console.warn & { [muted]?: true };
  filtered[muted] = true;
  console.warn = filtered;
}
muteClockNotice();

class StageBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[engine3d] stage failed", error, info.componentStack);
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function allowPageScroll(el: HTMLElement) {
  el.style.touchAction = "pan-y pinch-zoom";
}

/** Keeps the demand-driven loop honest: resume with a frame, keep scroll gestures on touch, report context loss. */
function StageEffects({ paused, onFail }: { paused: boolean; onFail: () => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!paused) invalidate();
  }, [paused, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onFail();
    };
    el.addEventListener("webglcontextlost", lost);
    // OrbitControls sets touch-action: none when it attaches, which would trap page scrolling on the canvas.
    allowPageScroll(el);
    const timer = window.setTimeout(() => allowPageScroll(el), 0);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, onFail]);

  return null;
}

export default function EngineStage({ bridge, activeId, paused, coarse, labelRef, onHover, onSelect, onMiss, onReady, onFail }: EngineStageProps) {
  return (
    <StageBoundary onFail={onFail}>
      <Canvas
        frameloop={paused ? "never" : "demand"}
        dpr={[1, coarse ? 1.5 : 1.75]}
        camera={{ position: [0, 5.2, 19.4], fov: 28, near: 1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={onMiss}
        aria-hidden
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        <Lighting />
        <Bvh firstHitOnly>
          <EngineRig bridge={bridge} activeId={activeId} labelRef={labelRef} onHover={onHover} onSelect={onSelect} onReady={onReady}>
            <ProceduralEngine />
          </EngineRig>
        </Bvh>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.09}
          rotateSpeed={0.7}
          minPolarAngle={0.6}
          maxPolarAngle={1.7}
          target={[0, 0, 0]}
        />
        <StageEffects paused={paused} onFail={onFail} />
      </Canvas>
    </StageBoundary>
  );
}
