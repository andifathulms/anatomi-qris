# DESIGN.md — Anatomi QRIS

The visual and interaction specification. PRD.md is what and why. CLAUDE.md is how it is
built. This is how it looks, moves, and feels.

**Revision 3.** Revision 2 got the principles right and the first ten seconds wrong: it read
as lab equipment when it should feel like an exhibit. Revision 3 keeps the specimen exactly as
it was — pure black on pure white, hard edges, never remounted — and redesigns everything
around it: a tinted palette with one accent, a typeface with a local voice, soft chrome, the
input at the top, the nine stages grouped into four chapters on a filmstrip, the QRIS payload
read back as a receipt in its own tab, and a first-visit welcome and guided tour.

---

## 0. The design problem

A QR code is a printed object. It is black, white, square, and physically flat. Anything
the interface does that contradicts that — rounding a corner, casting a shadow, tinting the
paper — is a lie about the material.

But an explanation of a QR code is *not* a printed object. It is an instrument reading one.
So the app has two registers and they must never blur:

- **The specimen.** Pure black on pure white, hard pixel edges, no radius, no shadow, no
  antialiasing of the module grid. It looks like it was printed, because it was designed to
  be printed.
- **The instrument.** Everything else. Dark by default, because an instrument in a lab is
  dark and the specimen is the only lit thing on the bench.

**The governing rule, unchanged from revision 1:** the matrix owns pure black and pure
white. No interface surface, rule, or text may be `#000000` or `#ffffff`. When you see pure
white on this screen you are looking at paper, and when you see pure black you are looking
at ink. That is what makes the specimen pop off the page. The one light in the app, a soft
pool on the ground behind the bench, says where to look; it never touches the paper.

---

## 1. Design plan

Five moves, in the order they matter.

1. **The specimen stays sacred; the chrome gets friendly.** The matrix keeps radius 0, pure
   black and pure white. Everything else is soft-cornered, so the code is the one perfectly
   square object on the page and the contrast does the work.
2. **One path, four chapters.** The nine stages are grouped by the question each answers —
   text into bits, protection, drawing, stress test — and shown as a filmstrip of live
   thumbnails. Every stage ends with a button that names where it goes next.
3. **Meaning before mechanism.** For a QRIS payload, the first thing you can see is the
   merchant's name, laid out as a receipt. The mechanism is one tab away and every number
   in it is still checkable.
4. **Colour with a budget.** Ten role hues, two functional colours, one accent. The chrome
   neutrals carry a faint indigo bias; nothing else gets a hue.
5. **Both themes, one system.** Dark is the instrument. Light is the lab notebook. Same
   tokens, same contrast floors, same specimen.

---

## 2. Colour

### 2.1 Chrome

Graphite with a faint indigo bias in dark, lilac paper in light. Revision 2's achromatic grey
was correct and cold; a neutral that leans toward the accent reads as chosen. The white
specimen still reads as the warmest, nearest thing on screen.

Dark (default when the system is dark):

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#0d0c12` | Page, under a 16 px dot grid (`--ground-dots`). |
| `--ground-sunk` | `#09080d` | Wells, segmented-control tracks, filmstrip groups. |
| `--surface` | `#16151e` | Cards and panels. |
| `--surface-lift` | `#1f1e2a` | Raised: chips, figures, selected segments, popovers. |
| `--surface-hover` | `#292837` | Pointer feedback only. |
| `--rule` | `#2c2a3a` | Hairlines. |
| `--rule-strong` | `#403d52` | Borders that must be seen. |
| `--ink` | `#eeecf6` | Primary text. 14.1:1 at worst. |
| `--ink-mid` | `#b4b2c6` | Secondary text. 7.9:1 at worst. |
| `--ink-soft` | `#8e8ca2` | Labels, captions. 5.0:1 at worst. |

Light (default when the system is light):

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#f4f3f8` | Page. |
| `--ground-sunk` | `#ebeaf2` | Wells. |
| `--surface` | `#fafafd` | Cards and panels. Not white. |
| `--surface-lift` | `#fdfdfe` | Raised. Still not white. |
| `--surface-hover` | `#efeef5` | Pointer feedback. |
| `--rule` | `#dddbe7` | Hairlines. |
| `--rule-strong` | `#c3c0d2` | Seen borders. |
| `--ink` | `#17161f` | Primary text. 15.0:1 at worst. |
| `--ink-mid` | `#474556` | Secondary. 7.8:1 at worst. |
| `--ink-soft` | `#5f5d70` | Labels. 5.4:1 at worst. |

