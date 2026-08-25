import { PDFDocument } from 'pdf-lib';

export interface SplitPart {
  name: string;
  bytes: Uint8Array;
  pages: number[];
}

/**
 * Parses a range string like "1-5, 8, 10-15" into an array of 1-based page numbers.
 * Returns null if the input is invalid.
 */
export function parseRanges(input: string, maxPage: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const result: number[] = [];
  const parts = trimmed.split(',');

  for (const part of parts) {
    const seg = part.trim();
    if (!seg) continue;
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(seg);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (start < 1 || end > maxPage || start > end) return null;
      for (let i = start; i <= end; i++) result.push(i);
    } else if (/^\d+$/.test(seg)) {
      const p = parseInt(seg, 10);
      if (p < 1 || p > maxPage) return null;
      result.push(p);
    } else {
      return null;
    }
  }

  if (result.length === 0) return null;
  // Dedupe while preserving order
  return [...new Set(result)];
}

/**
 * Splits a PDF into multiple parts.
 * @param pdfBytes source PDF bytes
 * @param groups array of page lists (1-based). Each group becomes one output PDF.
 */
export async function splitPdf(pdfBytes: ArrayBuffer, groups: number[][]): Promise<SplitPart[]> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const results: SplitPart[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const pages = groups[gi].filter((p) => p >= 1 && p <= total);
    if (pages.length === 0) continue;

    const doc = await PDFDocument.create();
    const copied = await doc.copyPages(src, pages.map((p) => p - 1));
    copied.forEach((page) => doc.addPage(page));
    const bytes = await doc.save();
    results.push({
      name: `拆分_第${gi + 1}部分.pdf`,
      bytes: new Uint8Array(bytes),
      pages,
    });
  }

  return results;
}
