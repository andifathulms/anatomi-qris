# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two overlapping readers, served by one interface with no fork between them.

- **A curious Indonesian** who has scanned a QRIS sticker a thousand times and wants to
  know what is inside it. No technical background assumed. This reader must get value
  within about ten seconds, without reading anything first.
- **A developer** who wants to understand Reed-Solomon and mask selection properly. This
  reader must be able to verify every number the app shows, by hand if they want to.

The situation is unhurried and self-directed: someone arriving out of curiosity, on a
laptop or a phone, with no task to complete and no account. Nobody is here to produce an
artifact.

## Product Purpose

Anatomi QRIS answers two questions with one engine.

1. How does a string of text become a grid of black squares? Almost everyone has scanned
   tens of thousands of QR codes and nobody has seen one built.
2. What is actually inside the QRIS sticker on the counter? It is not an opaque token: it
   is a plainly structured string naming the merchant, the acquirer, the category of
   business, the currency, and a checksum.

Success is comprehension, not conversion or retention. A reader who leaves understanding
why a QR code survives a coffee stain, or what the merchant name looks like as modules,
got what the product exists to give.

## Positioning

The two questions are the same object at two layers: the QR specification governs how
bytes become modules, the EMVCo specification governs what those bytes mean. Most QR
explainers stop at the first. Every QRIS parser stops at the second.

The connection between them is the product. Select "merchant name" in the payload tree
and the specific black squares encoding those bytes light up in the matrix.

Two views in the app have no real precedent elsewhere: mask selection scored and compared
across all eight candidates with the offending features marked on each matrix, and the
TLV-node-to-module highlighting above.

## Operating Context

- One input field and one engine. There is no mode selector. The engine encodes any
  string; a **QRIS lens** activates automatically when the input parses as a valid EMVCo
  Merchant-Presented Mode payload, adding the TLV tree and making the highlighting
  semantic rather than positional.
- The page is not a scroll of sections. It is one matrix with a nine-stage scrubber:
  input, encode, codewords, error correction, interleave, place, mask, final, damage.
  Stages 1-8 are the construction, stage 9 is the payoff.
- People paste real payment payloads into this. The offline guarantee is architectural,
  stated where the input is, and load-bearing for trust.
- Indonesian first, English second. Terms of art with no settled Indonesian equivalent
  ("codeword", "interleave") stay in English and get a one-sentence gloss on first
  appearance.
- Deployed as a static single-page app on GitHub Pages at
  `andifathulms.github.io/anatomi-qris`. No backend, no API.

## Capabilities and Constraints

**In scope, built:** QR encoding written from scratch (numeric, alphanumeric and byte
modes; versions 1-15; all four EC levels); decoding and error correction from a damaged
matrix; all eight mask patterns with the four penalty rules; EMVCo MPM parsing with a
QRIS tag dictionary and MCC lookup; the byte-to-module provenance map; the nine-stage
scrubbable pipeline.

**Deliberately out, and staying out:** Kanji mode. Versions 16-40. Micro QR, rMQR and
other variants. Camera scanning. Static-to-dynamic QRIS conversion. Logo embedding,
styling, or gradient QR. Any download button for a styled code.

**Hard constraints:**

- The QR engine is written from scratch. `qrcode` and `jsqr` are test-only dependencies
  and a test fails if either is imported from `src/`.
- Zero runtime network requests. No analytics, no error reporting, fonts self-hosted. A
  devtools network tab must be empty after load, and a build-time check enforces it.
- The engine is pure: no React, no DOM, no randomness, no clock.
- The provenance map is the single source of geometry. No view recomputes it.
- Bundle under 250 KB gzipped on the first-load path.
- Usable at 380 px wide with no overflow; the matrix stays the hero on a phone.
- `encode()` for a version-15 symbol completes in under 8 ms, so typing recomputes on
  every keystroke with no debounce.

**Status:** shipped and live; the finishing pass (copy, keyboard, mobile, Lighthouse) is
not fully closed out. Scope stays as written above while that finishes.

## Brand Commitments

- **The name.** "Anatomi QRIS", with the English descriptor "How a QR code is built, and
  what a QRIS payload says". Not to be renamed to an evocative single word.
- **The family.** A deliberate sibling to **Anatomi Rupiah**, which is real and shipped.
  Naming, register and identity stay recognisably in the same family.
- **The mark.** A QR finder pattern drawn at the real 1:1:3:1:1 module ratio with a 5×5
  alignment pattern as the part under inspection. Binding.
- **Three hard rules, binding.** Never use a scannable QR code as the mark — it would get
  scanned, and it would imply a payment product. Never use the official QRIS logo, its
  colours, or any bank or wallet brand. Never imply the app accepts or processes
  payments; it reads codes.
- **Not binding:** the brand package's tagline ("Dibaca modul demi modul") and its
  paper/void/magenta palette are available material, not commitments. The app's own
  design tokens remain the visual authority and may override them.
- **Voice.** Precise and plain, Indonesian first. Uppercase never appears in the copy.
  Spec citations are inline markers opening a dismissible popover, citing ISO/IEC 18004
  for QR structure and the EMVCo Merchant-Presented Mode specification for payloads.
- **Authorship.** Designed and built by Andi Fathul Mukminin, credited in the footer.

## Evidence on Hand

- `samples/` — bundled example payloads, committed: a QRIS payload, a URL, a Wi-Fi
  credential string, and a long Indonesian sentence, chosen to exercise different modes
  and versions.
- `tests/` — the oracle (byte-identical agreement with `qrcode` across versions 1-15,
  all EC levels, all modes, both sides of every version boundary), `jsQR` round-trips,
  damage recovery at capacity and one codeword past it, and the provenance round trip.
  These are the product's credibility and they run in CI, blocking deploy.
- `PRD.md`, `DESIGN.md`, `CLAUDE.md` — product, visual and build authorities, all current.
- Brand assets: source package is gitignored at `exports/`; the files in use are
  committed at `public/brand/` (touch icon, social card) and `docs/brand/` (README
  imagery).
- **Absent, and not to be invented:** there are no users to quote, no traffic or usage
  numbers, no testimonials, no press, no customers, no benchmarks against other tools,
  and no screenshots of the running app in the repository.

## Product Principles

1. **The connection is the product.** Anything that strengthens the byte-to-module
   mapping earns its place; anything that only re-explains one layer in isolation does
   not.
2. **The arithmetic stays checkable.** Every computed value is reachable in its raw form,
   and the display renders the computation's own record rather than a re-enactment of it.
3. **The app explains; it does not forge.** It generates codes only from typed text or
   bundled samples, and offers no payload editing. This is a clarity decision before it
   is a safety one.
4. **Nothing leaves the device, verifiably.** The offline guarantee is enforced by the
   architecture and the build, not asserted by a policy page.
5. **Both readers, one interface.** No beginner mode, no expert mode. Depth is available
   without being in the way.

## Accessibility & Inclusion

- Fully keyboard operable, including the matrix: arrow-key module navigation with a
  readout of that module's provenance.
- `prefers-reduced-motion` honoured throughout; every animation becomes an immediate
  state change and the zigzag becomes steppable.
- Contrast floors hold in both themes: primary text ≥ 12:1 on its surface, secondary
  ≥ 7:1, soft ≥ 4.6:1. Focus is a 2 px marker outline at 2 px offset on every interactive
  element and is never removed.
- Nothing below 12 px. No layout shift when a readout, legend, or tree appears.
- Both a dark and a light theme, at the same contrast floors.
