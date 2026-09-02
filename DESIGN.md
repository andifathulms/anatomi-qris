# DESIGN.md — Anatomi QRIS

The visual and interaction specification. PRD.md is what and why. CLAUDE.md is how it is
built. This is how it looks, moves, and feels.

**Revision 2.** Revision 1 established the right instincts — the matrix as a fixed spine,
a role palette split warm/cool, no shadows, no rounding — and then under-served them. The
chrome was a single muddy green-grey; every word in the interface was set in the same 13 px
monospace, so nothing had rank; the nine stages were nine cramped stations on a horizontal
track; and there was only ever one theme. Revision 2 keeps every principle and rebuilds the
execution.

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
at ink. That is what makes the specimen pop off an otherwise unremarkable page without a
single glow, gradient, or drop shadow.

---

## 1. Design plan

Five moves, in the order they matter.

1. **Two registers, one white rectangle.** The specimen sits on its own card and never
   moves. Everything else is instrument chrome that changes around it.
2. **Rank the type.** Sans for anything a human reads as language. Mono for anything that
   is data — bits, hex, coordinates, payload strings. Display mono only for the wordmark,
   stage numerals, and figures. Revision 1 set all three in the same face at the same size,
   which is why every panel read as an undifferentiated wall.
3. **Give the nine stages a spine you can read.** A vertical rail on the left with full
   stage names, always visible, always draggable. Nine labels on a horizontal track meant
   eight of them were hidden on any screen narrower than a desktop.
4. **Colour with a budget.** Ten role hues, two functional colours, one marker. Nothing
   else gets a hue. Chrome is achromatic.
5. **Both themes, one system.** Dark is the instrument. Light is the lab notebook. Same
   tokens, same contrast floors, same specimen.

---

## 2. Colour

### 2.1 Chrome

Chrome is achromatic with a faint cool cast — barely a hue, just enough that the white
specimen reads as warmer than its surroundings and therefore closer to the eye. Warm chrome
would fight the paper; neutral grey next to pure white looks dirty.

Dark (default):

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#0e1013` | Page. Not black — the specimen owns black. |
| `--ground-sunk` | `#0a0b0e` | Wells: input fields, scroll regions, tracks. |
| `--surface` | `#16191e` | Cards and panels. |
| `--surface-lift` | `#1d2128` | Raised: popovers, active segments, table stripes. |
| `--surface-hover` | `#252a32` | Pointer feedback only. |
| `--rule` | `#282d35` | Hairlines. |
| `--rule-strong` | `#3a414d` | Borders that must be seen: card edges, focus wells. |
| `--ink` | `#e9edf3` | Primary text. Not white. |
| `--ink-mid` | `#aab3c0` | Secondary text, data values. |
| `--ink-soft` | `#8b95a4` | Labels, captions, disabled. AA against `--surface`. |

Light:

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#e9ebef` | Page. |
| `--ground-sunk` | `#dfe2e8` | Wells. |
| `--surface` | `#f7f8fa` | Cards and panels. Not white. |
| `--surface-lift` | `#fcfcfd` | Raised. Still not white. |
| `--surface-hover` | `#eef0f4` | Pointer feedback. |
| `--rule` | `#dadde4` | Hairlines. |
| `--rule-strong` | `#bcc2cd` | Seen borders. |
| `--ink` | `#14171c` | Primary text. Not black. |
| `--ink-mid` | `#454c58` | Secondary. |
| `--ink-soft` | `#58616e` | Labels. Meets 4.6:1 on `--ground-sunk`, the tightest pairing. |

The theme follows the system by default and can be overridden; the choice persists in
`localStorage`, which is not a network request.

**Depth without shadows.** Elevation is expressed by ground → surface → surface-lift value
steps plus a 1 px rule, never by a shadow. One exception, and it is not a shadow: a popover
carries a 1 px `--rule-strong` border and sits on `--surface-lift`, which is enough
separation because it is always over a darker card.

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

### 2.4 Functional colour, and the marker

Three colours outside the role palette, and nothing else in the app may use them.

| Token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--damage` | `#ff4438` | `#d92c1f` | A module the user broke, or a mask-penalty offence. |
| `--repair` | `#2fd6a8` | `#0b7d60` | A module Reed-Solomon just put back. |
| `--marker` | `#f0439a` | `#c2166f` | Selection and focus. Nothing else. |

`--marker` is new in revision 2 and it fixes a real defect. Revision 1 stroked the selected
and hovered modules in `--ink` — a pale grey. On a dark module that read; on a light module
it was invisible against white paper. Half of every highlight simply did not render.
Magenta is the one hue the ten roles leave free, it is legible over both black and white
modules, and it is the conventional cursor colour in instrument software, so it reads as
"the tool" rather than "part of the specimen".

