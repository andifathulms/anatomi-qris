# Portfolio Context — Anatomi QRIS

Raw material for a client-facing case study. Everything below is drawn from the
repository itself: `PRD.md`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md`, `package.json`,
the git log, and the source tree. Where a claim could not be verified offline it is
marked as such.

---

## 1. One-line summary

An interactive explainer that takes any text — including the QRIS payment code stuck to
a warung counter — and shows you, step by step, exactly how it turns into a grid of
black and white squares, and what the squares mean.

---

## 2. The problem

Two gaps, joined by one object.

**The universal gap.** People scan tens of thousands of QR codes and have never seen one
built. Existing QR explainers on the web stop at "here is a bitstream, here is a matrix"
and never show the arithmetic — Reed-Solomon error correction, mask selection, and
interleaving are treated as black boxes even in tutorials aimed at developers.

**The local gap.** QRIS is Indonesia's national QR payment standard; the sticker is on
every counter. The payload behind it is not an opaque token — it is a plainly structured
EMVCo string naming the merchant, the acquirer, the business category, the currency and a
checksum. Every existing QRIS parser dumps that structure as a table and stops there.

The product is the join between them: **select "merchant name" in the payload tree and
the specific black squares carrying those bytes light up in the matrix.** Nobody had
connected the two layers, because doing it requires an encoder that remembers where every
bit went.

**Who it's for** (two readers, one interface, no beginner/expert fork):
- A curious Indonesian with no technical background, who should get value in ~10 seconds
  without reading anything.
- A developer who wants to understand Reed-Solomon and mask selection properly, and must
  be able to verify every number by hand.

---

## 3. My role

Sole author. `git shortlog` shows 44 commits, all by Andi Fathul Mukminin; all 44 carry a
`Co-Authored-By: Claude` trailer, so this was built with an AI pair, and the case study
should be honest about that if the client audience cares.

**Built from scratch:**
- The entire QR encoder and decoder (`src/engine/`, ~2,000 lines): GF(256) field
  arithmetic, Reed-Solomon encode/decode, capacity tables, segment/mode selection, block
  splitting and interleaving, matrix construction, all eight mask patterns and four
  penalty rules, and the provenance map.
- The EMVCo/QRIS parsing layer (`src/qris/`, ~470 lines): TLV parser, CRC16, tag
  dictionary with acquirer identifiers and an 85-entry merchant-category-code lookup,
  payload detection.
- All seven visualization views and the nine-stage pipeline UI (~2,400 lines of view
  code, ~800 lines of CSS across an 86-token design system).
- The test suite (84 tests across 13 files), CI, GitHub Pages deploy, and a custom
  build-time bundle/no-network guard (`scripts/check-bundle.mjs`).
- The brand mark and identity assets (`docs/brand/`, `public/brand/`).

**Used as-is:** React 18, Vite, TypeScript, Vitest, jsdom, and three self-hosted
`@fontsource` families. That is the complete runtime dependency list.

**Deliberately *not* used:** every QR library. `qrcode` and `jsqr` are present only as
devDependencies to check the from-scratch engine, and a test fails if either is imported
from `src/`.

---

## 4. Technical approach

**The provenance map is the architecture.** The encoder does not just return a matrix —
it returns a matrix plus a complete record of *why every single module is the colour it
is*: which codeword and which bit of that codeword, or which function pattern, plus
whether the mask flipped it. It also carries the inverse maps (codeword → module
coordinates, payload byte → codewords).

Why this matters: every feature in the app is a read of that one structure. Payload-field
highlighting, damage attribution, the zigzag animation order, and the mask comparison all
come free. Had the map been an afterthought, each view would have had to recompute the
geometry independently, and they would have silently drifted out of agreement. It was
built and tested *before any UI existed*.

**The display renders the computation's own record, not a re-enactment.** Reed-Solomon
encoding emits a `divisionTrace` — every long-division step, with the lead term, the
generator multiple, and the remainder before and after. The Division view just renders
that array. The encoder always scores all eight masks even though seven lose, so the mask
gallery cannot disagree with the winner. Display and computation are the same object, so
they cannot diverge.

**The engine is pure and the UI is a layer on top.** `src/engine/` imports nothing — no
React, no DOM, no randomness, no clock — and runs unmodified under `node --test`. One
`Build` is derived from one input string plus options; selected stage, damage mask and
hover are view state layered above it.

**Performance was a design constraint, not an optimisation pass.** `encode()` for a
version-15 symbol must complete in under 8 ms so typing recomputes on every keystroke with
no debounce, no worker. Achieved with precomputed GF(256) log/antilog tables, `Uint8Array`
throughout the hot path, and a flat row-major module array.

**Rendering discipline for a 5,929-module SVG.** One pointer listener on the matrix group,
hit-tested by dividing coordinates by module size — 5,929 individual listeners would stall
a phone. React mounts the rects once and never remounts them; a painter mutates fills and
caches each module's last fill, so a steady frame writes nothing and an animating frame
writes only what moved. That persistence is what makes nine stages read as *one object
being transformed* rather than nine illustrations in a row.

**Correctness is gated, not asserted.** The oracle test demands byte-identical matrices
against the independent `qrcode` library across versions 1–15, all four EC levels, all
three modes, both sides of every version boundary, and all eight mask patterns. It runs in
CI and blocks deploy. The house rule: if our engine and the reference disagree, ours is
wrong.

**Privacy is architectural.** People paste real payment payloads in. There are zero
runtime network requests — no analytics, no error reporting, fonts bundled from
`node_modules`, and even the favicon inlined as a data URI after a browser test caught a
404 on `/favicon.ico` (a 404 is still a request). `check-bundle.mjs` scans the built output
for network APIs and unexpected URLs, so a dependency cannot introduce a request nobody
wrote. Typed text serialises to the URL for linkability; a pasted QRIS payload never does,
and the copy-link action disappears while the QRIS lens is active, so a merchant
identifier cannot ride along in a shared link.

---

## 5. Actual tech stack

Verified against `package.json` and `vite.config.ts`.

**Runtime dependencies (all of them):**
- React 18.3 + React DOM
- `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@fontsource/martian-mono`
  (self-hosted, bundled)

**Build and tooling:**
- Vite 5.4, TypeScript 5.6 (strict), `@vitejs/plugin-react`
- Vitest 2.1 + jsdom for the component/interaction tests
- `qrcode` 1.5 and `jsqr` 1.4 — **devDependencies only**, oracle verification
- Node 22 in CI

**Not used, despite being common for this kind of project:** no Tailwind, no component
library, no d3 or charting library, no animation library (Framer Motion was permitted for
popovers in the build spec but does not appear in `package.json`), no state library, no
i18n framework, no backend of any kind. Styling is plain CSS with 86 custom properties.
Animation is a hand-rolled rAF loop. Localisation is two flat string files
(`src/copy/id.ts`, `src/copy/en.ts`) — Indonesian first, English second.

---

## 6. Notable features

- **Nine-stage scrubbable pipeline.** Input → encode → codewords → error correction →
  interleave → place → mask → final → damage. The stage rail is a *slider*, not tabs:
  halfway between "place" and "mask" shows the zigzag complete and the mask half applied.
  The matrix never moves or resizes across all nine stages.
- **Byte-to-module highlighting via the QRIS lens.** No mode selector — the lens activates
  automatically when the input parses as a valid EMVCo Merchant-Presented Mode payload
  (opens `000201`, terminates in a validating CRC16 under tag 63). Hover a TLV node and
  exactly the modules carrying those bytes light up. There is a test that decodes *only*
  the highlighted codewords to prove the mapping.
- **Reed-Solomon long division, steppable.** Polynomial division over GF(256) rendered
  term by term from the encoder's own trace, so a user can check one XOR-and-shift by hand.
- **Mask gallery.** All eight candidate matrices as small multiples, each with its penalty
  score broken into the four rules and the offending features — runs of five, 2×2 blocks,
  finder-lookalikes, dark/light imbalance — marked *on that matrix*. No other tool
  visualises mask selection.
- **The damage lab.** Brush the matrix (1 module, or 3×3 with shift) or drag a noise
  slider; watch syndromes compute, error positions locate, and corrected modules snap
  back. Push past correction capacity and it fails visibly, with the failure explained.
  That boundary is the emotional payoff and it's reachable in one gesture.
- **Interleave view as an argument.** Data blocks laid out as rows then read column-wise,
  with the matrix carrying the same block tints — which is the actual explanation for why
  a QR code survives a coffee stain: adjacent modules come from different, separately
  correctable blocks. The animation makes the argument instead of a paragraph.
- **Accessibility as a constraint.** Full keyboard operation including arrow-key module
  navigation with a spoken provenance readout; `prefers-reduced-motion` turns every
  animation into an immediate state change and the zigzag into a step-through; both
  themes hold audited contrast floors (the tightest pairing in either theme is 4.58:1);
  nothing renders below 11px.

---

## 7. Challenges and tradeoffs

**A documented disagreement with the reference implementation.** The engine and `qrcode`
disagree on mask penalty rule 4 and only rule 4: `qrcode` rates dark-module deviation with
`ceil(|pct − 50| / 5)` while ISO/IEC 18004 Table 11 (and ZXing) use the floor. At 51.7%
dark the spec charges 0 and `qrcode` charges 10, which is enough to change which mask
wins. The engine follows the specification. Rather than paper over it, the oracle was
restructured to *force* the mask and demand agreement on all eight — a strictly stronger
claim about construction than agreeing on one — and to check rules 1–3 against `qrcode`'s
own penalty functions plus the selection rule and the rule-4 step size separately. This is
the single best story in the repo: a deliberate, argued, and tested departure.

**A full design-system rewrite mid-build.** `DESIGN.md` revision 1 shipped one muddy chrome
colour, every word in the same 13px monospace, nine stage labels crammed on a horizontal
track, and no light theme. Revision 2 kept every principle (specimen owns pure black and
white, warm structure / cool content, no shadows, no radii) and rebuilt the execution: cool
achromatic chrome in two themes, three typefaces with three distinct jobs, a three-column
frame with a *vertical* stage rail, and a dedicated `--marker` magenta for selection so a
highlight reads on a white module as well as a black one. Four commits over one day
rebuilt the token layer, the app frame, and every view against it.

**jsdom tests could not see the real bugs.** A commit titled "Fix what a real browser
showed" lists six problems found only by rendering the built app in Chromium at 1440×900
and 380px: a sticky footer eating 350px of a 900px viewport, five panels repeating a
heading already shown, an empty interleave matrix (modules aren't placed until the *next*
stage — fixed by showing a tinted completed walk, because the argument needs the codewords
visible where they land), the favicon 404, an input scrolled to the tail of the payload
instead of the identifying head, and a three-line note in a sticky footer. A later commit
did the same for contrast and reduced motion. The lesson worth telling: a comprehensive
unit suite bought correctness, not usability.

**A state-shape bug that broke the app's payoff.** Noise damage was *derived* from the
noise slider on every read rather than stored, so the repair button — which filtered
stored damage — left every noise-selected module in place. The slider is the likeliest
route to stage 9's payoff, so the recovery button looked dead on the main path. Repair now
snapshots the damage standing when it's pressed, drops what the decoder actually fixed,
and keeps the rest.

**Deliberate scope refusals, each argued rather than assumed.** No Kanji mode. No versions
16–40 (QRIS payloads land under v15; larger versions add table bulk and render poorly at
screen size). No camera scanning. No logo embedding or styled/gradient QR — "there is no
download button, those apps exist by the thousand." And no static-to-dynamic QRIS
conversion or amount injection: the reasoning in `PRD.md` §9.2 is notable in that it
explicitly declines the *safety* framing (payload manipulation buys an attacker nothing,
since routing needs a registered acquirer) and rests on product clarity instead — "an
anatomy explainer that also ships a payload editor is a confused product."

**An accessibility claim retracted rather than fixed.** A commit titled "Stop claiming a
table that was never one" removes `role="cell"`/`role="row"` semantics from the interleave
grid, because the cells lived inside a wrapper and no screen reader would ever have
announced a table. It became a labelled group per block — what it actually is — with a
separate codeword table serving as the real text equivalent.

---

## 8. Status

- **Deployed and live** at `https://andifathulms.github.io/anatomi-qris/` via GitHub Pages
  (GitHub Actions). *(Link taken from the README; not verified by loading it, since this
  analysis ran offline.)*
