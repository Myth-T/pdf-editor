import { PDFDocument } from 'pdf-lib';

export interface MergeInputFile {
  name: string;
  bytes: ArrayBuffer;
}

export interface MergeResult {
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * Merges multiple PDFs into a single document, preserving page order.
 */
export async function mergePdfs(files: MergeInputFile[]): Promise<MergeResult> {
  if (files.length === 0) {
    throw new Error('没有选择任何 PDF 文件');
  }

  const merged = await PDFDocument.create();
  let pageCount = 0;

  for (const file of files) {
    const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
    const indices = src.getPageIndices();
    const pages = await merged.copyPages(src, indices);
    pages.forEach((page) => merged.addPage(page));
    pageCount += pages.length;
  }

  const bytes = await merged.save();
  return { bytes: new Uint8Array(bytes), pageCount };
}

/** Reads a File into an ArrayBuffer (helper for the merge dialog). */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
