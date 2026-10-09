import type { PartId } from "../parts";
import type { MergedMesh } from "./batch";
import { buildBlock, buildCylinderHead, buildHeadGasket, buildOilPan, buildValveCover } from "./parts-casting";
import { buildIntakeManifold, buildExhaustManifold } from "./parts-manifolds";
import { buildConrods, buildCrankshaft, buildPistons } from "./parts-rotating";
import { buildCamGears, buildCamshafts, buildRockerArms, buildTimingChain, buildValves } from "./parts-valvetrain";

/**
 * One builder per part id. Each returns the part's geometry already merged per material, in ASSEMBLED position.
 * This table is the only thing a glTF model replaces: see ProceduralEngine.tsx and ../README.md.
 */
export const PART_BUILDERS: Record<PartId, () => MergedMesh[]> = {
  valveCover: buildValveCover,
  camshafts: buildCamshafts,
  camGears: buildCamGears,
  rockerArms: buildRockerArms,
  cylinderHead: buildCylinderHead,
  valves: buildValves,
  headGasket: buildHeadGasket,
  block: buildBlock,
  pistons: buildPistons,
  conrods: buildConrods,
  crankshaft: buildCrankshaft,
  oilPan: buildOilPan,
  intakeManifold: buildIntakeManifold,
  exhaustManifold: buildExhaustManifold,
  timingChain: buildTimingChain,
};

export type BuiltEngine = Record<PartId, MergedMesh[]>;

export function buildEngine(): BuiltEngine {
  const out = {} as BuiltEngine;
  for (const id of Object.keys(PART_BUILDERS) as PartId[]) out[id] = PART_BUILDERS[id]();
  return out;
}