- **Public repository**, `github.com/andifathulms/anatomi-qris` — the README embeds public
  CI and Deploy status badges, which implies public visibility.
- **Production quality, not a prototype.** Two CI workflows (`ci.yml`, `deploy.yml`) both
  run typecheck → full test suite including the oracle → build → bundle budget check, and
  deploy publishes only on green.
- `PRODUCT.md` records the honest state: "shipped and live; the finishing pass (copy,
  keyboard, mobile, Lighthouse) is not fully closed out."
- No users, traffic, testimonials, or press exist — `PRODUCT.md` says so explicitly and
  instructs that none be invented. **Do not manufacture usage numbers for the case study.**

---

## 9. Metrics

| Measure | Value |
|---|---|
| Commits | 44, all single-author |
| Time span | 2026-09-02 11:35 → 2026-09-03 15:27 (+08:00) — roughly 28 hours wall clock, two calendar days |
| Source lines (`src/` + `samples/` + `scripts/`) | 8,637 |
| — QR engine (`src/engine/`) | 1,992 |
| — QRIS/EMVCo layer (`src/qris/`) | 473 |
| — Views (`src/views/`) | 2,374 |
| — Stage panels (`src/stages/`) | 416 |
| — UI primitives (`src/ui/`) | 1,479 |
| — State + copy + styles | 1,582 |
| Test lines / files / cases | 1,479 · 13 files · 84 `it`/`test` blocks |
| Exported engine + QRIS symbols | 123 |
| Pipeline stages | 9 |
| Visualization views | 7 (Matrix, Bitstream, Division, Interleave, MaskGallery, PayloadTree, DamageLab) |
| Bundled sample payloads | 7 (2 QRIS, URL, Wi-Fi, numeric, alphanumeric, long Indonesian sentence) |
| Design tokens | 86 CSS custom properties |
| MCC lookup entries | 85 |
| Locales | 2 (Indonesian primary, English) |
| Runtime dependencies | 5 (React, React DOM, 3 font packages) |
| Runtime network requests | 0, enforced by a build-time scan |
| Bundle, gzipped | 77 KB JS + 6 KB CSS ≈ 83 KB (budget was 250 KB) |
| Largest matrix rendered | 77×77 = 5,929 SVG modules (version 15) |
| Encode budget | < 8 ms for version 15, no debounce, no worker |
| QR coverage | versions 1–15, EC levels L/M/Q/H, numeric + alphanumeric + byte modes, all 8 masks |

