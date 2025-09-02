// api/category.js
const axios = require("axios");
const cheerio = require("cheerio");

async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US" },
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
    const q = req.query.url;
    if (!q) return res.status(400).send("Missing ?url parameter");

    const categoryUrl = q.startsWith("http") ? q : (q.startsWith("//") ? "https:" + q : "https://npino.com" + (q.startsWith("/") ? q : "/" + q));

    const $ = await fetchHTML(categoryUrl);
    const states = [];
    $(".panel-info .panel-body a.question").each((i, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (href && text) states.push({ text, href: normalizeHref(href) });
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>States</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body><div class="container py-4"><a href="/" class="btn btn-link mb-3">&larr; Back</a><h1 class="mb-4">States</h1><div class="row g-3">`;

    if (states.length === 0) {
      html += `<div class="col-12"><div class="alert alert-warning">No states found for this category.</div></div>`;
    } else {
      states.forEach((st, idx) => {
        html += `
          <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card shadow-sm">
              <div class="card-body">
                <h6 class="card-title">${st.text}</h6>
                <a class="btn btn-sm btn-success" href="/state?url=${encodeURIComponent(st.href)}">View Providers</a>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `</div></div></body></html>`;
    res.status(200).send(html);
  } catch (err) {
    console.error("Category error:", err && err.message ? err.message : err);
    res.status(500).send(`<h2>Error scraping category</h2><pre>${String(err && err.message ? err.message : err)}</pre>`);
  }
};
module.exports = app;