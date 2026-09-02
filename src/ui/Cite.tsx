import { useEffect, useId, useRef, useState } from 'react';
import { useCopy } from '../copy';
import './cite.css';

export type CiteSource = 'iso' | 'emvco';

export interface Citation {
  source: CiteSource;
  clause: string;
  /**
   * A one-sentence paraphrase in our own words. The specifications are not
   * freely redistributable, so this names where to look and what is there
   * rather than reproducing their text.
   */
  summary: string;
}

/**
 * A spec citation, in the same shape as the pasal citations in Suara ke Kursi:
 * an inline marker opening a dismissible popover.
 */
export function Cite({ citation }: { citation: Citation }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [open]);

  const label = citation.source === 'iso' ? t('cite.iso') : t('cite.emvco');

  return (
    <span className="cite" ref={wrapper}>
      <button
        type="button"
        className="cite__marker"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {t('cite.open')}
      </button>
      {open && (
        <span className="cite__popover" id={id} role="note">
          <span className="cite__source">{label} §{citation.clause}</span>
          <span className="cite__summary">{citation.summary}</span>
          <button type="button" className="cite__close button" onClick={() => setOpen(false)}>
            {t('cite.close')}
          </button>
        </span>
      )}
    </span>
  );
}

/** Where each stage's rule actually lives in the specifications. */
export const CITATIONS: Record<string, Citation> = {
  mode: {
    source: 'iso',
    clause: '7.4',
    summary:
      'Mode indicators and character count widths, including the boundary at version 10 where the byte-mode count grows from 8 bits to 16.',
  },
  padding: {
    source: 'iso',
    clause: '7.4.9',
    summary:
      'The terminator, the pad to the byte boundary, and the alternating 11101100 / 00010001 pad bytes that fill the remaining capacity.',
  },
  errorCorrection: {
    source: 'iso',
    clause: '7.5',
    summary:
      'Error-correction codewords are the remainder of dividing the data codeword polynomial by a generator polynomial over GF(256).',
  },
  interleave: {
    source: 'iso',
    clause: '7.6',
    summary:
      'Blocks are interleaved codeword by codeword so that a burst of damage is spread across several separately correctable blocks.',
  },
  placement: {
    source: 'iso',
    clause: '7.7.3',
    summary:
      'The symbol character placement: two-module-wide columns from the right, alternating upward and downward, skipping the vertical timing column.',
  },
  mask: {
    source: 'iso',
    clause: '7.8',
    summary:
      'The eight data mask patterns, and the four penalty rules whose lowest total selects the mask that is used.',
  },
  format: {
    source: 'iso',
    clause: '7.9',
    summary:
      'Format information is BCH(15,5) over the EC level and mask reference, masked with 101010000010010 and written twice.',
  },
  emvco: {
    source: 'emvco',
    clause: '4',
    summary:
      'The tag-length-value structure of a merchant-presented payload, including which tags are templates that nest and which are leaves.',
  },
  crc: {
    source: 'emvco',
    clause: '4.7.5',
    summary:
      'Tag 63 carries a CRC computed over the whole payload up to and including the "6304" header of the tag itself.',
  },
};