There is no success green, no warning yellow, no selection blue. A thing is either the
specimen, an instrument, damage, a repair, or the marker.

---

## 3. Typography

Three faces, three jobs, no overlap. Revision 1's single failure mode was setting all three
jobs in the same face at the same size.

- **`--font-sans` — IBM Plex Sans.** Everything a human reads as language: prose, glosses,
  labels, buttons, headings, table headers. This is the default for `body`.
- **`--font-mono` — IBM Plex Mono.** Everything that is data: bits, hex, codeword indices,
  coordinates, the raw payload string, TLV values, GF(256) terms. Tabular numerals always.
- **`--font-display` — Martian Mono.** The wordmark, stage numerals, and figures. Nothing
  else. It is a strong face and it is used sparingly on purpose.

### 3.1 Scale

| Token | Size | Line | Face | Use |
| --- | --- | --- | --- | --- |
| `--t-display` | `clamp(1.75rem, 1.2rem + 2vw, 2.75rem)` | 1.02 | display | Stage name. |
| `--t-title` | `1.375rem` | 1.15 | display | Wordmark. |
| `--t-figure` | `1.75rem` | 1 | display | Big numbers in stage panels. |
| `--t-h2` | `1.0625rem` | 1.3 | sans 600 | Panel and card headings. |
| `--t-h3` | `0.875rem` | 1.35 | sans 600 | Sub-headings. |
| `--t-body` | `0.9375rem` | 1.65 | sans | Prose and glosses. |
| `--t-data` | `0.8125rem` | 1.5 | mono | Data. |
| `--t-small` | `0.75rem` | 1.45 | sans | Captions, control text. |
| `--t-micro` | `0.6875rem` | 1.3 | mono | Bit cells, dense grids. |

Revision 1's `--t-micro` was 10 px. Eleven is the floor; below that a monospace digit stops
being a digit.

**The eyebrow.** Every card and every section within a panel is introduced by an eyebrow:
11 px sans, `0.09em` tracking, uppercase via `text-transform`, `--ink-soft`. Never uppercase
in the copy files — the copy register forbids shouting, and this is presentation.

Tracking tokens: `--track-tight: -0.02em` on display sizes, `--track-label: 0.09em` on
eyebrows, `0` everywhere else.

### 3.2 Prohibitions

- No italics. There is no italic in the mono faces and a synthesised one is a smear.
- No font-weight above 600. Martian Mono at 500 already carries every heavy moment.
- No letter-spacing on body copy.
- No text over 66ch measure.
- No mono for running prose, ever. That was revision 1's mistake and it made a teaching app
  read like a log file.

---

## 4. Layout

### 4.1 The frame

