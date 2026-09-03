/**
 * The mark: a QR finder pattern at the real 1:1:3:1:1 module ratio, with the
 * 5×5 alignment pattern beside it — the part under inspection — in the brand's
 * cursor magenta.
 *
 * Drawn rather than loaded, so the page still makes no network request, and
 * with no tile: the brand's paper ground would be a white chip floating in a
 * dark instrument. On the app's own ground the finder takes the ink colour and
 * follows the theme, which is what the clear-space rule wants anyway.
 *
 * Geometry is transcribed from exports/svg/aq-icon-default.svg and must not be
 * redrawn by eye. The mark is never rotated, never rounded, and the magenta
 * never spreads past the alignment pattern.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="15" y="15" width="52" height="52" stroke="currentColor" strokeWidth="7.4" />
      <rect x="33.8" y="33.8" width="14.4" height="14.4" fill="currentColor" />
      <rect
        x="68"
        y="68"
        width="22"
        height="22"
        stroke="var(--brand-magenta)"
        strokeWidth="4.8"
      />
      <rect x="76.4" y="76.4" width="5.2" height="5.2" fill="var(--brand-magenta)" />
    </svg>
  );
}
