// Generates a subset font containing GB2312 level-1 (most common) Chinese characters
// plus ASCII + common punctuation. Output: public/fonts/NotoSansSC-subset.ttf
import Fontmin from "fontmin";
import iconv from "iconv-lite";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

// GB2312 level-1 hanzi: rows 0xB0A1-0xD7F9 (3755 chars)
let chars = "";
for (let row = 0xb0; row <= 0xd7; row++) {
  for (let col = 0xa1; col <= 0xfe; col++) {
    if (row === 0xd7 && col > 0xf9) break;
    const ch = iconv.decode(Buffer.from([row, col]), "gbk");
    if (ch) chars += ch;
  }
}

// ASCII printable + common punctuation
for (let i = 0x20; i <= 0x7e; i++) chars += String.fromCharCode(i);
chars += "，。！？；：、（）《》「」『』“”‘’—…·￥％＃＠＆＊＋－＝／";

const src = path.resolve("public/fonts/NotoSansSC.ttf");
const outDir = path.resolve("public/fonts");
mkdirSync(outDir, { recursive: true });

console.log(`Subsetting font with ${chars.length} characters...`);

const fontmin = new Fontmin()
  .src(src)
  .use(Fontmin.glyph({ text: chars, hinting: false }))
  .dest(outDir);

fontmin.run((err, files) => {
  if (err) {
    console.error("Subsetting failed:", err);
    process.exit(1);
  }
  if (!files || files.length === 0) {
    console.error("No output files");
    process.exit(1);
  }
  const out = files[0];
  writeFileSync(path.join(outDir, "NotoSansSC-subset.ttf"), out.contents);
  console.log("Done. Output size:", out.contents.length, "bytes");
});
