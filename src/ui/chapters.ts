import type { CopyKey } from '../copy';

/**
 * The nine stages grouped into four chapters, each answering one question a
 * visitor would actually ask. The stages, their order and the continuous
 * slider are unchanged; this is only the grouping the reader sees.
 *
 * The numerals live here rather than in the copy files: they are notation,
 * not language, and the copy register forbids words in capitals.
 */
export interface Chapter {
  n: 1 | 2 | 3 | 4;
  numeral: string;
  stages: number[];
  name: CopyKey;
  question: CopyKey;
}

export const CHAPTERS: Chapter[] = [
  { n: 1, numeral: 'I', stages: [1, 2, 3], name: 'chapter.1.name', question: 'chapter.1.question' },
  { n: 2, numeral: 'II', stages: [4, 5], name: 'chapter.2.name', question: 'chapter.2.question' },
  { n: 3, numeral: 'III', stages: [6, 7, 8], name: 'chapter.3.name', question: 'chapter.3.question' },
  { n: 4, numeral: 'IV', stages: [9], name: 'chapter.4.name', question: 'chapter.4.question' },
];

export function chapterOf(stage: number): Chapter {
  const s = Math.min(9, Math.max(1, Math.round(stage)));
  return CHAPTERS.find((c) => c.stages.includes(s)) ?? CHAPTERS[0];
}

/** True when this stage is the last one in its chapter. */
export function endsChapter(stage: number): boolean {
  const chapter = chapterOf(stage);
  return chapter.stages[chapter.stages.length - 1] === Math.round(stage);
}
