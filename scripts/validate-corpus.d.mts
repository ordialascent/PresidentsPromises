export interface Paragraph {
  speaker: string;
  sentences: string[];
}
export interface ParsedSource {
  fm: Record<string, unknown>;
  paragraphs: Map<number, Paragraph>;
}
export interface Resolved {
  sentences?: { p: number; s: number; speaker: string; text: string }[];
  text?: string;
  error?: string;
}
export interface Report {
  errors: string[];
  warnings: string[];
}
export const THEMES: string[];
export const TRIGGERS: { firm: string[]; soft: string[] };
export function normalise(s: string): string;
export function triggerOf(sentence: string): string | null;
export function parseSource(md: string): ParsedSource;
export function resolveRef(source: ParsedSource, ref: string): Resolved;
export function quoteFits(quote: string, span: string): boolean;
export function validateTerm(
  termName: string,
  files: Record<string, string>,
  allIds?: Set<string>,
): Report;
export function validateCorpus(corpusDir: string): Report & { terms: number };
