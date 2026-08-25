import { createQpdfRunner, QpdfRunner } from 'qpdf-run';

export interface EncryptOptions {
  userPassword: string;
  ownerPassword?: string;
  permissions?: {
    printing?: 'low' | 'high';
    copying?: boolean;
    modifying?: boolean;
    fillingForms?: boolean;
  };
}

let runnerPromise: Promise<QpdfRunner> | null = null;

/**
 * Lazily creates a shared qpdf WASM runner (browser-only, backed by a Web Worker).
 */
function getRunner(): Promise<QpdfRunner> {
  if (!runnerPromise) {
    runnerPromise = createQpdfRunner({
      assetBaseUrl: '/qpdf/',
      workerUrl: '/qpdf/worker.js',
      timeoutMs: 30000,
    });
  }
  return runnerPromise;
}

/**
 * Encrypts a PDF with user/owner passwords and optional permission restrictions.
 * Uses the standard qpdf CLI (compiled to WASM) so output is compatible with all readers.
 */
export async function encryptPdf(
  pdfBytes: ArrayBuffer,
  opts: EncryptOptions
): Promise<Uint8Array> {
  const runner = await getRunner();
  const args: string[] = ['--encrypt', opts.userPassword, opts.ownerPassword || opts.userPassword, '256'];

  // qpdf permission flags (default: everything allowed)
  const p = opts.permissions;
  if (p) {
    args.push(
      `--print=${p.printing === 'low' ? 'low' : 'full'}`,
      `--copy=${p.copying === false ? 'n' : 'y'}`,
      `--modify=${p.modifying === false ? 'n' : 'all'}`,
      `--extract=${p.copying === false ? 'n' : 'y'}`
    );
  }

  args.push('--', 'input.pdf', 'output.pdf');

  try {
    const output = await runner.runOne({
      input: new Uint8Array(pdfBytes),
      inputName: 'input.pdf',
      outputName: 'output.pdf',
      args,
    });
    return output;
  } catch (err) {
    console.error('qpdf encrypt failed', err);
    throw new Error('加密失败，请检查输入文件。');
  }
}

/**
 * Decrypts a password-protected PDF using standard qpdf.
 * Throws if the password is incorrect.
 */
export async function decryptPdf(
  pdfBytes: ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  const runner = await getRunner();
  try {
    const output = await runner.runOne({
      input: new Uint8Array(pdfBytes),
      inputName: 'input.pdf',
      outputName: 'output.pdf',
      args: [`--password=${password}`, '--decrypt', '--', 'input.pdf', 'output.pdf'],
    });
    return output;
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    if (/password|incorrect|wrong/i.test(msg) || (err as { code?: string })?.code === 'QPDF_EXEC_FAILED') {
      throw new Error('密码错误，请重试。');
    }
    console.error('qpdf decrypt failed', err);
    throw new Error('解密失败，请确认文件未损坏。');
  }
}

/** Downloads a Uint8Array as a PDF file. */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