Three zones, in DOM order: topbar, workbench, console.

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR   wordmark · tagline          offline · ID/EN · theme │
├───────────┬────────────────────┬─────────────────────────────┤
│ STAGE     │ SPECIMEN           │ PANEL                       │
│ RAIL      │ (sticky)           │  01/09                      │
│           │                    │  Stage name (display)       │
│ 01 Input  │  ┌──────────────┐  │  Intro prose                │
│ 02 Bits   │  │   matrix     │  │  ─────────────────────      │
│ 03 …      │  │  (white)     │  │  stage content              │
│ …         │  └──────────────┘  │                             │
│ 09 Damage │  readout strip     │  ┌───────────────────────┐  │
│           │  as-printed/anatomy│  │ payload tree (lens)   │  │
│           │  legend            │  └───────────────────────┘  │
├───────────┴────────────────────┴─────────────────────────────┤
│ CONSOLE  [ payload ................. ]  EC · samples · link  │
└──────────────────────────────────────────────────────────────┘
```

Grid: `208px | minmax(0, 460px) | minmax(0, 1fr)`, `--max-width: 96rem`. Revision 1 used
two columns inside 78 rem and left a third of a wide screen empty while the stage panel
scrolled.

**The specimen never moves.** This is still the single most important layout decision. It
is sticky within the workbench and its card does not resize, reflow, or remount between
stages. Nine stages must read as one object being transformed, not nine illustrations in a
row.

### 4.2 The stage rail

Nine stations, numbered `01`–`09`, each with its full name. The rail is a slider: dragging
it moves through stages continuously, clicking a station jumps. Fractional positions are
real — halfway between *place* and *mask* shows the zigzag complete and the mask half
applied. That continuity is what makes it an instrument rather than a row of tabs, and it
is why `encode()` has an 8 ms budget.

The active station carries a filled marker, `--ink` text, and a 2 px `--marker` bar on its
leading edge. Passed stations are `--ink-mid`; unreached ones are `--ink-soft`.

Below 1100 px the rail lies down: it becomes a horizontal track above the panel, station
labels reduced to numerals with the active one named. Below 720 px it becomes a
horizontally scrollable chip strip that scrolls the active chip into view.

### 4.3 The specimen card

Card header: the four facts that identify this build — version, EC level, mode, mask — as
chips, mono values on sans labels. Then the matrix. Then a fixed-height readout strip that
never collapses, because a strip that appears and disappears on hover makes the whole
column jump. Then the as-printed / anatomy segmented control, and the legend when anatomy
is on.

The matrix is a fixed 460 px on desktop regardless of version, so a version 3 code has
chunky modules and a version 15 code has fine ones. That is honest: it is the actual
difference between them.

### 4.4 The panel

Header: stage index in display mono at `--ink-soft` (`01/09`), stage name at
`--t-display`, intro prose at `--t-body` capped to 60ch, then a full-bleed hairline. The
content below is the stage component. Every distinct section inside it opens with an
eyebrow.

The payload tree is a separate card beneath the panel, present at every stage while the
lens is active — the payload's meaning does not change as the encoding proceeds, only its
representation.

### 4.5 The console

Sticky to the bottom edge, on `--ground` with a top rule so panel content scrolls under it
cleanly. One row: the payload field takes the remaining width and is set in mono because
what goes in it is data; then EC level, samples, and copy-link.

Revision 1 also put the scrubber here, which meant the two things a user changes constantly
competed for the same 96 px of a sticky bar. The rail took that job.

### 4.6 Grid and rhythm

8 px base, matching the module grid, so a byte highlighted in three places is the same
width in all three.

`--space-1: 8px`, `-2: 16px`, `-3: 24px`, `-4: 40px`, `-5: 64px`, `-6: 96px`.

Cards use `--space-3` padding on desktop, `--space-2` below 900 px. Card radius is `0`
everywhere. Everything here is a square cell.

### 4.7 Breakpoints

| Width | Change |
| --- | --- |
| ≥ 1180 px | Three columns as drawn. |
| 900–1179 px | Rail lies down above the panel; specimen and panel side by side. |
| 720–899 px | Single column. Specimen first, then panel, then tree. |
| < 720 px | Rail becomes a chip strip. Console stacks: field on its own row, controls below. Matrix full width. |
| < 380 px | Quality floor. Nothing overflows, nothing clips, nothing is smaller than 11 px. |

---

## 5. The instruments

Unchanged in intent from revision 1; restated with the new tokens.

### 5.1 Matrix
SVG, one `<rect>` per module, `shapeRendering="crispEdges"`, no per-module listeners — one
listener on the group, hit-tested by dividing pointer coordinates by module size. The rects
are created once per build and never remounted; the paint loop mutates fills. Focus and
highlight are a `--marker` inset stroke.

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

---

## 6. Motion

### 6.1 The rule

**Continuous control → direct mapping.** The stage rail and the damage slider follow the
pointer with zero easing.

**Discrete control → timed transition.** EC level, forced mask, anatomy toggle, theme —
these animate over a duration because the user needs to see what changed.

### 6.2 Durations

`--dur-zigzag: 2400ms`, `--dur-anatomy: 480ms`, `--dur-mask: 360ms`,
`--dur-interleave-col: 90ms`, `--dur-division: 220ms`, `--dur-repair: 300ms`,
`--dur-popover: 140ms`, `--dur-theme: 200ms`, `--dur-control: 120ms`.

Easing: `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` for chrome,
`--ease-emphasis: cubic-bezier(0.32, 0.72, 0, 1)` for the matrix.

### 6.3 Restraint

One orchestrated moment per stage, maximum. No hover animations on data cells. No entrance
animations on panels. No spring physics anywhere — this is a measuring instrument.

### 6.4 Reduced motion

`prefers-reduced-motion: reduce` sets every duration token to `0ms` and turns the zigzag
into a step-through. The animation loop reads the same preference.

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
- Focus: 2 px `--marker` outline at 2 px offset on every interactive element. Never removed.
- Every control reachable and operable by keyboard, including the rail and the matrix.
- Nothing below 11 px.
- No layout shift when the readout, the legend, or the tree appears.
- 380 px wide with no overflow.
- Empty network tab after load, in both themes.

---

## 9. What revision 2 does not change

The engine, the provenance map, the division trace, the nine stages, the specimen's black
and white, the absence of shadows and radii, the offline guarantee, and the refusal to let
the app edit a payload. Those were right. Only the surface was wrong.