The theme follows the system by default and can be overridden; the choice persists in
`localStorage`, which is not a network request.

**Depth.** Elevation is a value step plus a hairline. Two exceptions, both for things that
genuinely float: lifted chrome (the welcome card, the module inspector, citation popovers,
the phone sheet) carries `--lift-shadow`, and the bench carries `--bench-light`, a soft
radial pool on the ground behind the specimen. Neither ever touches the paper.

### 2.2 The anatomy palette

Ten module roles. The split carries the meaning: **warm is structure** — the parts of the
code that are the same for every payload at a given version — and **cool is content** —
the parts that are this payload and no other. A reader learns the split without being told,
and once learned, the anatomy view is legible at a glance.

Structure (warm):

| Role | Hex | Why |
| --- | --- | --- |
| `finder` | `#e2452b` | The loudest role, because it is the first thing a scanner looks for. |
| `separator` | `#c98f5e` | Tan. Present but subordinate — it is defined by absence. |
| `timing` | `#e8a317` | Amber, high value, reads as a ruled line. |
| `alignment` | `#b8551f` | A darker sibling of finder: same job, smaller. |
| `darkModule` | `#8f2340` | One module, so it gets the one hue nothing else uses. |

Content (cool):

| Role | Hex | Why |
| --- | --- | --- |
| `format` | `#8b5cf6` | Violet. Metadata about the code, not the payload. |
| `version` | `#3b6fd4` | Blue. Sibling of format, same category. |
| `data` | `#12a89c` | Teal. The payload itself — the role the eye should find fastest. |
| `ecc` | `#6aa832` | Green. Data's partner; adjacent hue, deliberately. |
| `remainder` | `#64748b` | Slate, nearly achromatic, because it carries nothing. |

Revision 1 used a bone `#b9ae97` for separators and a desaturated slate for remainder. At
25 % coverage over white both were invisible, so two of the ten roles could not actually be
found in the anatomy view. Chroma is up across the board and light coverage is up to 32 %.

### 2.3 How the lens works

The tint **rides on the module's value; it never replaces it.**

- A light module takes the role hue at `--lens-light-coverage` (32 %) over white.
- A dark module takes the role hue at `--lens-dark-coverage` (65 %) over black.

Within any role the light variant stays clearly lighter than the dark one, so the QR
silhouette survives being coloured in. You can still read the code by eye in anatomy view.
That is the test: if the silhouette dissolves, the coverage is wrong.

### 2.4 Functional colour, and the accent

Three colours outside the role palette, and nothing else in the app may use them.

| Token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--damage` | `#ff4438` | `#d92c1f` | A module the user broke, or a mask-penalty offence. |
| `--repair` | `#2fd6a8` | `#0b7d60` | A module Reed-Solomon just put back. |
| `--accent` | `#ff4f9e` | `#c8156e` | The tool: selection, focus, the active stage, the primary action. |

Revision 2 confined magenta to the logo and the selection marker. Revision 3 promotes it to
the one UI accent: `--marker` now resolves to `--accent`, so a selected module, a selected
tab, the current filmstrip frame and the next-stage button all read as the same idea. It is
the one hue the ten roles leave free, it is legible over both black and white modules, and
it is the brand's own colour (`--brand-magenta` stays fixed for the mark).

There is no success green, no warning yellow, no selection blue. A thing is either the
specimen, an instrument, damage, a repair, or the accent.

---

## 3. Typography

Two families, three jobs.

- **`--font-sans` and `--font-display` — Plus Jakarta Sans.** Everything a human reads as
  language, and every headline. It was drawn by Tokotype for Jakarta's own identity, which
  is the right voice for an app about QRIS, and it holds at 800 for a stage name and at
  13 px for a gloss.
- **`--font-mono` — JetBrains Mono.** Everything that is data — bits, hex, codeword indices,
  coordinates, the payload string, TLV values — plus the wordmark and the figures. Its 0/O
  and 1/l/I never collide, which matters in a payload. Tabular numerals always.

