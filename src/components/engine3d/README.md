# Engine teardown (3D exploded view)

Full-width "Engine Teardown" section on the storefront home page: a procedural Honda K24 style inline-four that pulls itself apart
as the visitor scrolls, with drag-to-orbit, a hover/tap highlight and a label per part that links to the matching shop page (a subcategory, or a search for the part).

No model files ship with the app. Every part is generated from three.js primitives, extrusions and lathe profiles, so there is no
manufacturer CAD in the repository. The model is proportioned like a 2.4 L DOHC four (87 mm bore, 99 mm stroke, four valves per
cylinder, i-VTEC rockers) but is stylised.

## Files

| Path | Role |
|---|---|
| `EngineTeardown.tsx` | The section (client). Loading policy, scroll progress, hover/pin state, legend, labels, fallbacks. Only file the page imports. |
| `EngineStage.tsx` | The `<Canvas>` (default export, loaded with `next/dynamic` + `ssr:false`). Lighting, model, rig, orbit controls. |
| `BlueprintFallback.tsx` | Static exploded SVG blueprint. Server-rendered, painted first, stays for reduced motion / data saver / no WebGL. |
| `parts.ts` | Part registry: ids, category slug, explode offset and window. No three.js import. |
| `use-engine-env.ts` | Reduced motion, data saver / weak device, WebGL probe, coarse pointer (`useSyncExternalStore`). |
| `scene/EngineRig.tsx` | Finds parts by name, drives explode, fit, highlight and the DOM label. Knows nothing about how the model was made. |
| `scene/Lighting.tsx` | Procedural studio environment (Lightformers, no HDR download) + key lights. |
| `model/` | The procedural model (`build.ts` table, `parts-*.ts` builders, `materials.ts`, `dims.ts`, `batch.ts`). |

Copy lives in `messages/_src/engine3d.{en,tr}.json` (namespace `engine3d`). Per part: `parts.<id>.name`, `.note`, `.shop`.

## How it loads (never blocks LCP)

1. The server renders the section shell and the SVG blueprint. No three.js in the initial bundle.
2. When the section comes within 600 px of the viewport an `IntersectionObserver` arms it, and only then is the 3D chunk requested
   (`dynamic(() => import("./EngineStage"), { ssr: false })`).
3. The canvas fades in over the blueprint after its first frames. The blueprint is `aria-hidden` once 3D is live.

Modes (`data-mode` on the `<section>`):

| Mode | When | Behaviour |
|---|---|---|
| `scroll` | WebGL available, no reduced motion, no data saver, not a weak device | Tall section (`300svh` / `340svh`), sticky stage, progress from scroll |
| `manual` | The visitor pressed "Explore in 3D" in a situation that would otherwise be `static` | Normal-height section, explode slider (`<input type="range">`) |
| `static` | Reduced motion, `saveData` / 2g, `deviceMemory <= 2`, `hardwareConcurrency <= 2`, no WebGL, or the stage failed / lost its context | Blueprint only; 3D offered on request when WebGL exists |

Performance: DPR capped at 1.75 (1.5 on touch devices), `frameloop="demand"` (frames only while something moves), `frameloop="never"`
when the section is offscreen or the tab is hidden, merged geometry (a part is a handful of draw calls), raycasting through
`<Bvh firstHitOnly>`, materials created once per part. Vertical swipes keep scrolling the page (`touch-action: pan-y pinch-zoom`
is re-applied after OrbitControls attaches); horizontal drags orbit. Wheel zoom and pan are off so the page scrolls normally.

## Parts and shop categories

| Part id (node name) | Links to |
|---|---|
| `valveCover`, `headGasket` | `gaskets-seals` |
| `camGears`, `timingChain` | `belts-timing` |
| `camshafts`, `rockerArms`, `cylinderHead`, `valves`, `block`, `pistons`, `conrods`, `crankshaft` | `/search?q=<part>` (`searchTerm` in `parts.ts`; the seed has no subcategory for them, and the broad `engine` category was no answer to "show me pistons") |
| `oilPan` | `engine-oil` |
| `intakeManifold` | `air-filters` |
| `exhaustManifold` | `exhaust` |

