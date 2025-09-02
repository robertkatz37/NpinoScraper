const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;

// Helper: fetch HTML and return cheerio instance
async function fetchHTML(url) {
  const { data } = await axios.get(url);
  return cheerio.load(data);
}

// Scrape providers from a single page
async function scrapePage(url) {
  const $ = await fetchHTML(url);
  const providers = [];

  $(".inlinediv").each((i, el) => {
    const nameEl = $(el).find("strong a.question").first();
    if (!nameEl) return;

    const name = nameEl.text().trim();
    let link = nameEl.attr("href") || "";
    if (link.startsWith("//")) link = "https:" + link;
    else if (!link.startsWith("http")) link = "https://npino.com" + link;

    const npi = $(el).find("small a.question").first().text().trim();
    let address = "", phone = "", fax = "";

    $(el).find("small b").each((i, b) => {
      const text = $(b).text().trim();
      const nextText = b.nextSibling?.nodeValue?.trim() || "";
      if (text.startsWith("Address")) address = nextText;
      else if (text.startsWith("Phone")) phone = nextText.replace(/&nbsp;/g, "").trim();
      else if (text.startsWith("Fax")) fax = nextText.replace(/&nbsp;/g, "").trim();
    });

    providers.push({ name, link, npi, address, phone, fax });
  });

  return providers;
}

// Scrape all pages until no providers are found
app.get("/state", async (req, res) => {
  try {
    let stateUrl = req.query.url;
    if (!stateUrl) return res.send("State URL missing!");
    if (stateUrl.startsWith("//")) stateUrl = "https:" + stateUrl;
    else if (!stateUrl.startsWith("http")) stateUrl = "https://npino.com" + stateUrl;

    const allProviders = [];
    let totalDetected = 0;

    let page = 1;
    while (true) {
      const pageUrl = page === 1 ? stateUrl : stateUrl.replace(/\/$/, "") + `?page=${page}`;
      const $ = await fetchHTML(pageUrl);

      // Try to detect total providers from header
      if (page === 1) {
        const panelText = $(".panel-body").first().text().trim();
        const match = panelText.match(/(\d+)\s+home health agencies found/i);
        if (match) totalDetected = parseInt(match[1]);
      }

      // Scrape providers
      const providers = [];
      $(".inlinediv").each((i, el) => {
        const nameEl = $(el).find("strong a.question").first();
        if (!nameEl) return;

        const name = nameEl.text().trim();
        let link = nameEl.attr("href") || "";
        if (link.startsWith("//")) link = "https:" + link;
        else if (!link.startsWith("http")) link = "https://npino.com" + link;

        const npi = $(el).find("small a.question").first().text().trim();
        let address = "", phone = "", fax = "";

        $(el).find("small b").each((i, b) => {
          const text = $(b).text().trim();
          const nextText = b.nextSibling?.nodeValue?.trim() || "";
          if (text.startsWith("Address")) address = nextText;
          else if (text.startsWith("Phone")) phone = nextText.replace(/&nbsp;/g, "").trim();
          else if (text.startsWith("Fax")) fax = nextText.replace(/&nbsp;/g, "").trim();
        });

        providers.push({ name, link, npi, address, phone, fax });
      });

      if (providers.length === 0) break;
      allProviders.push(...providers);
      console.log(`Page ${page} scraped, total collected: ${allProviders.length}`);
      page++;
    }

    // Render HTML
    let html = `
    <html>
      <head>
        <title>Providers in ${stateUrl}</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
          h1, h3 { color: #08326B; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 8px 12px; border: 1px solid #ccc; text-align: left; }
          th { background-color: #08326B; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
          a { color: #08326B; text-decoration: none; }
          a:hover { text-decoration: underline; color: #0654a0; }
        </style>
      </head>
      <body>
        <h1>Providers in ${stateUrl}</h1>
        <h3>Total Detected: ${totalDetected || "Unknown"} | Total Collected: ${allProviders.length}</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>NPI</th>
              <th>Address</th>
              <th>Phone</th>
              <th>Fax</th>
            </tr>
          </thead>
          <tbody>
    `;

    allProviders.forEach((p, i) => {
      html += `
        <tr>
          <td>${i + 1}</td>
          <td><a href="${p.link}" target="_blank">${p.name}</a></td>
          <td>${p.npi}</td>
          <td>${p.address}</td>
          <td>${p.phone}</td>
          <td>${p.fax}</td>
        </tr>
      `;
    });

    html += `</tbody></table></body></html>`;
    res.send(html);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error scraping state: " + err.message);
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
