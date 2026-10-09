import { Color, MeshStandardMaterial } from "three";

/**
 * Brand palette as PBR materials: graphite and steel bodies, signal orange and amber accents.
 * Block and pan sit about 15 percent lighter than a plain graphite so they separate from the near-black section; orange is
 * reserved for the valve cover and the cam gears. Everything is metallic so the procedural studio environment (see scene/Lighting) does the work.
 */
export const MATERIAL_KEYS = [
  "block",
  "head",
  "cover",
  "pan",
  "steel",
  "darkSteel",
  "alu",
  "orange",
  "amber",
  "gasket",
  "manifold",
  "exhaust",
  "chain",
] as const;

export type MatKey = (typeof MATERIAL_KEYS)[number];

interface MatSpec {
  color: string;
  metalness: number;
  roughness: number;
}

const SPECS: Record<MatKey, MatSpec> = {
  block: { color: "#5f6b7c", metalness: 0.7, roughness: 0.5 },
  head: { color: "#7b8594", metalness: 0.85, roughness: 0.4 },
  cover: { color: "#ff5a1f", metalness: 0.55, roughness: 0.42 },
  pan: { color: "#47525f", metalness: 0.7, roughness: 0.5 },
  steel: { color: "#c5cbd4", metalness: 1, roughness: 0.22 },
  darkSteel: { color: "#747f8f", metalness: 0.85, roughness: 0.36 },
  alu: { color: "#99a2af", metalness: 0.92, roughness: 0.3 },
  orange: { color: "#ff6a2e", metalness: 0.6, roughness: 0.36 },
  amber: { color: "#ffb020", metalness: 0.75, roughness: 0.32 },
  gasket: { color: "#aab1bb", metalness: 0.9, roughness: 0.5 },
  manifold: { color: "#6b7687", metalness: 0.75, roughness: 0.46 },
  exhaust: { color: "#7d7e83", metalness: 0.92, roughness: 0.48 },
  chain: { color: "#8b93a0", metalness: 1, roughness: 0.3 },
};

export function createMaterial(key: MatKey): MeshStandardMaterial {
  const spec = SPECS[key];
  const material = new MeshStandardMaterial({ color: new Color(spec.color), metalness: spec.metalness, roughness: spec.roughness });
  material.name = key;
  return material;
}