`partHref()` returns the search link when a part has a `searchTerm`, otherwise its category. `partNumber()` gives the `01`..`15` drawing number that
the blueprint balloons and the legend rows share. `tests/unit/engine3d-parts.test.ts` checks that every slug exists in the seed categories, every id has en and tr copy, and every part
builds non-empty geometry.

## Coordinates and explode

1 unit = 100 mm. X runs along the crankshaft (timing end at -X), Y is up, Z is across the engine (intake +Z, exhaust -Z). The model
is authored ASSEMBLED, each part in its true position. `PARTS[i].explode` is the offset added at progress 1, `window` is the slice of
the 0..1 progress in which that part moves (the outermost parts lead and the layers nearer the block follow, so nothing moves into the layer beyond it), eased with a cubic in-out. The rig also scales and
re-centres the whole engine so the stack fits the `[data-fit-bounds]` rectangle of the stage (clear of the headline, the legend and the bottom bar; set by
`FIT_REGION` in `EngineTeardown.tsx`) by shifting the camera's view offset, caps the assembled scale at 1.7x the exploded scale, and yaws it slightly with progress. A faint
ground pool under the stack (`GroundPool`) and two cool rim lights (`scene/Lighting.tsx`) lift the dark castings off the near-black section.

To retune the choreography change `parts.ts` only.

## Replacing the procedural model with a .glb

The rig and the legend only depend on node names, so a real model can drop in without touching them.

1. Model the engine assembled, 1 unit = 100 mm if you can (otherwise scale the root), Y up, crank along X.
2. Name one node (Empty, group or mesh) per part exactly like the ids in `parts.ts`: `valveCover`, `camshafts`, `camGears`,
   `rockerArms`, `cylinderHead`, `valves`, `headGasket`, `block`, `pistons`, `conrods`, `crankshaft`, `oilPan`, `intakeManifold`,
   `exhaustManifold`, `timingChain`. Children can be anything; each part's pivot should sit at the origin so the explode offsets
   (world axes) mean the same thing.
3. Export glTF binary with Draco or Meshopt compression, PBR materials, no baked lights. Keep it under about 1.5 MB. Do not ship
   manufacturer CAD you have no licence for; use your own or licensed models.
4. Put it in `public/models/engine.glb` and swap the child of `EngineRig` in `EngineStage.tsx`:

   ```tsx
   import { useGLTF } from "@react-three/drei";

   function GlbEngine() {
     const { scene } = useGLTF("/models/engine.glb");
     return <primitive object={scene} />;
   }
   // <EngineRig ...><GlbEngine /></EngineRig>   instead of   <ProceduralEngine />
   ```

   Wrap it in `<Suspense fallback={null}>`, and call `useGLTF.preload` only from the lazily loaded stage module. If the file uses
   Draco, host the decoder under `/draco/` and pass `useGLTF(url, "/draco/")` (the CSP allows only same-origin).
5. Nothing else changes: `EngineRig` finds the nodes with `getObjectByName`, clones materials that are shared between parts so
   highlighting stays per part, drives position, and `partIdOf` walks up from the raycast hit to the first node whose name is a part
   id. `model/` can then be deleted (keep `parts.ts`).
6. Optionally name a node `engine` for the root. The unit test `builds renderable geometry for every named part` documents the
   contract for the procedural builders; add an equivalent check for the .glb by loading it in a script and asserting each name.

## Accessibility

- The canvas is `aria-hidden` inside a `role="img"` wrapper with a description; the real controls are DOM: the parts legend (every
  part is a link to its category) and, in manual mode, the explode slider.
- Legend hover and focus highlight the 3D part; canvas hover or tap shows the label card with the category link. A click or tap pins
  the card (so touch users can reach the link); clicking empty space unpins it.
- The label card is `visibility: hidden` while not shown, so it never takes tab stops.
- Phones get a collapsible parts list instead of the side legend.

## Trademark note

The visible copy names the engine family (Honda K24, i-VTEC) descriptively and states the model is illustrative and unaffiliated. If
legal review prefers, change `engine3d.subtitle` and `engine3d.disclaimer` in the message fragments only.
