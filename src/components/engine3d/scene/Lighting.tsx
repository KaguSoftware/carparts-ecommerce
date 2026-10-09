"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Studio lighting without any network fetch: a procedural environment baked once from a few softboxes (so the metal has
 * something to reflect), plus one key light. The orange strip behind the engine is the brand rim light. The ground colour
 * of the hemisphere light, a low warm fill and a strong strip under the engine keep the underside readable when the
 * visitor orbits below it. Two cool rim lights from behind trace the silhouette of the dark castings against the near-black
 * section (the block, pan and crank otherwise read as muddy shapes), and a cool back softbox adds the same edge to the metal.
 */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={["#c3cddd", "#5a6678", 1.15]} />
      <directionalLight position={[6, 10, 8]} intensity={2.4} />
      <directionalLight position={[-8, 4, 6]} intensity={1.1} color="#cfe0ff" />
      <directionalLight position={[2, -7, 9]} intensity={1.3} color="#ffd9b0" />
      <directionalLight position={[-6, 6, -10]} intensity={2.6} color="#9ec4ff" />
      <directionalLight position={[7, 2, -9]} intensity={1.8} color="#b4d2ff" />
      <Environment resolution={256} frames={1} environmentIntensity={1.5}>
        <Lightformer form="rect" intensity={5} position={[4, 8, 8]} scale={[12, 7, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#cfe0ff" position={[-9, 3, 4]} scale={[7, 10, 1]} />
        <Lightformer form="rect" intensity={4} color="#ff6a2e" position={[8, 2, -8]} scale={[11, 3, 1]} />
        <Lightformer form="rect" intensity={2.6} position={[0, 10, -2]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={4.5} color="#ffb020" position={[0, -8, 3]} scale={[18, 8, 1]} />
        <Lightformer form="rect" intensity={2.2} position={[0, 2, 10]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={3.2} color="#9ec4ff" position={[-3, 4, -11]} scale={[16, 4, 1]} />
      </Environment>
    </>
  );
}
