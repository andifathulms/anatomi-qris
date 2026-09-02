import { describe, it, expect } from 'vitest';
import { crc16Hex, validateCrc } from '../src/qris/crc16';
import { flatten, parseTlvDetailed, serialiseTlv } from '../src/qris/tlv';
import { inspectQris, detectQris, findNode, qrisAccountTemplate } from '../src/qris/detect';
import { glossFor, meaningFor } from '../src/qris/dictionary';
import { SAMPLES } from '../samples/index';

const QRIS = SAMPLES.filter((s) => s.id.startsWith('qris'));

describe('CRC16', () => {
  it('matches the CCITT-FALSE check value', () => {
    expect(crc16Hex('123456789')).toBe('29B1');
  });

  it('validates every bundled QRIS payload', () => {
    for (const sample of QRIS) {
      const check = validateCrc(sample.payload);
      expect(check.ok, `${sample.id}: expected ${check.expected}, found ${check.found}`).toBe(true);
    }
  });

  it('reports the mismatch plainly rather than throwing', () => {
    const broken = QRIS[0].payload.slice(0, -4) + 'ABCD';
    const check = validateCrc(broken);
    expect(check.ok).toBe(false);
    expect(check.found).toBe('ABCD');
    expect(check.expected).toHaveLength(4);
    expect(check.expected).not.toBe('ABCD');
  });
});

describe('TLV parsing', () => {
  it('round-trips every bundled QRIS payload', () => {
    for (const sample of QRIS) {
      const { nodes, failedAt } = parseTlvDetailed(sample.payload);
      expect(failedAt, sample.id).toBeNull();
      expect(serialiseTlv(nodes)).toBe(sample.payload);
    }
  });

  it('records each node position in the raw string', () => {
    for (const sample of QRIS) {
      for (const node of flatten(parseTlvDetailed(sample.payload).nodes)) {
        expect(sample.payload.slice(node.start, node.start + 2)).toBe(node.tag);
        expect(sample.payload.slice(node.end - node.length, node.end)).toBe(node.value);
        expect(node.end - node.start).toBe(node.length + 4);
      }
    }
  });

  it('nests the templates that nest and leaves the rest alone', () => {
    const { nodes } = parseTlvDetailed(QRIS[0].payload);
    const byTag = new Map(nodes.map((n) => [n.tag, n]));
    expect(byTag.get('26')?.children?.length).toBeGreaterThan(0);
    expect(byTag.get('51')?.children?.length).toBeGreaterThan(0);
    expect(byTag.get('59')?.children).toBeNull();
    expect(byTag.get('63')?.children).toBeNull();
  });

  it('parses as far as it can and marks where it stopped', () => {
    const truncated = QRIS[0].payload.slice(0, 40);
    const { nodes, failedAt, failure } = parseTlvDetailed(truncated);
    expect(nodes.length).toBeGreaterThan(0);
    expect(failedAt).not.toBeNull();
    expect(failure).toBeTruthy();
    expect(failedAt!).toBeLessThanOrEqual(truncated.length);
  });

  it('refuses a non-numeric length without losing what came before', () => {
    const { nodes, failedAt, failure } = parseTlvDetailed('000201010211' + '52XX' + '5303360');
    expect(nodes.map((n) => n.tag)).toEqual(['00', '01']);
    expect(failedAt).toBe(14);
    expect(failure).toContain('XX');
  });
});

describe('QRIS detection', () => {
  it('activates on the QRIS samples and on nothing else', () => {
    for (const sample of SAMPLES) {
      expect(detectQris(sample.payload), sample.id).toBe(sample.id.startsWith('qris'));
    }
    expect(detectQris('halo')).toBe(false);
    expect(detectQris('')).toBe(false);
    expect(detectQris('https://example.com')).toBe(false);
  });

  it('stays active when the checksum fails', () => {
    const broken = QRIS[0].payload.slice(0, -4) + '0000';
    const result = inspectQris(broken);
    expect(result.isQris).toBe(true);
    expect(result.crcOk).toBe(false);
    expect(result.foundCrc).toBe('0000');
  });

  it('finds the QRIS national account template', () => {
    for (const sample of QRIS) {
      const { nodes } = parseTlvDetailed(sample.payload);
      const template = qrisAccountTemplate(nodes);
      expect(template, sample.id).not.toBeNull();
      expect(findNode(nodes, `${template!.tag}.00`)?.value).toBe('ID.CO.QRIS.WWW');
    }
  });
});

describe('the dictionary', () => {
  it('names every tag in the bundled payloads', () => {
    for (const sample of QRIS) {
      for (const node of flatten(parseTlvDetailed(sample.payload).nodes)) {
        expect(node.meaning, `${sample.id} tag ${node.path}`).toBeTruthy();
      }
    }
  });

  it('reads codes as words', () => {
    expect(meaningFor('59')).toBe('Nama merchant');
    expect(meaningFor('26.01')).toBe('Pengenal merchant pada acquirer');
    expect(glossFor('52', '5812')).toBe('Restoran');
    expect(glossFor('53', '360')).toContain('rupiah');
    expect(glossFor('58', 'ID')).toBe('Indonesia');
    expect(glossFor('01', '11')).toContain('Statis');
    expect(glossFor('51.00', 'ID.CO.QRIS.WWW')).toContain('QRIS nasional');
    expect(glossFor('51.03', 'UMI')).toBe('Usaha mikro');
  });

  it('returns null rather than inventing a meaning', () => {
    expect(glossFor('52', '1234')).toBeNull();
    expect(meaningFor('63.01')).toBeNull();
  });
});