Both are self-hosted Latin subsets from `@fontsource`: five sans weights, two mono weights.

### 3.1 Scale

| Token | Size | Line | Face | Use |
| --- | --- | --- | --- | --- |
| `--t-hero` | `clamp(2rem, 1.3rem + 2.4vw, 2.875rem)` | 1.02 | sans 800 | Stage name, merchant name, welcome. |
| `--t-display` | `clamp(1.75rem, 1.2rem + 2vw, 2.5rem)` | 1.05 | sans 800 | Large display, where used. |
| `--t-title` | `1.25rem` | 1.2 | mono 600 | Wordmark. |
| `--t-figure` | `1.75rem` | 1 | mono 600 | Big numbers in stage panels. |
| `--t-h2` | `1.125rem` | 1.35 | sans 700 | Card headings, the lede. |
| `--t-h3` | `1rem` | 1.4 | sans 700 | Sub-headings. |
| `--t-body` | `1rem` | 1.6 | sans | Prose and glosses. |
| `--t-data` | `0.8125rem` | 1.6 | mono | Data. |
| `--t-small` | `0.8125rem` | 1.45 | sans | Control text. |
| `--t-micro` | `0.75rem` | 1.35 | sans | Eyebrows, chips, captions. The floor. |

**The eyebrow.** 12 px sans 700, `0.1em` tracking, uppercase via `text-transform`. The
chapter eyebrow above a stage name is the one eyebrow in `--accent`.

Tracking: `--track-tight: -0.03em` on headlines, `--track-label: 0.1em` on eyebrows, `0`
everywhere else.

### 3.2 Prohibitions

- No italics.
- 800 is the ceiling and is for headlines only; 700 for eyebrows, labels and buttons.
- No letter-spacing on body copy.
- No text over 66ch measure.
- No mono for running prose.

---

## 4. Layout

### 4.1 The frame

