// Full E2E: upload a PDF into the editor, verify the editor UI (toolbar, sidebar, form/encrypt buttons).
import puppeteer from "puppeteer-core";
import { readFileSync } from "fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:3000/";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("hydration")) errors.push(`[console.error] ${msg.text().slice(0, 200)}`);
  });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => document.body.textContent?.includes("上传 PDF"), { timeout: 30000 });

  // Upload the test PDF via the hidden file input
  const input = await page.$('input[type="file"][accept="application/pdf"]');
  if (!input) throw new Error("file input not found");
  await input.uploadFile("E:/PDF editior/test-files/form-test.pdf");
  console.log("E2E: file uploaded, waiting for editor...");

  // Wait for editor to load the PDF (page thumbnails appear, toolbar rendered)
  try {
    await page.waitForFunction(() => document.body.textContent?.includes("第 1 页"), { timeout: 90000 });
  } catch {
    const bodyText = await page.evaluate(() => document.body.textContent?.slice(0, 800));
    console.log("E2E DIAG: body text =", bodyText);
    const hasUpload = await page.evaluate(() => document.body.textContent?.includes("上传 PDF"));
    const hasInkoro = await page.evaluate(() => document.body.textContent?.includes("Inkoro"));
    console.log("E2E DIAG: upload dialog still visible:", hasUpload);
    console.log("E2E DIAG: brand visible:", hasInkoro);
    console.log("E2E DIAG: all errors:", errors);
    throw new Error("editor toolbar never appeared");
  }
  await page.waitForFunction(() => document.body.textContent?.includes("表单填写"), { timeout: 10000 });
  await page.waitForFunction(() => document.body.textContent?.includes("加密 / 解密"), { timeout: 10000 });

  console.log("E2E: PDF uploaded, editor rendered");
  console.log("E2E: pages rendered:", await page.evaluate(() => document.body.textContent?.includes("第 1 页") && document.body.textContent?.includes("第 3 页")));
  console.log("E2E: 表单填写 button:", await page.evaluate(() => document.body.textContent?.includes("表单填写")));
  console.log("E2E: 加密/解密 button:", await page.evaluate(() => document.body.textContent?.includes("加密 / 解密")));
  console.log("E2E: 导出 button:", await page.evaluate(() => document.body.textContent?.includes("导出")));

  // Verify the merge/split menu trigger exists (title attribute)
  const hasMergeSplit = await page.evaluate(() => {
    const btn = document.querySelector('button[title="合并/拆分"]');
    return !!btn;
  });
  console.log("E2E: 合并/拆分 menu button:", hasMergeSplit);

  // Click form panel and verify form fields appear
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const txt = await b.evaluate((el) => el.textContent || "");
    if (txt.includes("表单填写")) {
      await b.click();
      break;
    }
  }
  await page.waitForFunction(() => document.body.textContent?.includes("共 5 个表单字段"), { timeout: 15000 });
  console.log("E2E: Form panel shows 5 fields: OK");

  // Screenshot for the record
  await page.screenshot({ path: "E:/PDF editior/test-files/editor-screenshot.png" });
  console.log("E2E: screenshot saved");

  console.log("---errors captured---");
  if (errors.length === 0) console.log("(none)");
  else for (const e of errors) console.log(e);
} finally {
  await browser.close();
}
