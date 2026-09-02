import { buildBlocks, type BlockPlan, type CodeBlock } from './blocks';
import { applyMask, chooseMask, scoreMask, type MaskScore } from './mask';
import {
  MatrixCanvas,
  drawFormatInfo,
  drawFunctionPatterns,
  drawVersionInfo,
  placeCodewords,
  reserveInfoAreas,
  toModules,
} from './matrix';
import {
  buildByCodeword,
  buildByStreamIndex,
  buildSourceResolver,
  type CodewordKey,
  type ModuleInfo,
  type SourceResolver,
} from './provenance';
import { buildSegmentation, chooseMode, chooseVersion, type Segmentation } from './segments';
import {
  blockSpec,
  dataCodewordCount,
  eccCodewordCount,
  matrixSize,
  remainderBits,
  type EcLevel,
  type Mode,
} from './tables';
import type { DivisionStep } from './reed-solomon';

export interface EncodeOptions {
  ecLevel?: EcLevel;
  minVersion?: number;
  forceMask?: number;
  /** Which block the division trace is recorded for. Defaults to 0. */
  traceBlock?: number;
}

export interface Build {
  input: string;
  version: number;
  ecLevel: EcLevel;
  mode: Mode;
  size: number;

  bitstream: Uint8Array;
  bitLength: number;
  segmentation: Segmentation;

  dataCodewords: Uint8Array;
  eccCodewords: Uint8Array;
  interleaved: Uint8Array;

  blocks: CodeBlock[];
  blockPlan: BlockPlan;
  divisionTrace: DivisionStep[];
  maskScores: MaskScore[];
  maskGrids: Uint8Array[];
  chosenMask: number;
  forcedMask: boolean;

  modules: ModuleInfo[];
  byCodeword: Map<CodewordKey, Array<[number, number]>>;
  byStreamIndex: Map<number, Array<[number, number]>>;
  resolver: SourceResolver;
  byteToCodeword: (byteIndex: number) => number[];
  remainderBits: number;
}

/**
 * The whole pipeline, in the order the stage scrubber walks it. All eight mask
 * scores are computed every time, even though seven lose: the gallery needs
 * them, and recomputing later would risk the picture and the choice diverging.
 */
export function encode(input: string, opts: EncodeOptions = {}): Build {
  const ecLevel = opts.ecLevel ?? 'M';
  const mode = chooseMode(input);
  const version = chooseVersion(input, mode, ecLevel, opts.minVersion ?? 1);
  const spec = blockSpec(version, ecLevel);

  const segmentation = buildSegmentation(input, mode, version, ecLevel);
  const plan = buildBlocks(segmentation.dataCodewords, version, ecLevel, opts.traceBlock ?? 0);

  const blockDataStart: number[] = [];
  let acc = 0;
  for (const b of plan.blocks) {
    blockDataStart.push(acc);
    acc += b.data.length;
  }

  const canvas = new MatrixCanvas(version);
  drawFunctionPatterns(canvas);
  reserveInfoAreas(canvas);
  placeCodewords(
    canvas,
    plan.interleaved,
    segmentation.dataCodewords.length,
    plan.sources,
    blockDataStart,
    spec.eccPerBlock,
  );

  const size = canvas.size;
  const maskScores: MaskScore[] = [];
  const maskGrids: Uint8Array[] = [];

  for (let mask = 0; mask < 8; mask++) {
    applyMask(canvas, mask);
    drawFormatInfo(canvas, ecLevel, mask);
    drawVersionInfo(canvas);
    const grid = new Uint8Array(size * size);
    for (let i = 0; i < grid.length; i++) grid[i] = canvas.values[i] === 1 ? 1 : 0;
    maskGrids.push(grid);
    maskScores.push(scoreMask((x, y) => grid[y * size + x] === 1, size, mask));
  }

  const forcedMask = opts.forceMask !== undefined;
  const chosen = forcedMask ? opts.forceMask! : chooseMask(maskScores);

  applyMask(canvas, chosen);
  drawFormatInfo(canvas, ecLevel, chosen);
  drawVersionInfo(canvas);

  const modules = toModules(canvas);
  const eccCodewords = new Uint8Array(eccCodewordCount(version, ecLevel));
  let at = 0;
  for (const b of plan.blocks) {
    eccCodewords.set(b.ecc, at);
    at += b.ecc.length;
  }

  const resolver = buildSourceResolver(segmentation);

  return {
    input,
    version,
    ecLevel,
    mode,
    size,
    bitstream: segmentation.bits,
    bitLength: segmentation.bitLength,
    segmentation,
    dataCodewords: segmentation.dataCodewords,
    eccCodewords,
    interleaved: plan.interleaved,
    blocks: plan.blocks,
    blockPlan: plan,
    divisionTrace: plan.divisionTrace,
    maskScores,
    maskGrids,
    chosenMask: chosen,
    forcedMask,
    modules,
    byCodeword: buildByCodeword(modules),
    byStreamIndex: buildByStreamIndex(modules),
    resolver,
    byteToCodeword: (byteIndex: number) => resolver.unitToCodewords(byteIndex),
    remainderBits: remainderBits(version),
  };
}

/** The finished symbol as a boolean grid, which is what the decoder reads. */
export function toGrid(build: Build): boolean[][] {
  const out: boolean[][] = [];
  for (let y = 0; y < build.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < build.size; x++) row.push(build.modules[y * build.size + x].value);
    out.push(row);
  }
  return out;
}

export { matrixSize, dataCodewordCount };