Five zones, in DOM order: topbar, tray, workbench, filmstrip, colophon.

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR   mark · wordmark · tagline     offline · theme · ID/EN│
├──────────────────────────────────────────────────────────────┤
│ TRAY   [ payload ……………………………  (QRIS terbaca) ]   L M Q H    │
│        samples as chips …                         copy link   │
├───────────────────────────┬──────────────────────────────────┤
│ BENCH (sticky)            │ PANEL                            │
│  chips · printed/anatomy  │  [Tahapan | Isi QRIS]   ▶ tour   │
│  ┌─────────────────────┐  │  BAB III · MENGGAMBAR            │
│  │  matrix (white)     │  │  06/09 Penempatan                │
│  │   + inspector card  │  │  intro · stage content           │
│  └─────────────────────┘  │  ← 05 Interleave   07 Mask →     │
│  module budget legend     │                                  │
├───────────────────────────┴──────────────────────────────────┤
│ FILMSTRIP  I ▢▢▢   II ▢▢   III ▣▢▢   IV ▢          hint      │
└──────────────────────────────────────────────────────────────┘
```

Grid: `minmax(0, 480px) | minmax(0, 1fr)`, `--max-width: 96rem`.

**The specimen never moves.** Still the single most important layout decision. It is sticky
within the workbench and its rects are never remounted between stages or views.

### 4.2 The filmstrip

Nine frames in four chapter groups, sticky to the bottom edge where a timeline lives. Each
frame is a canvas thumbnail of the symbol at the end of its stage, painted from the same
`Build` the matrix paints and repainted only when the build or theme changes.

| Chapter | Question | Stages |
| --- | --- | --- |
| I · Teks jadi bit | How does text become numbers? | 01 Masukan, 02 Encode, 03 Codeword |
| II · Perlindungan | How does a code survive a scratch? | 04 Koreksi galat, 05 Interleave |
| III · Menggambar | How do bits become squares? | 06 Penempatan, 07 Mask, 08 Final |
| IV · Uji ketahanan | Prove it. | 09 Kerusakan |

The strip is one slider. Frames are unevenly spaced (chapter gaps), so the pointer is mapped
piecewise-linearly between measured frame centres; fractional positions remain real. A
playhead under the strip marks the exact position. The current frame carries a 2 px accent
ring; the current chapter's name is in the accent. Below 900 px the names come off the
frames and one line above the strip names the chapter and stage.

The roman numerals live in code, not in the copy files: they are notation, and the copy
register forbids capitals.

### 4.3 The bench

The specimen sits on the open ground, not in a card, under `--bench-light`. Above the matrix:
the build's facts as chips and the printed/anatomy control. Below it: one quiet hint line
and the module-budget legend (§5.8). The matrix is up to 480 px wide; a version 3 code has
chunky modules and a version 15 code has fine ones.

### 4.4 The panel

A card. On top, a bar: the Tahapan / Isi QRIS tabs while the QRIS lens is on, and the tour
button. Then, for stages: the chapter eyebrow, the stage index in mono at a whisper beside
the stage name at `--t-hero` 800, the first-visit lede, the intro, the stage content, and a
footer with previous/next buttons that name their destination. The last stage of a chapter
says the chapter is done and names the next one. For Isi QRIS: the receipt (§5.7).

### 4.5 The tray

Under the topbar, because it is the first thing a visitor should touch and everything below
is derived from it. The payload field is mono, inside a well that also holds a badge stating
what the engine made of the text: mode and version for plain text, or "QRIS terbaca · CRC
cocok" in the accent while the lens is on. Then the EC level, the samples as chips, and the
copy-link control (suppressed while the lens is on, PRD §9).

### 4.6 Shape and rhythm

8 px base, matching the module grid.

`--space-1: 8px`, `-2: 16px`, `-3: 24px`, `-4: 40px`, `-5: 64px`, `-6: 96px`.

Radii: `--r-card: 16px`, `--r-well: 12px`, `--r-ctl: 10px`, `--r-pill: 999px`. The matrix,
its paper, its module grid, filmstrip thumbnails and mask-gallery thumbnails are radius 0:
anything that depicts the specimen is square.

### 4.7 Breakpoints

| Width | Change |
| --- | --- |
| ≥ 1180 px | Two columns as drawn; filmstrip with names and hint. |
| 900–1179 px | Specimen 400 px; tagline and filmstrip hint come off. |
| 720–899 px | Single column: bench, then panel. Filmstrip frames lose their names. |
| < 720 px | Topbar is one row (compact theme and locale buttons) plus the offline line. Samples scroll sideways. The panel becomes a sheet with a grip. A sideways swipe on the matrix moves one stage (touch only, never in the damage lab). |
| < 380 px | Quality floor. Nothing overflows, nothing clips, nothing is smaller than 12 px. |

---

## 5. The instruments

Unchanged in intent from revision 1; restated with the new tokens.

### 5.1 Matrix
SVG, one `<rect>` per module, `shapeRendering="crispEdges"`, no per-module listeners — one
listener on the group, hit-tested by dividing pointer coordinates by module size. The rects
are created once per build and never remounted; the paint loop mutates fills. Focus is a
`--marker` inset stroke; a highlight is a filled figure on a faded ground (§5.8).

### 5.2 Bitstream ribbon
Five spans told apart by value, not hue: mode, count, payload, terminator, padding. The
colour budget belongs to the roles. Codeword grouping adds hairline separators and a hex
readout at stage 3.

### 5.3 Reed-Solomon division
The recorded trace, rendered. Never recomputed. Changed terms are marked by weight and an
underline, not by colour.

### 5.4 Interleave
Block rows tinted by a generated ramp, lifting column by column into the output row. The
tints also ride the matrix at that stage, which is where the coffee-stain argument lands:
adjacent modules are visibly different colours.

### 5.5 Mask gallery
Eight cards, four rules each, the winner marked by a filled square and nothing else. The
selected card projects its candidate onto the main matrix with its penalty geometry marked
in `--damage`.

### 5.6 Damage lab
A brush on the matrix and a noise slider. The slider draws from a fixed shuffle so dragging
back removes damage rather than leaving it behind. Damage is `--damage`; repaired modules
pulse `--repair` then snap to their true value. The capacity meter turns `--damage` when the
block is past saving.

### 5.7 The receipt (Isi QRIS)
A second tab beside the stages, present only while the lens is on. The payload is laid out
as a struk: the CRC verdict, the merchant name (tag 59) at `--t-hero`, city, postal code and
initiation method as chips, a dashed tear line, then one full-width line item per tag with
its dictionary meaning and gloss. Selecting a line lights its modules and shows the chain —
field, bytes in hex, codewords, modules — read off the provenance map. The matrix shows the
finished symbol in this view, whatever stage the slider is at.

### 5.8 Highlight, isolation and the legend
A highlight (from the receipt, the bitstream or anywhere else) is a figure on a faded ground:
selected modules take the accent, solid on dark modules and washed on light ones, and every
other dark module fades to a pale grey. The legend is a module budget drawn to scale from the
provenance map; each role is a toggle that isolates it the same way, in its role tint.

### 5.9 The inspector
Hovering or arrowing to a module shows a lifted card beside it: coordinates, role, value,
mask flip, what it carries, the payload field (lens on) and placement order. It flips side
in the right half of the grid and above the module near the bottom. It is pointer-
transparent and hidden from assistive technology, which hears the focused module through a
live region instead.

### 5.10 Welcome and tour
First visit only, and never on a shared link: a card with the app's two questions as two
doors. One loads the QRIS sample and opens the receipt; the other starts the tour. The tour
moves the stage slider on a timer — hold, then scrub continuously to the next stage, with the
zigzag given its own longer transition — and any stage change it did not make hands control
back to the reader.

---

## 6. Motion

### 6.1 The rule

**Continuous control → direct mapping.** The filmstrip and the damage slider follow the
pointer with zero easing.

**Discrete control → timed transition.** EC level, forced mask, anatomy toggle, theme —
these animate over a duration because the user needs to see what changed.

### 6.2 Durations

`--dur-zigzag: 2400ms`, `--dur-anatomy: 480ms`, `--dur-mask: 360ms`,
`--dur-interleave-col: 90ms`, `--dur-division: 220ms`, `--dur-repair: 300ms`,
`--dur-popover: 140ms`, `--dur-theme: 200ms`, `--dur-control: 120ms`,
`--dur-tour-step: 6200ms` (how long the tour holds each stage).

Easing: `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` for chrome,
`--ease-emphasis: cubic-bezier(0.32, 0.72, 0, 1)` for the matrix.

### 6.3 Restraint

One orchestrated moment per stage, maximum. No hover animations on data cells. No entrance
animations on panels. No spring physics anywhere — this is a measuring instrument.

### 6.4 Reduced motion

`prefers-reduced-motion: reduce` sets every duration token to `0ms` and turns the zigzag
into a step-through. The animation loop reads the same preference. The tour never runs a
loop under reduced motion: its button advances one stage per press. The welcome card
appears without fading and its doors do not lift on hover.

---

## 7. Copy

Indonesian first, English second, flat string files, no framework.

Register: precise and plain. Sentence case, no exclamation marks, no shouting. Terms of art
stay in English where no settled Indonesian equivalent exists — "codeword", "mask",
"interleave" — and each gets a one-sentence gloss the first time it appears, set in
`--t-body` sans at `--ink-soft` directly under the heading that introduced it.

Spec citations are an inline marker opening a dismissible popover: ISO/IEC 18004 for QR
structure, the EMVCo Merchant-Presented Mode specification for payload structure.

Uppercase is never in the copy. Eyebrows are `text-transform` and nothing else.

---

## 8. Quality floor

- Contrast: `--ink` ≥ 12:1 on `--surface`, `--ink-mid` ≥ 7:1, `--ink-soft` ≥ 4.6:1. Both
  themes.
- Focus: 2 px `--accent` outline at 2 px offset on every interactive element. Never removed.
- Every control reachable and operable by keyboard, including the rail and the matrix.
- Nothing below 12 px.
- No layout shift when the inspector, the legend, or the receipt appears.
- 380 px wide with no overflow.
- Empty network tab after load, in both themes.

---

## 9. What revision 3 does not change

The engine, the provenance map, the division trace, the nine stages and their order, the
continuous slider, the specimen's black and white and hard edges, the one persistent set of
rects, the offline guarantee, and the refusal to let the app edit a payload. Those were
right. Only the surface and the way in were wrong.
