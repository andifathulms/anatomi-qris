import { rsEncode, type DivisionStep } from './reed-solomon';
import { blockSpec, type EcLevel } from './tables';

export interface CodeBlock {
  index: number;
  data: Uint8Array;
  ecc: Uint8Array;
}

/** Where one codeword of the final interleaved stream came from. */
export interface InterleaveSource {
  block: number;
  kind: 'data' | 'ecc';
  offset: number;
}

export interface BlockPlan {
  blocks: CodeBlock[];
  interleaved: Uint8Array;
  sources: InterleaveSource[];
  eccPerBlock: number;
  /** Division trace for the block named by `tracedBlock`. */
  divisionTrace: DivisionStep[];
  tracedBlock: number;
}

/**
 * Split the data codewords into the version's blocks, Reed-Solomon each one,
 * then deal the results out column-wise. The column-wise read is the whole
 * reason a coffee stain is survivable: neighbouring modules carry codewords
 * from different blocks, so local damage is spread thin across many
 * separately correctable units.
 */
export function buildBlocks(
  dataCodewords: Uint8Array,
  version: number,
  ecLevel: EcLevel,
  tracedBlock = 0,
): BlockPlan {
  const spec = blockSpec(version, ecLevel);
  const blocks: CodeBlock[] = [];
  let offset = 0;
  let divisionTrace: DivisionStep[] = [];

  const push = (count: number, size: number) => {
    for (let i = 0; i < count; i++) {
      const index = blocks.length;
      const data = dataCodewords.subarray(offset, offset + size);
      offset += size;
      const wantTrace = index === tracedBlock;
      const { ecc, trace } = rsEncode(data, spec.eccPerBlock, wantTrace);
      if (wantTrace) divisionTrace = trace;
      blocks.push({ index, data: data.slice(), ecc });
    }
  };

  push(spec.group1Blocks, spec.group1DataCodewords);
  push(spec.group2Blocks, spec.group2DataCodewords);

  const total = dataCodewords.length + spec.eccPerBlock * blocks.length;
  const interleaved = new Uint8Array(total);
  const sources: InterleaveSource[] = new Array(total);
  let out = 0;

  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let col = 0; col < maxData; col++) {
    for (const block of blocks) {
      if (col < block.data.length) {
        interleaved[out] = block.data[col];
        sources[out] = { block: block.index, kind: 'data', offset: col };
        out++;
      }
    }
  }
  for (let col = 0; col < spec.eccPerBlock; col++) {
    for (const block of blocks) {
      interleaved[out] = block.ecc[col];
      sources[out] = { block: block.index, kind: 'ecc', offset: col };
      out++;
    }
  }

  return {
    blocks,
    interleaved,
    sources,
    eccPerBlock: spec.eccPerBlock,
    divisionTrace,
    tracedBlock,
  };
}

/** The inverse deal, used by the decoder to rebuild correctable blocks. */
export function deinterleave(
  stream: Uint8Array,
  version: number,
  ecLevel: EcLevel,
): { blocks: Uint8Array[]; eccPerBlock: number; dataLengths: number[] } {
  const spec = blockSpec(version, ecLevel);
  const dataLengths: number[] = [];
  for (let i = 0; i < spec.group1Blocks; i++) dataLengths.push(spec.group1DataCodewords);
  for (let i = 0; i < spec.group2Blocks; i++) dataLengths.push(spec.group2DataCodewords);

  const data: number[][] = dataLengths.map(() => []);
  const ecc: number[][] = dataLengths.map(() => []);
  let at = 0;

  const maxData = Math.max(...dataLengths);
  for (let col = 0; col < maxData; col++) {
    for (let b = 0; b < dataLengths.length; b++) {
      if (col < dataLengths[b]) data[b].push(stream[at++]);
    }
  }
  for (let col = 0; col < spec.eccPerBlock; col++) {
    for (let b = 0; b < dataLengths.length; b++) ecc[b].push(stream[at++]);
  }

  return {
    blocks: data.map((d, i) => Uint8Array.from([...d, ...ecc[i]])),
    eccPerBlock: spec.eccPerBlock,
    dataLengths,
  };
}

/**
 * Index in the interleaved stream of a given block codeword — the inverse of
 * `sources`, needed to map a corrupt block position back to modules.
 */
export function interleavedIndex(
  plan: Pick<BlockPlan, 'sources'>,
  block: number,
  kind: 'data' | 'ecc',
  offset: number,
): number {
  return plan.sources.findIndex(
    (s) => s.block === block && s.kind === kind && s.offset === offset,
  );
}
