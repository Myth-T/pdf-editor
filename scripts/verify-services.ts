// End-to-end verification of core PDF services (merge, split, form, encrypt, CJK).
// Polyfill browser globals missing in Node (DOMMatrix etc.) for pdf.js.
import { readFileSync, writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { mergePdfs } from "../lib/merge-service";
import { splitPdf, parseRanges } from "../lib/split-service";
import { getFormFields, applyFormValues, flattenForm } from "../lib/form-service";

// Polyfill browser globals missing in Node (DOMMatrix etc.) for pdf.js —
// MUST run before encrypt-service (pdfjs-dist) is imported.
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
    static fromMatrix(m: any) { return m; }
    static fromString() { return new (globalThis as any).DOMMatrix(); }
    translate() { return this; }
    scale() { return this; }
    multiply() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p; }
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  };
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {};
}

// encrypt-service imports pdfjs-dist which needs DOMMatrix at module scope,
// so it must be loaded dynamically AFTER the polyfills above are installed.
const { encryptPdf, decryptPdf } = await import("../lib/encrypt-service");

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};

const formBytes = readFileSync("E:/PDF editior/test-files/form-test.pdf");
const mergeABytes = readFileSync("E:/PDF editior/test-files/merge-a.pdf");

console.log("\n=== 1. Merge service ===");
{
  const result = await mergePdfs([
    { name: "a.pdf", bytes: mergeABytes.buffer.slice(mergeABytes.byteOffset, mergeABytes.byteOffset + mergeABytes.byteLength) },
    { name: "form.pdf", bytes: formBytes.buffer.slice(formBytes.byteOffset, formBytes.byteOffset + formBytes.byteLength) },
  ]);
  check(`merged page count = 5 (2+3)`, result.pageCount === 5);
  const doc = await PDFDocument.load(result.bytes);
  check("merged PDF loads", doc.getPageCount() === 5);
}

console.log("\n=== 2. Split service ===");
{
  const ranges = parseRanges("1-2, 5", 5);
  check("parseRanges 1-2,5 => [1,2,5]", JSON.stringify(ranges) === "[1,2,5]");
  const invalid = parseRanges("1-2, 99", 5);
  check("parseRanges rejects out-of-range", invalid === null);
  const parts = await splitPdf(
    formBytes.buffer.slice(formBytes.byteOffset, formBytes.byteOffset + formBytes.byteLength),
    [[1, 2], [3]]
  );
  check("split produces 2 parts", parts.length === 2);
  const p1 = await PDFDocument.load(parts[0].bytes);
  check("part1 has 2 pages", p1.getPageCount() === 2);
  const p2 = await PDFDocument.load(parts[1].bytes);
  check("part2 has 1 page", p2.getPageCount() === 1);
}

console.log("\n=== 3. Form service ===");
{
  const fields = await getFormFields(
    formBytes.buffer.slice(formBytes.byteOffset, formBytes.byteOffset + formBytes.byteLength)
  );
  check("found 5 form fields", fields.length === 5);
  const nameField = fields.find((f) => f.name === "Name");
  check("Name field is text type", nameField?.type === "text");
  const cityField = fields.find((f) => f.name === "City");
  check("City dropdown has 4 options", cityField?.options?.length === 4);

  // Apply new values and flatten
  const doc = await PDFDocument.load(
    formBytes.buffer.slice(formBytes.byteOffset, formBytes.byteOffset + formBytes.byteLength)
  );
  applyFormValues(doc, { Name: "Jane Doe", Age: "30", Gender: "Female", City: "Shanghai", Agree: false });
  flattenForm(doc);
  const flattened = await doc.save();
  check("flattened PDF saves", flattened.length > 0);
}

console.log("\n=== 4. Encrypt / Decrypt ===");
{
  // qpdf-run is browser-only (Web Worker), so encryption/decryption cannot be
  // exercised in Node. Here we verify the input PDF is well-formed and that the
  // browser-side service module type-checks by importing it (dynamic import works
  // in Node; only createQpdfRunner would fail at runtime).
  const encModule = await import("../lib/encrypt-service");
  check("encrypt-service exports present", typeof encModule.encryptPdf === "function" && typeof encModule.decryptPdf === "function");
  check("encrypt-service exports downloadPdfBytes", typeof encModule.downloadPdfBytes === "function");

  // Verify the PDF we will encrypt in-browser loads fine with pdf-lib
  const doc = await PDFDocument.load(
    mergeABytes.buffer.slice(mergeABytes.byteOffset, mergeABytes.byteOffset + mergeABytes.byteLength)
  );
  check("source PDF loads with pdf-lib", doc.getPageCount() === 2);
}

console.log("\n=== 5. CJK font embedding (via pdf-lib + fontkit) ===");
{
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const fontBytes = readFileSync("public/fonts/NotoSansSC-subset.ttf");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes);
  const page = doc.addPage([400, 200]);
  page.drawText("中文测试 Hello World", { x: 50, y: 100, size: 20, font });
  const bytes = await doc.save();
  check("CJK text PDF saves", bytes.length > 0 && bytes.length < 2000000);
}

writeFileSync("E:/PDF editior/test-files/verification.log", `PASS=${pass} FAIL=${fail}\n`);
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);
