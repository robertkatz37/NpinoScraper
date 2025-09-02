// api/index.js
const axios = require("axios");
const cheerio = require("cheerio");

async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9"
    },
    timeout: 15000
  });
  return cheerio.load(data);
}

function normalizeHref(href) {
  if (!href) return "";
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("http")) return href;
  if (!href.startsWith("/")) href = "/" + href;
  return "https://npino.com" + href;
}

module.exports = async (req, res) => {
  try {
    const $ = await fetchHTML("https://npino.com/");
    const sections = [];

    // gather panels
    $(".panel-info").each((i, panel) => {
      const title = $(panel).find(".panel-heading .panel-title").text().trim();
      const items = [];
      $(panel).find(".panel-body a.question").each((j, a) => {
        const href = $(a).attr("href");
        const text = $(a).text().trim();
        if (href && text) items.push({ text, href });
      });
      if (title && items.length) sections.push({ title, items });
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    let html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NPINO Categories</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
  body { background:#f8f9fa; }
  .card:hover { transform: translateY(-6px); transition: 0.18s; }
  .cat-card { min-height: 120px; display:flex; align-items:center; justify-content:center; text-align:center; }
</style>
</head>
<body>
<div class="container py-4">
  <h1 class="mb-4 text-center">NPINO — Categories</h1>
`;

    // show cards for all items (flattened for simplicity)
    html += `<div class="row g-3">`;
    sections.forEach(section => {
      section.items.forEach(item => {
        html += `
          <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card shadow-sm">
              <div class="card-body cat-card">
                <div>
                  <h6 class="card-title mb-2">${item.text}</h6>
                  <a class="btn btn-sm btn-primary" href="/category?url=${encodeURIComponent(item.href)}">View States</a>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    });
    html += `</div>`;

    html += `
  <footer class="mt-5 text-center text-muted"><small>Data scraped from npino.com</small></footer>
</div>
</body>
</html>`;

    res.status(200).send(html);
  } catch (err) {
    console.error("Homepage error:", err && err.message ? err.message : err);
    res.status(500).send(`<h2>Server error</h2><pre>${String(err && err.message ? err.message : err)}</pre>`);
  }
};
