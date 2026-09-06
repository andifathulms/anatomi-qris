# CLAUDE.md — Anatomi QRIS

Build instructions for Claude Code. PRD.md is what and why. DESIGN.md is how it looks.
This is how it is built.

## Non-negotiables

1. **Write the QR engine from scratch.** No `qrcode`, no `qrcode-generator`, no `jsQR` in
   the shipped bundle. They are permitted as `devDependencies` for the oracle tests only.
   Importing one into `src/` defeats the entire point of the app.
2. **The provenance map is built first and is never optional.** See §3. Every view reads
   from it. No view recomputes geometry independently.
3. **Zero runtime network requests.** No fetch, no CDN fonts, no analytics, no Sentry. A
   user with devtools open must see an empty network tab after load.
4. **The engine is pure.** `src/engine/` imports nothing — no React, no DOM, no
   randomness, no `Date`. It must run unmodified under `node --test`.
5. **No payload editing features.** See PRD §9.2.

## Stack

- Vite + React 18 + TypeScript, strict.
- Plain CSS with custom properties. No Tailwind, no component library.
- No d3, no charting library. Every visual here is a grid, a ribbon, or a tree; d3 buys
  nothing and costs 40 KB.
- Vitest.
- devDependencies for oracle only: `qrcode`, `jsqr`.

## Layout

```
/
├─ src/
│  ├─ engine/
│  │  ├─ gf256.ts            # log/antilog tables, mul, div, poly ops
│  │  ├─ reed-solomon.ts     # encoder + decoder (syndromes, BM, Chien, Forney)
│  │  ├─ tables.ts           # capacity table (transcribed); BCH computed at init
│  │  ├─ segments.ts         # mode selection, bitstream assembly, padding
│  │  ├─ blocks.ts           # block splitting + interleaving
│  │  ├─ matrix.ts           # function patterns, zigzag placement
│  │  ├─ mask.ts             # 8 patterns, 4 penalty rules, selection
│  │  ├─ provenance.ts       # the map — see §3
│  │  ├─ decode.ts           # read modules → correct → bytes
│  │  ├─ encode.ts           # the orchestrator, returns Build
│  │  └─ index.ts
│  ├─ qris/
│  │  ├─ tlv.ts              # EMVCo TLV parse/serialise
│  │  ├─ crc16.ts
│  │  ├─ dictionary.ts       # tag meanings, QRIS sub-tags, MCC lookup
│  │  └─ detect.ts           # is this a QRIS payload?
│  ├─ stages/                # one component per pipeline stage
│  ├─ views/
│  │  ├─ Matrix/
│  │  ├─ Bitstream/
│  │  ├─ Division/
│  │  ├─ Interleave/
│  │  ├─ MaskGallery/
│  │  ├─ PayloadTree/
│  │  └─ DamageLab/
│  ├─ state/
│  ├─ ui/
│  └─ styles/
├─ tests/
│  ├─ oracle.test.ts
│  ├─ roundtrip.test.ts
│  ├─ recovery.test.ts
│  └─ provenance.test.ts
└─ samples/                  # bundled example payloads, committed
```

## The engine contract