---

## 10. Suggested screenshots

Four shots, chosen so each carries a different argument. Take them at 1440×900 in the dark
theme, plus at least one at 380px to evidence the mobile claim.

1. **Stage 9 — the damage lab, pushed just past capacity.**
   The emotional payoff: modules brushed out, the live readout showing capacity used vs.
   remaining, and the visible failure state. Best single hero image.
   → [src/views/DamageLab/DamageLab.tsx](src/views/DamageLab/DamageLab.tsx),
     [src/stages/DamageStage.tsx](src/stages/DamageStage.tsx),
     [src/views/DamageLab/damage-lab.css](src/views/DamageLab/damage-lab.css)

2. **The QRIS lens with a TLV node selected — the payload tree beside the lit modules.**
   This is *the product*. Select "merchant name" on a real sample payload so the tree row,
   the raw-string span, and the exact black squares are all marked in the same magenta.
   → [src/views/PayloadTree/PayloadTree.tsx](src/views/PayloadTree/PayloadTree.tsx),
     [src/views/Matrix/Matrix.tsx](src/views/Matrix/Matrix.tsx),
     [src/qris/tlv.ts](src/qris/tlv.ts),
     [src/qris/dictionary.ts](src/qris/dictionary.ts)

3. **Stage 7 — the mask gallery, all eight candidates scored.**
   The "nobody visualises this" view: eight small multiples, four penalty rules broken out
   per card, offending features marked on each matrix, winner selected.
   → [src/views/MaskGallery/MaskGallery.tsx](src/views/MaskGallery/MaskGallery.tsx),
     [src/engine/mask.ts](src/engine/mask.ts),
     [src/stages/MaskStage.tsx](src/stages/MaskStage.tsx)

4. **Stage 4 — the Reed-Solomon division trace.**
   The credibility shot for a technical audience: GF(256) polynomial long division stepped
   term by term, generator polynomial visible, each XOR-and-shift checkable by hand.
   → [src/views/Division/Division.tsx](src/views/Division/Division.tsx),
     [src/engine/reed-solomon.ts](src/engine/reed-solomon.ts),
     [src/stages/CorrectionStage.tsx](src/stages/CorrectionStage.tsx)

**Optional fifth, if the case study has room for motion:** a short screen recording of the
stage rail being dragged from *place* through *mask*, showing the zigzag complete and the
mask half-applied mid-drag. It demonstrates the continuous-control principle better than
any still.
→ [src/ui/StageScrubber.tsx](src/ui/StageScrubber.tsx),
  [src/views/Matrix/useMatrixPainter.ts](src/views/Matrix/useMatrixPainter.ts)
