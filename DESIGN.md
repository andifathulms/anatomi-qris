# DESIGN.md — Anatomi QRIS

Visual and motion specification. PRD.md defines substance; this defines form.

---

## 0. The design problem

A QR code is the most colour-constrained object a designer can be handed. It is true black
on true white, and it has to stay that way — tint it and it is no longer honestly the
thing the app claims to explain.

But the app's entire purpose is to distinguish ten different roles a module can play:
finder, separator, timing, alignment, dark module, format bits, version bits, data
codewords, EC codewords, remainder. That needs a categorical palette.

So the two requirements are in direct conflict. The resolution is the app's central visual
idea:

**Colour is applied as a lens, not as a replacement.** Anatomy tints ride *on top of* the
black-and-white reading rather than overwriting it. A tinted white module stays clearly
lighter than a tinted black module of the same hue. At any moment the user can still see
that they are looking at a QR code, and the toggle between the two states — pure and
tinted — is one of the app's two orchestrated moments (§6.4).

This also settles the surrounding design: the artefact owns pure black and pure white, so
the interface may not use either. Chrome lives strictly between.

---

## 1. Design plan

**Concept: the proof sheet.**

The register is a printer's proof — the stage before something goes to press, where the
plate separations are inspected one at a time. That is literally what the pipeline does:
it takes one printed object apart into the layers that composed it, and lets you look at
each.

That gives the app its structure (one artefact, many separations), its palette (screen-
printing ink hues rather than data-visualization defaults), and its typography (technical,
monospaced, aligned to a grid — because the subject is a grid and every value in the app
is a column of digits that must line up).

**Alignment:** everything aligns to a module grid. The matrix, the bitstream ribbon, the
codeword table, and the TLV tree all share one 8 px base unit so that when a byte
highlights in three places at once, the three highlights are visually the same width.

---

## 2. Colour

### 2.1 Ground and chrome

Neither black nor white; the matrix owns those.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#1D2320` | Page. Deep, slightly green-shifted neutral — the tone of a press-room surface, not a UI dark mode. |
| `--surface` | `#2A312D` | Panels: the bitstream ribbon, the TLV tree, the division steps. |
| `--surface-lift` | `#38403B` | Selected rows, active stage, hovered nodes. |
| `--ink` | `#DDE3DE` | Primary text. Not white — white is reserved for light modules. |
| `--ink-soft` | `#96A099` | Labels, axis text, inactive stages. |
| `--rule` | `#454E48` | Hairlines and grid. |

The matrix's quiet zone renders in pure `#FFFFFF` and its dark modules in pure `#000000`,
sitting on `--ground`. That contrast is what makes the code read as a physical object laid
on the page rather than as an element of the interface.

### 2.2 The anatomy palette

Ten roles, ten hues. Chosen as a screen-printing ink set — saturated, slightly impure,
mixable — rather than a categorical scale from a charting library.

| Role | Hue | Value |
|---|---|---|
| Finder | vermilion | `#D8452B` |
| Separator | bone | `#B9AE97` |
| Timing | ochre | `#D69A24` |
| Alignment | rust | `#A85A2E` |
| Dark module | oxblood | `#7A2E32` |
| Format info | violet | `#7C5BB8` |
| Version info | indigo | `#4759A8` |
| Data codewords | teal | `#1E8C86` |
| EC codewords | moss | `#5E8F3A` |
| Remainder | slate | `#5D6B72` |

Constraints on this set:

- Function patterns (finder, separator, timing, alignment, dark module) occupy the warm
  half; payload-bearing modules (format, version, data, EC, remainder) occupy the cool
  half. The warm/cool split is itself information: warm modules are structure, cool
  modules are content. A user learns this without being told.
- Data teal and EC moss must be adjacent enough to read as related — they are both
  codewords — and separable enough to be counted. This is the most important pairing in
  the palette; tune it first.
- Every hue must reach 3:1 against `--surface` when used as a legend swatch.

### 2.3 How the lens works

The anatomy tint never replaces the module's value.

- A **light module** takes the role hue at roughly 25% coverage over white.
- A **dark module** takes the role hue at roughly 65% coverage over black.

Result: within any one role, dark and light modules stay clearly distinguishable, and the
overall pattern of the code remains readable. Verify by eye at 100%, 50% and 25% zoom —
if the QR silhouette disappears at any of them, the coverage values are wrong.