```ts
type ModuleRole =
  | { kind: 'finder'; corner: 'tl' | 'tr' | 'bl' }
  | { kind: 'separator' }
  | { kind: 'timing'; axis: 'row' | 'col' }
  | { kind: 'alignment'; index: number }
  | { kind: 'darkModule' }
  | { kind: 'format'; bit: number }
  | { kind: 'version'; bit: number }
  | { kind: 'data'; codeword: number; bit: number }
  | { kind: 'ecc'; codeword: number; bit: number }
  | { kind: 'remainder'; index: number };

interface ModuleInfo {
  x: number;
  y: number;
  value: boolean;          // final, after mask
  preMask: boolean;        // before mask
  masked: boolean;         // did the mask flip it
  role: ModuleRole;
  placementOrder: number | null;  // null for function patterns
}

interface Build {
  version: number;
  ecLevel: 'L' | 'M' | 'Q' | 'H';
  mode: 'numeric' | 'alphanumeric' | 'byte';
  size: number;                       // 4*version + 17

  bitstream: Uint8Array;              // pre-codeword bits, packed
  dataCodewords: Uint8Array;
  eccCodewords: Uint8Array;
  interleaved: Uint8Array;

  blocks: Array<{ data: Uint8Array; ecc: Uint8Array }>;
  divisionTrace: DivisionStep[];      // §4
  maskScores: MaskScore[];            // all 8, always
  chosenMask: number;

  modules: ModuleInfo[];              // size × size, row-major
  byCodeword: Map<string, Array<[number, number]>>;  // "data:12" → coords
  byteToCodeword: (byteIndex: number) => number[];   // payload byte → codewords
}

function encode(input: string, opts?: {
  ecLevel?: 'L' | 'M' | 'Q' | 'H';
  minVersion?: number;
  forceMask?: number;
}): Build;

function decode(modules: boolean[][], version: number, ecLevel: EcLevel): {
  bytes: Uint8Array;
  corrected: number;            // codewords repaired
  capacity: number;             // codewords repairable
  failed: boolean;
  errorPositions: number[];
};
```

`encode` always computes all eight mask scores, even though only one wins. The gallery
needs them and recomputation would risk divergence.

## 3. The provenance map

Build this before any view exists, and test it before any view exists.

The forward direction (`modules[i].role`) falls out of construction naturally if you record
as you go rather than reconstructing afterwards. The zigzag placement loop knows exactly
which codeword bit it is writing; capture it there.

The reverse directions are derived once at the end:

- `byCodeword` — group modules by their `role.codeword`.
- `byteToCodeword` — a payload byte's position in the data stream depends on the mode
  header. For byte mode: 4 bits of mode indicator, then 8 or 16 bits of character count,
  then the payload bytes contiguously. Byte *n* therefore starts at bit
  `4 + countBits + 8n`, and spans codewords `floor(start/8)` through `floor((start+7)/8)`.
  Alphanumeric mode packs two characters into 11 bits and needs its own mapping. Numeric
  packs three into 10.

`provenance.test.ts` verifies the round trip: take a random byte range, resolve it to
codewords, resolve those to modules, read exactly those modules back out of the matrix,
undo the mask, deinterleave, and confirm the bytes come back. If that test passes, the
QRIS highlighting is correct by construction.

## 4. The division trace

Reed-Solomon encoding is polynomial long division. Record each step:

```ts
interface DivisionStep {
  iteration: number;
  leadTerm: number;             // GF(256) element being eliminated
  generatorMultiple: Uint8Array;  // generator × leadTerm
  remainderBefore: Uint8Array;
  remainderAfter: Uint8Array;
}
```

The Division view renders this array. It never recomputes. Same rule as the seat
allocation app's seat-award trace: the display and the computation are the same object, so
they cannot drift.

Memory is trivial here — at most a few hundred steps for version 15.

## 5. Performance

`encode()` for a version-15 code must complete in under 8 ms so typing recomputes on every
keystroke with no debounce.

Achieve it by: precomputing GF(256) log/antilog tables once at module init; working in
`Uint8Array` throughout the hot path; building `ModuleInfo[]` as a flat array with a
row-major index rather than a nested structure.

Do not debounce input. Do not use a web worker. If typing feels slow, the loop is wrong.

The damage lab recomputes decode on every brush movement. Decoding is more expensive than
encoding but still well under frame budget at these sizes.

## 6. Rendering

SVG, rendered by React. At version 15 the matrix is 77×77 = 5,929 modules, which is at the
upper end of comfortable for SVG but manageable if each module is a `<rect>` with no
per-element event handlers.

**Do not attach listeners to individual modules.** One listener on the matrix group,
hit-tested by dividing pointer coordinates by module size. This matters — 5,929 listeners
will stall on a phone.

