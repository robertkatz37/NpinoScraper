const puppeteer = require("puppeteer");

async function scrapeNpino(query) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://npino.com/");

  // Enter search query and submit
  await page.type("input.form-control", query);
  await page.keyboard.press("Enter");
  await page.waitForSelector(".panel-body table a.question");

  // Extract all links
  const links = await page.$$eval(".panel-body table a.question", (els) =>
    els.map((el) => ({
      text: el.textContent.trim(),
      url: el.href,
    }))
  );

  await browser.close();
  return links;
}

module.exports = { scrapeNpino };