Masked modules — those the mask flipped — carry a 1 px inset stroke in the same hue at
higher chroma. This is how the mask layer stays separable from the data layer without a
second colour system.

### 2.4 Two functional colours

| Token | Value | Use |
|---|---|---|
| `--damage` | `#E8543C` | Damaged modules and corrupt codewords, in the damage lab only. |
| `--repair` | `#4FC1A6` | Modules corrected by Reed-Solomon, for the duration of the repair animation only. |

Nothing else in the app is coloured. No hover tints, no selection blue, no success green.
Selection is a 2 px `--ink` outline.

---

## 3. Typography

**IBM Plex Mono** carries the app. Not as small data labels — as the primary voice,
including headings and most running text.

That inverts the usual treatment, and it is justified rather than affected: this app is
bits, hex, and TLV strings, all of which must align in columns, and the subject itself is a
grid of fixed-width cells. A proportional face would fight the material at every turn.
Plex Mono has enough humanist warmth to survive being read at length.

**Martian Mono** for display only — the stage names and the two or three large figures.
Its width axis and squared terminals read as machine-cut, which suits an object made of
squares. Never below 24 px, never in running text.

**IBM Plex Sans** for the one place mono would genuinely hurt: the longer explanatory
passages in stage introductions and spec-citation popovers. Two or three short paragraphs
per stage, no more.

### 3.1 Scale

Base 16 px, ratio 1.25.

| Token | Size / line-height | Face | Use |
|---|---|---|---|
| `--t-display` | 39 / 1.05, 500 | Martian Mono | Stage name |
| `--t-figure` | 31 / 1.0, 500 | Martian Mono | Version, capacity, damage counters |
| `--t-h2` | 20 / 1.25, 500 | Plex Mono | Panel headings |
| `--t-body` | 15 / 1.6, 400 | Plex Sans | Explanatory copy. Max 66 characters. |
| `--t-data` | 13 / 1.5, 400 | Plex Mono | Bits, hex, TLV values, codeword tables |
| `--t-small` | 12 / 1.4, 400 | Plex Mono | Labels, legend, module coordinates |
| `--t-micro` | 10 / 1.2, 500 | Plex Mono | Module indices in the matrix at high zoom |

`font-variant-numeric: tabular-nums` everywhere, though Plex Mono is already monospaced —
set it anyway so a fallback face cannot break alignment mid-animation.

### 3.2 Prohibitions

No all-caps labels. No tracked-out eyebrows. No single word in a heading given a different
colour or weight. Sentence case throughout, including buttons and stage names.

---

## 4. Layout

### 4.1 The spine

The matrix never moves. Everything else changes around it. This is the single most
important layout decision in the app: it is what makes nine stages read as one object
being transformed rather than nine illustrations in a row.

