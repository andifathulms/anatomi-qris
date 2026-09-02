import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { SAMPLES } from '../samples/index';

/**
 * A smoke test that the shell mounts and paints. It does not assert on layout;
 * it exists so a runtime error in the matrix painter or the state wiring fails
 * the suite rather than the browser.
 */
describe('the shell', () => {
  let container: HTMLDivElement;

  beforeAll(() => {
    // jsdom has no layout, so getBoundingClientRect returns zeroes; the matrix
    // only uses it for pointer hit-testing, which this test does not exercise.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('mounts with the first sample and renders the matrix', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });

    const svg = container.querySelector('.matrix__svg');
    expect(svg).not.toBeNull();

    // Version 8 at level M for the warung sample: 49 x 49 modules.
    const rects = svg!.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(21 * 21);

    expect(container.textContent).toContain('Anatomi QRIS');
    expect(container.textContent).toContain('Tidak ada data yang dikirim');

    const input = container.querySelector<HTMLInputElement>('#payload');
    expect(input?.value).toBe(SAMPLES[0].payload);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
