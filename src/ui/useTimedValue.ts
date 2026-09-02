import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animate a number towards a target over a fixed duration — the "discrete
 * control, timed transition" half of DESIGN.md §6.1. Continuous controls (the
 * stage scrubber, the damage slider) must not use this; they map the pointer
 * directly with zero easing.
 *
 * Under prefers-reduced-motion the transition becomes an immediate write.
 */
export function useTimedValue(
  target: number,
  duration: number,
  ease: (t: number) => number = easeEmphasis,
): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    if (duration <= 0 || prefersReducedMotion()) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    if (origin === target) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = origin + (target - origin) * ease(t);
      from.current = next;
      setValue(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, ease]);

  return value;
}

/** cubic-bezier(.32,.72,0,1) — the emphasis curve, approximated. */
export function easeEmphasis(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** cubic-bezier(.4,0,.2,1) — the standard curve, approximated. */
export function easeStandard(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Read a duration token from CSS, so DESIGN.md §6.2 stays the one source. */
export function duration(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const ms = raw.endsWith('ms') ? Number(raw.slice(0, -2)) : Number(raw.slice(0, -1)) * 1000;
  return Number.isFinite(ms) ? ms : fallback;
}
