import { TEMPLATE_TAGS, meaningFor } from './dictionary';

export interface TlvNode {
  tag: string;
  length: number;
  value: string;
  /** Index in the raw payload string where this node's tag begins. */
  start: number;
  /** Index one past this node's value. */
  end: number;
  children: TlvNode[] | null;
  meaning: string | null;
  /** The dotted path of tags from the root, e.g. "26.01". */
  path: string;
  depth: number;
}

export interface TlvParse {
  nodes: TlvNode[];
  /** Index where parsing gave up, or null if the payload parsed to its end. */
  failedAt: number | null;
  failure: string | null;
}

/**
 * Parse EMVCo tag-length-value.
 *
 * Deliberately forgiving (CLAUDE.md §8): a malformed payload still yields
 * every node that parsed, plus the index and reason it stopped. Users learn
 * more from a broken payload that explains itself than from an error message.
 */
export function parseTlvDetailed(payload: string, path = '', depth = 0, offset = 0): TlvParse {
  const nodes: TlvNode[] = [];
  let at = 0;

  while (at < payload.length) {
    if (payload.length - at < 4) {
      return {
        nodes,
        failedAt: offset + at,
        failure: `sisa ${payload.length - at} karakter, terlalu pendek untuk tag dan panjang`,
      };
    }

    const tag = payload.slice(at, at + 2);
    const lengthText = payload.slice(at + 2, at + 4);

    if (!/^\d{2}$/.test(lengthText)) {
      return {
        nodes,
        failedAt: offset + at + 2,
        failure: `panjang "${lengthText}" bukan dua digit`,
      };
    }

    const length = Number(lengthText);
    const valueStart = at + 4;
    const valueEnd = valueStart + length;

    if (valueEnd > payload.length) {
      return {
        nodes,
        failedAt: offset + valueStart,
        failure: `tag ${tag} menyatakan panjang ${length}, hanya tersedia ${payload.length - valueStart}`,
      };
    }

    const value = payload.slice(valueStart, valueEnd);
    const nodePath = path ? `${path}.${tag}` : tag;
    const node: TlvNode = {
      tag,
      length,
      value,
      start: offset + at,
      end: offset + valueEnd,
      children: null,
      meaning: meaningFor(nodePath),
      path: nodePath,
      depth,
    };

    if (isTemplate(tag, depth)) {
      const inner = parseTlvDetailed(value, nodePath, depth + 1, offset + valueStart);
      // A template whose contents do not parse is kept as a leaf rather than
      // discarded, so the raw value stays visible.
      node.children = inner.failedAt === null || inner.nodes.length > 0 ? inner.nodes : [];
    }

    nodes.push(node);
    at = valueEnd;
  }

  return { nodes, failedAt: null, failure: null };
}

/** The signature CLAUDE.md §8 names. */
export function parseTlv(payload: string): TlvNode[] {
  return parseTlvDetailed(payload).nodes;
}

/**
 * Templates that nest: merchant account information (26-51), additional data
 * field (62), merchant information language (64), and the unreserved range
 * (80-99). Everything else is a leaf.
 */
export function isTemplate(tag: string, depth: number): boolean {
  if (depth > 0) return false;
  return TEMPLATE_TAGS.some(([lo, hi]) => tag >= lo && tag <= hi);
}

/** Walk a parsed tree depth-first, root nodes first. */
export function walk(nodes: TlvNode[], visit: (node: TlvNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.children) walk(node.children, visit);
  }
}

export function flatten(nodes: TlvNode[]): TlvNode[] {
  const out: TlvNode[] = [];
  walk(nodes, (n) => out.push(n));
  return out;
}

/** Serialise a tree back to its payload string. Round-trips a valid parse. */
export function serialiseTlv(nodes: TlvNode[]): string {
  return nodes
    .map((n) => {
      const value = n.children && n.children.length > 0 ? serialiseTlv(n.children) : n.value;
      return n.tag + String(value.length).padStart(2, '0') + value;
    })
    .join('');
}
