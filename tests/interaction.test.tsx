import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../src/App';
import { SAMPLES } from '../samples/index';

/**
 * Walk the whole app the way a user does. jsdom has no layout, so this asserts
 * on content and state rather than geometry; its job is to make a runtime error
 * in any view fail the suite instead of the browser.
 */
describe('working through the app', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // The store serialises typed text to the URL and reads it back on mount,
    // so each test starts from a clean address rather than the previous one's.
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<App />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const click = (el: Element | null | undefined) => {
    expect(el, 'element to click').toBeTruthy();
    act(() => {
      (el as HTMLElement).click();
    });
  };

  const gotoStage = (stage: number) => {
    const stations = container.querySelectorAll('.scrubber__station');
    expect(stations).toHaveLength(9);
    click(stations[stage - 1]);
  };

  it('renders every stage without throwing', () => {
    for (let stage = 1; stage <= 9; stage++) {
      gotoStage(stage);
      expect(container.querySelector('.shell__panel')?.textContent?.length ?? 0).toBeGreaterThan(10);
      // The matrix is present and unchanged in size at every stage.
      expect(container.querySelector('.matrix__svg')).not.toBeNull();
    }
  });

  it('keeps the matrix mounted across stage changes', () => {
    const before = container.querySelector('.matrix__svg');
    gotoStage(6);
    gotoStage(2);
    gotoStage(9);
    expect(container.querySelector('.matrix__svg')).toBe(before);
  });

  it('binds a bitstream selection to the matrix', () => {
    gotoStage(3);
    const codeword = container.querySelector('.bitstream__codeword');
    click(codeword);
    expect(codeword?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the TLV tree for a QRIS payload and highlights a node', () => {
    const rows = container.querySelectorAll('.tlv__row');
    expect(rows.length).toBeGreaterThan(5);

    click(rows[0].querySelector('.tlv__button'));
    expect(container.querySelector('.tlv__row[data-selected]')).not.toBeNull();
    expect(container.querySelector('.tlv__mark')?.textContent).toBe('000201');
    expect(container.textContent).toContain('modul disorot');
  });

  it('hides the tree for a payload that is not QRIS', () => {
    const input = container.querySelector<HTMLInputElement>('#payload')!;
    act(() => {
      setValue(input, 'halo dunia');
    });
    expect(container.querySelector('.tlv')).toBeNull();
    expect(container.querySelector('.matrix__svg')).not.toBeNull();
  });

  it('scores all eight masks and marks exactly one winner', () => {
    gotoStage(7);
    const cards = container.querySelectorAll('.mask-card');
    expect(cards).toHaveLength(8);
    expect(container.querySelectorAll('.mask-card__marker[data-filled]')).toHaveLength(1);

    click(cards[3]);
    expect(cards[3].getAttribute('aria-pressed')).toBe('true');
  });

  it('reports damage and recovery in the lab', () => {
    gotoStage(9);
    expect(container.textContent).toContain('Belum ada kerusakan');

    const noise = container.querySelector<HTMLInputElement>('.damage__slider input')!;
    act(() => {
      setValue(noise, '0.01');
    });
    const meter = container.querySelector('.damage__meter-head')!.textContent ?? '';
    expect(meter).not.toContain('0 /');

    // Push well past capacity and the correction must visibly fail.
    act(() => {
      setValue(noise, '0.5');
    });
    expect(container.querySelector('.damage__failed')).not.toBeNull();
    expect(container.querySelector('.damage__meter-fill[data-over]')).not.toBeNull();
  });

  it('switches locale without losing the payload', () => {
    const input = container.querySelector<HTMLInputElement>('#payload')!;
    expect(input.value).toBe(SAMPLES[0].payload);
    click(container.querySelector('.shell__header-right .button'));
    expect(container.textContent).toContain('Everything runs on this device');
    expect(container.querySelector<HTMLInputElement>('#payload')!.value).toBe(SAMPLES[0].payload);
  });

  it('says so when the payload does not fit at the chosen level', () => {
    const input = container.querySelector<HTMLInputElement>('#payload')!;
    act(() => {
      setValue(input, SAMPLES[1].payload);
    });
    const levels = container.querySelectorAll('.toggle__button');
    // The EC toggle is the first in the input bar: L, M, Q, H.
    const h = [...levels].find((b) => b.textContent === 'H');
    click(h);
    expect(container.querySelector('.input-bar__error')?.textContent).toContain('Terlalu panjang');
  });

  it('opens and dismisses a spec citation', () => {
    gotoStage(7);
    const marker = container.querySelector('.cite__marker')!;
    click(marker);
    expect(container.querySelector('.cite__popover')?.textContent).toContain('ISO/IEC 18004');
    click(marker);
    expect(container.querySelector('.cite__popover')).toBeNull();
  });
});

/** Set a controlled input's value the way React's own event plumbing expects. */
function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
