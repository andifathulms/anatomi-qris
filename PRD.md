# Anatomi QRIS — Product Requirements

**Working name:** Anatomi QRIS
**English descriptor:** How a QR code is built, and what a QRIS payload says
**Type:** Static single-page application. No backend, no API, no network calls at runtime.
**Deploy target:** GitHub Pages.

> Naming note. This is a deliberate sibling to Anatomi Rupiah: two things Indonesians
> handle every day, opened up and labelled. Keep the pairing. Do not rename to an
> evocative single word.

---

## 1. What this is

Two questions, one engine.

**Question one, universal:** how does a string of text become a grid of black squares?
Almost everyone has scanned tens of thousands of QR codes and nobody has seen one built.

**Question two, local:** what is actually inside the QRIS sticker on the counter? It is
not an opaque token. It is a plainly structured string that names the merchant, the
acquirer, the category of business, the currency, and a checksum — and every Indonesian
scans one several times a week without knowing that.

The app answers both because they are the same object seen at two layers. The QR spec
governs how bytes become modules. The EMVCo spec governs what those bytes mean. Most QR
explainers stop at the first. Every QRIS parser stops at the second.

**The thing that makes this app worth building is the connection between them:** select
"merchant name" in the payload tree and the specific black squares encoding those bytes
light up in the matrix. That mapping is the product.

## 2. How both modes coexist

They are not two modes with a switch. There is one input field and one engine.

- The engine encodes **any** string. That is the playground.
- A **QRIS lens** activates automatically when the input parses as a valid EMVCo
  Merchant-Presented Mode payload. Detection is reliable: the string opens with `000201`
  and terminates with a CRC16 under tag 63 that validates.
- When the lens is active, an extra panel appears — the TLV tree — and the byte-to-module
  highlighting becomes semantic rather than positional.

Type "hello" and you get the full QR anatomy. Paste a QRIS and the same view gains a
layer. No mode selector, no landing page fork, no duplicated code path.

A sample chooser offers a QRIS payload, a URL, a Wi-Fi credential string, and a long
Indonesian sentence — enough to demonstrate different encoding modes and versions.

## 3. Scope

### In for v1

- QR encoding from scratch: numeric, alphanumeric, and byte modes; versions 1–15; all
  four error-correction levels.
- QR decoding and error correction from a damaged matrix.
- All eight mask patterns with the four penalty rules, scored and compared.
- EMVCo MPM payload parsing with the QRIS tag dictionary.
- The byte-to-module provenance map (§5) and everything it enables.
- A nine-stage construction pipeline, scrubbable (§6).

### Out for v1

- **Kanji mode.** Never appears in this context.
- **Versions 16–40.** QRIS payloads run roughly 150–350 characters and land comfortably
  under version 15. Larger versions add table bulk and render poorly at screen size.
- **Micro QR, rMQR, and other variants.**
- **Camera scanning.** The app never touches a camera. Users paste text or an image is
  not accepted at all — see §9.2.
- **Static-to-dynamic QRIS conversion.** Rewriting tag 01 and injecting an amount into an
  existing payload is a merchant tool, not an explainer. Several open-source libraries
  already do it. Keeping it out keeps the app's purpose unambiguous.
- **Logo embedding, styling, gradient QR.** This app renders codes as the spec defines
  them.

## 4. Audience

Two overlapping readers, and the design must serve both without a fork:

- A curious Indonesian who has scanned QRIS a thousand times and wants to know what is in
  it. No technical background assumed.
- A developer who wants to understand Reed-Solomon and mask selection properly. Needs the
  arithmetic visible and checkable.

The first reader must be able to get value in ten seconds without reading anything. The
second must be able to verify every number.

## 5. The provenance map — the architectural centre

The engine does not just produce a matrix. It produces a matrix **plus a complete record
of what caused every module to be the colour it is.**

For each module coordinate, the record identifies its role:

