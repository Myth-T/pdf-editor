// Browser-side verification of qpdf-run (encrypt/decrypt) using puppeteer-core + installed Chrome.
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:3000/qpdf-test.html";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => logs.push(`[console] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  // Wait for the result marker in the title or the log content
  await page.waitForFunction(
    () => document.getElementById("log")?.textContent?.includes("====="),
    { timeout: 30000 }
  );
  const text = await page.$eval("#log", (el) => el.textContent || "");
  console.log(text);
  console.log("---browser logs---");
  for (const l of logs) console.log(l);
} finally {
  await browser.close();
}