```
┌───────────────────────────────────────────────────────────────┐
│ Anatomi QRIS                              tidak ada koneksi ✓ │
├──────────────────────────┬────────────────────────────────────┤
│                          │                                    │
│   ┌──────────────────┐   │  stage panel — changes per stage:  │
│   │                  │   │                                    │
│   │   THE MATRIX     │   │  · bitstream ribbon                │
│   │   fixed size,    │   │  · codeword table                  │
│   │   fixed position │   │  · RS division steps               │
│   │                  │   │  · interleave grid                 │
│   └──────────────────┘   │  · mask gallery (8 up)             │
│   v7-M · byte · mask 3   │  · damage controls                 │
│   [ as printed | anatomy]│                                    │
├──────────────────────────┴────────────────────────────────────┤
│  TLV TREE — present at every stage when the lens is active    │
│  00 │ 02 │ 01        Payload format indicator                 │
│  26 │ 38 │ …         Merchant account information             │
│      └ 00 │ 15 │ …   Globally unique identifier               │
├───────────────────────────────────────────────────────────────┤
│ 1─2─3─4─5─6─7─8─9   input ▸ encode ▸ … ▸ damage               │
│ ●────────────────   [ text or QRIS payload            ]       │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 The stage scrubber

Pinned to the bottom, full width, with the input field beside it. Nine stations along a
track; dragging moves through them continuously, clicking jumps.

Between stations the transition is continuous, not discrete — dragging halfway between
"place" and "mask" shows the zigzag complete and the mask half-applied. This is what makes
the scrubber feel like an instrument rather than a set of tabs, and it is why the
performance budget in CLAUDE.md matters.

The input field sits in the same bar because input and stage are the two things a user
changes constantly. Everything else is in the stage panel.

### 4.3 The TLV tree

A full-width band below the matrix, present at every stage when the QRIS lens is active,
absent otherwise — the layout reflows rather than leaving a gap.

Three aligned columns: tag, length, value. Nested templates indent by one 8 px unit with a
hairline connector. Each row carries its meaning in `--ink-soft` at the right.

Below the tree, the raw payload string in `--t-data`, with the selected node's characters
marked by a background in `--surface-lift`. Seeing the string and the structure
simultaneously is what teaches TLV.

### 4.4 Grid and rhythm

8 px base unit, matching the module grid. Spacing scale: 8 · 16 · 24 · 40 · 64 · 96.
Max width 78 rem. Panels are square-cornered — 0 radius, not 2 — because everything in
this app is a square cell and rounding would be a lie about the material. No shadows.

### 4.5 Mobile

Below 720 px the matrix stays the hero at full width. The stage panel moves below it.
The TLV tree collapses to tag and meaning, with length and value on tap. The scrubber keeps
the full width; the input moves above it. The mask gallery becomes a 2×4 grid with the
penalty breakdown on tap rather than always visible.

---

## 5. The instruments

### 5.1 Matrix

Fixed at 480 px on desktop regardless of version, so a version 3 code has chunky modules
and a version 15 code has fine ones — which is honest, since that is the actual difference
between them.

Hovering a module shows a readout: coordinates, role, value, whether the mask flipped it,
and which codeword and bit it carries. Arrow keys move a focus ring module by module with
the same readout announced.

The two rendering states — as printed, anatomy — are a two-item toggle directly beneath
the matrix, never in a settings menu.

### 5.2 Bitstream ribbon

A horizontal run of bit cells, 8 px each, matching the module grid so a byte here is
visually the same width as a byte anywhere else in the app.

Grouping changes with the stage: loose bits at stage 2, 8-bit groups with hairline
separators at stage 3, block-coloured at stage 5. The cells never remount — they regroup,
so the user can follow individual bits across the transformation.

Bidirectional binding with the matrix: select bits, modules highlight; select modules,
bits highlight. Instant, no animation — this is a query, not a transition.

### 5.3 Reed-Solomon division

The generator polynomial fixed at the top. Below it, one row per division step: the
remainder before, the generator multiple being XORed in, and the remainder after, with
changed bytes marked.

Steppable and scrubbable. Each byte shows as hex by default, with a toggle to α-notation
(GF(256) exponents), because the multiplication only makes sense in exponent form and the
XOR only makes sense in hex. Showing both is how the operation becomes teachable.

### 5.4 Interleave

Data blocks as rows of a grid. A read head sweeps down each column in turn, lifting one
byte from each block and dropping it into the output stream below.

When the sweep completes, the output stream's bytes carry their source block's tint, and
the matrix — still visible to the left — shows the same tints in place. That is the moment
the coffee-stain argument lands: adjacent modules are visibly different colours, meaning
different blocks, meaning localized damage is spread thin.

### 5.5 Mask gallery

Eight matrices at 140 px each, in two rows of four. Under each: the four penalty
components and the total.

Selecting one enlarges it and highlights the offending features on the matrix itself —
runs of five or more, 2×2 blocks, the 1:1:3:1:1 finder-alike pattern, and a balance bar
for the dark/light ratio. Each rule's highlight uses the same hue as its score readout, so
the number and the geometry are linked without a legend.

The winner carries a filled marker; the others do not. No trophy, no glow, no colour
change — the score is the argument.

### 5.6 Damage lab

The matrix becomes paintable. A brush the user drags, plus a density slider for random
noise.

Damaged modules render `--damage` and stay damaged. A live counter reads: modules hit,
codewords corrupt, capacity used out of capacity available. The capacity bar is the one
element in the app that should draw the eye — it is a simple horizontal meter, and it fills
as the user paints.

When correction runs, corrupt codewords are located, their modules pulse once in
`--repair`, and snap to their true values. When capacity is exceeded, the correction
visibly fails and the readout states which codewords could not be located and why.

---

## 6. Motion

### 6.1 The rule, carried from the house layer

**Continuous control → direct mapping, zero easing.** Stage scrubber and damage slider
follow the pointer exactly.

**Discrete control → timed transition.** EC level change, forced mask, anatomy toggle,
TLV node selection.

This distinction is what makes the app feel like an instrument. It came out of Suara ke
Kursi and it belongs in the house layer now.

### 6.2 Durations

| Event | Duration | Curve |
|---|---|---|
| Zigzag placement (play mode) | 2400 ms total, eased in and out | `cubic-bezier(.4,0,.2,1)` |
| Anatomy toggle | 480 ms, radial from top-left | `cubic-bezier(.32,.72,0,1)` |
| Mask application | 360 ms | `cubic-bezier(.32,.72,0,1)` |
| Interleave sweep | 90 ms per column | linear |
| Division step | 220 ms | `cubic-bezier(.4,0,.2,1)` |
| Repair pulse | 300 ms | `cubic-bezier(.4,0,.2,1)` |
| Highlight bind (bits ↔ modules) | 0 ms | none — this is a query |
| Popover | 140 ms | `cubic-bezier(.4,0,.2,1)` |

### 6.3 First orchestrated moment: the zigzag

The single best thing in this app. Data bits fill the matrix in a boustrophedon from the
bottom-right, two columns wide, snaking up and down, hopping over every function pattern.

Modules land one at a time, each appearing at its role tint before settling to its value.
The path is genuinely non-obvious and watching it is the moment a user understands that a
QR code has a reading order.

Play, pause, step, scrub. At version 15 there are thousands of modules, so the animation
places them in small batches to hold 2400 ms — but the batching must not be visible, and
the path must never skip.

The function patterns are already on the matrix before the zigzag begins, greyed. They
light to their role tints as the walk passes them, which is how the user sees that the walk
is avoiding them rather than overwriting them.

### 6.4 Second orchestrated moment: the anatomy toggle

Switching from "as printed" to "anatomy" is not a crossfade. Colour arrives as a wave
sweeping diagonally from the top-left finder pattern across the matrix, each module taking
its tint as the wave reaches it.

The reverse — anatomy back to as printed — sweeps the same direction, draining colour.

This is the app's second-best moment because it is the moment the two readings of the same
object are shown to be the same object. Give it the full 480 ms and do not shorten it.

### 6.5 Restraint

Nothing else animates on its own. No entrance animations on panels, no hover transitions on
the mask gallery cards, no pulsing call to action. Two orchestrated moments is the budget
and it is already generous.

### 6.6 Reduced motion

`prefers-reduced-motion: reduce`: the zigzag becomes step-only with an immediate write per
step; the anatomy toggle becomes instant; the interleave sweep becomes a single state
change; the repair pulse becomes a 1-frame colour set. Every number and every state stays
reachable. Test this — do not assume it.

---

## 7. Copy

Indonesian, sentence case, no exclamation marks.

The offline guarantee appears once, beside the input, as a plain statement of fact rather
than a badge: `Semua diproses di perangkat ini. Tidak ada data yang dikirim.`

Terms of art stay in English where no settled Indonesian equivalent exists — codeword,
mask, interleaving — and each gets a one-sentence gloss on first appearance, in
`--ink-soft` directly beneath the heading that introduces it.

Failure states describe what happened, in the interface's voice: `CRC tidak cocok.
Ditemukan 6304ABCD, seharusnya 6304A13F.` Never an apology, never vague.

Empty state, before anything is typed: the input is focused and a sample chooser sits
beneath it. No illustration, no welcome copy.

---

## 8. Quality floor

Assumed, not announced: usable at 380 px; visible keyboard focus everywhere including
per-module navigation in the matrix; every visual has a keyboard-reachable table
equivalent; contrast 4.5:1 for text and 3:1 for graphical objects; no layout shift on stage
change; reduced motion honoured; nothing loads from a network.

## 9. Relationship to the house layer

Takes: the spacing scale, the motion curve family, the citation-popover pattern, the type
floor.

Contributes back: the continuous-versus-discrete motion rule (§6.1), now proven in two
apps.

Departs in one place: this app runs on a dark ground where most of the family runs light.
The reason is in §0 — the artefact owns pure white, so the interface cannot. Document the
departure rather than letting it drift into a house default.
