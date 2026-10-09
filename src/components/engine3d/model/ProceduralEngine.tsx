"use client";

import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import { PART_IDS } from "../parts";
import type { MergedMesh } from "./batch";
import { buildEngine } from "./build";
import { createMaterial } from "./materials";

function PartMesh({ mesh }: { mesh: MergedMesh }) {
  const material = useMemo<MeshStandardMaterial>(() => createMaterial(mesh.mat), [mesh.mat]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={mesh.geometry} material={material} />;
}

/**
 * The procedural engine as a scene graph: one `<group name={partId}>` per part (ids from ../parts.ts), each holding a few
 * merged meshes. The explode rig only knows the group names, so a glTF with identically named nodes drops in here.
 */
export function ProceduralEngine() {
  const built = useMemo(() => buildEngine(), []);
  useEffect(
    () => () => {
      for (const id of PART_IDS) for (const m of built[id]) m.geometry.dispose();
    },
    [built],
  );
  return (
    <group name="engine">
      {PART_IDS.map((id) => (
        <group key={id} name={id}>
          {built[id].map((mesh) => (
            <PartMesh key={mesh.mat} mesh={mesh} />
          ))}
        </group>
      ))}
    </group>
  );
}
