// Load the main Inkoro editor page in headless Chrome and verify it renders without errors.
import puppeteer from "puppeteer-core";

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
    if (msg.type() === "error") errors.push(`[console.error] ${msg.text()}`);
  });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });

  // Wait for the upload dialog to appear (main UI)
  await page.waitForFunction(
    () => document.body.textContent?.includes("上传 PDF"),
    { timeout: 30000 }
  );
  const title = await page.title();
  console.log("Page title:", title);
  console.log("Upload dialog rendered: OK");

  // Check for brand / header presence
  const hasBrand = await page.evaluate(() => document.body.textContent?.includes("Inkoro"));
  console.log("Brand visible:", hasBrand);

  console.log("---errors captured---");
  if (errors.length === 0) console.log("(none)");
  else for (const e of errors) console.log(e);
} finally {
  await browser.close();
}