- function pattern (finder / separator / timing / alignment / dark module)
- format information bit *n*
- version information bit *n*
- data codeword *c*, bit *b*
- error-correction codeword *c*, bit *b*
- remainder bit
- and, independently, whether the mask flipped it

And the inverse: for each codeword, the ordered list of module coordinates carrying it.

Every feature in this app reads from that one structure:

- Highlighting a payload field → its byte range → its codewords → its modules.
- Damage attribution → which modules were hit → which codewords are corrupt.
- The zigzag animation → the placement order is the map's construction order.
- The mask comparison → the mask layer is separable from the data layer.

If the provenance map is right, the visualizations are nearly free. If it is an
afterthought, every view has to recompute geometry and they will drift apart. Build it
first.

## 6. The pipeline — the app's spine

The page is not a scroll of sections. It is one matrix with a **stage scrubber**
underneath it. Scrubbing moves the matrix through the nine stages of its own
construction.

| # | Stage | What the matrix shows |
|---|---|---|
| 1 | Input | Nothing yet; the text, and the mode/version/EC decision being made |
| 2 | Encode | The bitstream: mode indicator, character count, payload bits, terminator, pad bytes |
| 3 | Codewords | The bitstream grouped into 8-bit codewords |
| 4 | Error correction | Reed-Solomon division producing EC codewords |
| 5 | Interleave | Blocks dealt out and read back column-wise |
| 6 | Place | The zigzag walk filling the matrix |
| 7 | Mask | Eight candidates scored on four penalty rules |
| 8 | Final | Format and version info written; the finished code |
| 9 | Damage | The error-correction lab |

Stages 1–8 are the construction. Stage 9 is the payoff. The QRIS lens, when active, is
present at every stage as a side panel, because the payload's meaning does not change as
the encoding proceeds — only its representation does.

## 7. The instruments

Full visual and motion specification is in DESIGN.md. What each must do:

### 7.1 The matrix (constant, central)

Always on screen, always the same size and position, regardless of stage. This is what
makes the pipeline read as one object being transformed rather than a series of
illustrations.

Two rendering states, toggleable and animated between:

- **As printed** — true black and true white, no tint, exactly as a scanner sees it.
- **Anatomy** — module roles tinted, with the light/dark reading preserved underneath so
  the code is still visibly a code (DESIGN.md §2.3).

### 7.2 The bitstream

A horizontal ribbon of bits, grouped and regrouped as the pipeline advances: raw bits →
codewords → interleaved stream. Selecting any run of bits highlights its modules; selecting
modules highlights its bits. The binding is bidirectional and instant.

### 7.3 The Reed-Solomon division

Polynomial long division over GF(256), stepped term by term, with the generator polynomial
shown and each XOR-and-shift visible. The user must be able to check one step by hand.

This is the app's credibility. It is the same instinct as the trace views in Rinci and the
Myers Visualizer: the display renders the computation's own record rather than a
re-enactment of it.

### 7.4 The interleave

Data blocks laid out as rows, then read column-wise into the final stream. This is the
explanation for why QR survives a coffee stain — adjacent modules in the picture come from
different blocks, so localized damage spreads thinly across many separately correctable
units. The animation is the argument; do not explain it in a paragraph instead.

### 7.5 The mask gallery

Eight candidate matrices as small multiples. Each shows its penalty score broken into the
four rules, with the offending features highlighted **on that matrix**: same-colour runs of
five or more, 2×2 blocks of one colour, the 1:1:3:1:1 pattern that mimics a finder, and
the dark/light imbalance. The winner is selected in view.

Nobody visualizes mask selection. This is one of the app's two novel views.

### 7.6 The QRIS payload tree

TLV structure as a nested tree: tag, length, value, with the QRIS dictionary supplying
each tag's meaning. Every node states its position in the raw string.

Hovering or selecting a node highlights the corresponding modules in the matrix. This is
the other novel view and it is the reason this app exists rather than being the fifth
Reed-Solomon demo on the internet.

The tree must also show the raw string with the selected node's characters marked, so
users can see the payload as both structure and text.

