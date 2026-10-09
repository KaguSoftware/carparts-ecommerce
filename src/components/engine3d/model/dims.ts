/**
 * Shared dimensions for the procedural K24-style inline-four. 1 unit = 100 mm.
 * Coordinates: X runs along the crankshaft (timing end at -X), Y is up, Z is across the engine
 * (intake side +Z, exhaust side -Z). The crank centreline is the X axis.
 * Proportions follow a 2.4 L DOHC four (87 mm bore, 99 mm stroke) but are stylised, not CAD.
 */

export const CYL_X = [-1.5, -0.5, 0.5, 1.5] as const;
export const BORE_R = 0.45;

export const BLOCK = {
  halfLen: 2.1,
  halfW: 1.0,
  deckY: 2.3,
  skirtY: -0.45,
  upperY: 0.5,
} as const;

export const HEAD = { bottom: 2.35, top: 3.45 } as const;

/** Camshaft axes: intake over +Z, exhaust over -Z. */
export const CAM = { y: 3.85, zIntake: 0.42, zExhaust: -0.42, frontX: -2.45 } as const;

export const CRANK = {
  throwR: 0.495,
  mainR: 0.22,
  pinR: 0.19,
  rodLen: 1.52,
  /** Crank angle of the pose, measured from +Y toward +Z. Cylinders 1 and 4 share it, 2 and 3 sit 180 degrees away. */
  angle: (40 * Math.PI) / 180,
  journalX: [-2, -1, 0, 1, 2] as const,
} as const;

export function throwAngle(cyl: number): number {
  return cyl === 0 || cyl === 3 ? CRANK.angle : CRANK.angle + Math.PI;
}

/** Crank pin centre of a cylinder in the (y, z) plane. */
export function pinPosition(cyl: number): { y: number; z: number } {
  const a = throwAngle(cyl);
  return { y: CRANK.throwR * Math.cos(a), z: CRANK.throwR * Math.sin(a) };
}

/** Piston pin height, from the rod geometry. */
export function pistonPinY(cyl: number): number {
  const p = pinPosition(cyl);
  return p.y + Math.sqrt(CRANK.rodLen ** 2 - p.z ** 2);
}

/** Rotation about X that lays a rod (drawn along +Y from the crank pin) onto the piston pin. */
export function rodTilt(cyl: number): number {
  return Math.asin(-pinPosition(cyl).z / CRANK.rodLen);
}

/** Valve geometry: tilt of the stems, tip height, length. */
export const VALVE = { tipY: 3.5, length: 1.1, tiltDeg: 10, tipZ: 0.5, dx: 0.26 } as const;
