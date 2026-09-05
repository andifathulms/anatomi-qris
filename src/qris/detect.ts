import { validateCrc } from './crc16';
import { parseTlvDetailed, type TlvNode } from './tlv';

export interface QrisDetection {
  /** True when the payload is EMVCo Merchant-Presented Mode. */
  isQris: boolean;
  /** True when tag 63 validates. A QRIS with a bad CRC is still a QRIS. */
  crcOk: boolean;
  expectedCrc: string;
  foundCrc: string;
  nodes: TlvNode[];
  failedAt: number | null;
  failure: string | null;
}

/**
 * Detection is structural, not heuristic (PRD §2): the payload opens with
 * "000201" — payload format indicator, length 2, value 01 — and ends with a
 * tag 63 checksum. The lens activates on the structure; a failing checksum is
 * reported rather than used to reject the payload, because seeing why a
 * payload is malformed is the useful part.
 */
export function detectQris(payload: string): boolean {
  return inspectQris(payload).isQris;
}

export function inspectQris(payload: string): QrisDetection {
  const parse = parseTlvDetailed(payload);
  const crc = validateCrc(payload);
  const opensCorrectly = payload.startsWith('000201');
  const hasChecksum = crc.at >= 0;

  return {
    isQris: opensCorrectly && hasChecksum && parse.nodes.length > 1,
    crcOk: crc.ok,
    expectedCrc: crc.expected,
    foundCrc: crc.found,
    nodes: parse.nodes,
    failedAt: parse.failedAt,
    failure: parse.failure,
  };
}

/** Find a node by its dotted tag path, e.g. "26.01". */
export function findNode(nodes: TlvNode[], path: string): TlvNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const hit = findNode(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

/** The merchant account template that names the QRIS national identifier. */
export function qrisAccountTemplate(nodes: TlvNode[]): TlvNode | null {
  for (const node of nodes) {
    if (node.tag < '26' || node.tag > '51' || !node.children) continue;
    const gui = node.children.find((c) => c.tag === '00');
    if (gui && gui.value.toUpperCase() === 'ID.CO.QRIS.WWW') return node;
  }
  return null;
}

/**
 * The deepest node whose span covers a character index, or null when the index
 * falls between fields. Depth matters: index 40 of a QRIS sits inside both the
 * merchant account template and one sub-tag of it, and the sub-tag is the
 * answer a reader wants.
 */
export function nodeAt(nodes: TlvNode[], index: number): TlvNode | null {
  for (const node of nodes) {
    if (index < node.start || index >= node.end) continue;
    if (node.children) {
      const deeper = nodeAt(node.children, index);
      if (deeper) return deeper;
    }
    return node;
  }
  return null;
}

/**
 * The distinct fields a set of payload character indices touches, in payload
 * order. Used to say which fields a damaged codeword was carrying.
 */
export function nodesCovering(nodes: TlvNode[], indices: Iterable<number>): TlvNode[] {
  const byPath = new Map<string, TlvNode>();
  for (const index of indices) {
    const node = nodeAt(nodes, index);
    if (node) byPath.set(node.path, node);
  }
  return [...byPath.values()].sort((a, b) => a.start - b.start);
}