### 7.7 The damage lab

A brush the user drags across the matrix, plus a slider for random noise density.

Live readout: modules damaged, codewords corrupted, correction capacity used, capacity
remaining. Syndromes computed, error positions located, corrected modules snapping back to
their true values.

Push past capacity and it fails — visibly, with the failure explained. That boundary is
the emotional payoff of the whole app, and it must be reachable in one gesture.

## 8. Correctness

### 8.1 The oracle

The engine is validated against independent implementations, as test-only dependencies
never shipped to the browser:

1. Encode a corpus of strings with our engine and with `qrcode`; assert the module
   matrices are byte-identical across all supported versions, EC levels, and modes.
2. Decode our own output with `jsQR`; assert round-trip fidelity.
3. Decode damaged matrices with our decoder; assert recovery up to capacity and
   documented failure beyond it.

The corpus must include: every QRIS sample in the app, empty-adjacent inputs, strings that
sit exactly on a version boundary, strings that force a mode switch, and non-ASCII
Indonesian text.

**If our engine and the reference disagree, our engine is wrong.** Fix ours.

### 8.2 Table generation over table transcription

Hardcode as little as possible. Format information is BCH(15,5) and version information is
BCH(18,6) — compute them rather than copying 68 bit strings. Alignment pattern coordinates
follow a documented rule. Only the version-and-EC capacity table genuinely needs to be
transcribed, and the oracle catches any error in it immediately.

### 8.3 CRC

The QRIS parser validates the tag 63 checksum using CRC16 with the 0x1021 polynomial. A
payload with a bad CRC is displayed with the failure stated plainly and the tree still
rendered, because seeing why a payload is malformed is useful.

## 9. Commitments

### 9.1 Nothing leaves the device

No network requests at runtime. No analytics. No error reporting. Fonts self-hosted.
People will paste real payment QRIS payloads into this; the app must be trivially
verifiable as offline, and should say so in one line where the input is.

The merchant data inside a QRIS is printed publicly on a sticker in a shop, so this is not
a secrecy problem. It is a trust problem, and the fix is architectural rather than a
privacy policy.

### 9.2 The app explains, it does not forge

The app decodes and explains any payload. It generates QR codes only from what the user
types or from bundled examples. It does not offer to rewrite an existing payload —
no amount injection, no tag rewriting, no static-to-dynamic conversion.

This is a scope decision more than a safety one: routing depends on a merchant registered
with a real acquirer, so payload manipulation buys an attacker nothing. But an anatomy
explainer that also ships a payload editor is a confused product, and the confusion is the
part worth avoiding.

### 9.3 The arithmetic is checkable

Every computed value in the app is reachable in its raw form. Bits as bits, codewords as
hex, the GF(256) division as steps. A user who wants to verify one Reed-Solomon term by
hand must be able to.

### 9.4 It is not a QR generator

There is no download button for a styled QR code, no logo upload, no colour picker. Those
apps exist by the thousand. This one shows how the thing works.

## 10. Acceptance criteria

1. Oracle agreement: byte-identical matrices against `qrcode` across the full supported
   matrix of versions, EC levels, and modes. Runs in CI, blocks deploy.
2. Round-trip: every generated code decodes correctly with `jsQR` and with our own decoder.
3. Damage recovery: correct recovery at 100% of stated capacity, documented failure at
   101%, across all four EC levels.
4. Selecting any TLV node highlights exactly the modules carrying those bytes, verified by
   a test that decodes only the highlighted codewords.
5. The stage scrubber moves through all nine stages at 60 fps with no recomputation stall.
6. `prefers-reduced-motion` honoured: all animation becomes instant state, the zigzag
   becomes steppable.
7. Fully keyboard operable, including the matrix (arrow-key module navigation with a
   readout of that module's provenance).
8. Zero runtime network requests, verifiable in devtools with an empty network tab.
9. Bundle under 250 KB gzipped.
10. Legible and usable at 380 px. The matrix stays the hero on a phone.