**Do not remount modules between stages.** The matrix is one persistent set of rects whose
fill and opacity change as the stage advances. Remounting kills the animation and the
sense that it is one object being transformed.

If profiling shows SVG dropping frames during the zigzag at version 15, that one animation
may move to canvas. Measure first; the rest of the app stays SVG for accessibility.

## 7. Animation

Hand-rolled, one rAF loop, same approach as the seat allocation app. The house rule
carries over and is worth restating because it governs this app's feel:

**Continuous control → direct mapping.** The stage scrubber and the damage slider follow
the pointer with zero easing. The performance budgets above exist so this is possible.

**Discrete control → timed transition.** Switching EC level, forcing a mask, toggling
anatomy view — these animate over a duration because the user needs to see what changed.

Framer Motion permitted for popovers and small affordances. Never for the matrix.

`prefers-reduced-motion: reduce` converts every transition to an immediate write and turns
the zigzag into a step-through.

## 8. QRIS parsing

```ts
interface TlvNode {
  tag: string;
  length: number;
  value: string;
  start: number;              // index in raw string
  end: number;
  children: TlvNode[] | null; // templates 26–51, 62, 64 nest
  meaning: string | null;     // from dictionary
}

function parseTlv(payload: string): TlvNode[];
function detectQris(payload: string): boolean;
function validateCrc(payload: string): { ok: boolean; expected: string; found: string };
```

Templates that nest: merchant account information (26–51), additional data field (62),
merchant information language (64). Everything else is a leaf.

The dictionary carries the EMVCo tag names and, for QRIS specifically, the sub-tag
structure under the QRIS globally unique identifier — acquirer identifier, merchant
identifier, and merchant criteria. Include an MCC lookup so tag 52 renders as a business
category rather than four digits.

Parsing is forgiving. A malformed payload still renders as far as it parsed, with the
failure point marked. Users learn more from a broken payload that explains itself than
from an error message.

## 9. State

One `Build` derived from one input string plus options. Everything else — selected stage,
selected TLV node, damage mask, hovered module — is view state layered on top.

The input string and EC level serialise to the URL so a specific payload is linkable.
**Do not serialise pasted QRIS payloads by default** — that would put a merchant's
identifier in a URL a user might share without thinking. Add an explicit "copy link"
action for the samples and typed text; suppress it when the QRIS lens is active.

## 10. Copy

Indonesian first, English second locale via flat string files. No i18n framework.

Register: precise and plain. "Kata sandi kode" is wrong; "codeword" is a term of art and
stays in English where no settled Indonesian equivalent exists — but every such term gets
a one-sentence gloss the first time it appears.

Spec citations appear the way pasal citations do in Suara ke Kursi: an inline marker
opening a dismissible popover with the relevant text and its source. Cite ISO/IEC 18004
for QR structure and the EMVCo Merchant-Presented Mode specification for payload
structure.

## 11. Build order

Do not start the UI before step 4 passes.

1. GF(256) arithmetic + Reed-Solomon encoder. Tests against known vectors.
2. Segments, blocks, interleaving, matrix construction, masking.
3. Provenance map, with `provenance.test.ts` passing.
4. Oracle agreement against `qrcode` across the full supported matrix. **Gate.**
5. Decoder + recovery tests.
6. Design tokens and the shell: matrix centred, stage scrubber below.
7. Stages 1–6 with the zigzag animation. This is the hero; get it right before anything
   else.
8. Mask gallery.
9. TLV parser + payload tree + byte-to-module highlighting.
10. Damage lab.
11. Division and interleave views.
12. Reduced motion, keyboard, mobile, copy pass, Lighthouse.

## 12. Deployment

GitHub Pages via Actions. `base` set to the repo path. CI: typecheck → test (the oracle
runs here) → build → bundle budget. Deploy only on green. There is no lint step and no
ESLint config in the repo; the pipeline above is what the workflows actually run.
