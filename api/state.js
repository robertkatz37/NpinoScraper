// api/state.js
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

function textAfterBold($, containerEl, label) {
  const b = $(containerEl).find(`b:contains('${label}')`).first();
  if (!b.length) return "";
  let node = b[0].nextSibling;
  while (node) {
    if (node.type === "text") {
      const val = (node.data || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (val) return val;
      node = node.nextSibling;
      continue;
    }
    if (node.type === "tag") {
      const val = $(node).text().replace(/\u00a0/g, " ").trim();
      if (val) return val;
    }
    if (node.name === "br") break;
    node = node.nextSibling;
  }
  return "";
}

module.exports = async (req, res) => {
  try {
    let u = req.query.url;
    if (!u) return res.status(400).send("Missing ?url parameter");
    // default max pages to avoid long-running functions
    const maxPages = Math.min(parseInt(req.query.maxPages || "5", 10), 50);

    // normalize
    let stateUrl = u.startsWith("http") ? u : (u.startsWith("//") ? "https:" + u : "https://npino.com" + (u.startsWith("/") ? u : "/" + u));

    let page = 1;
    const allProviders = [];
    while (page <= maxPages) {
      const pageUrl = `${stateUrl}${stateUrl.includes("?") ? "&" : "?"}page=${page}`;
      try {
        const response = await axios.get(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US" },
          timeout: 15000
        });
        const $ = cheerio.load(response.data);

        const providers = [];
        $(".inlinediv").each((i, el) => {
          const nameAnchor = $(el).find("strong a.question").first();
          const name = nameAnchor.text().trim() || "N/A";
          const nameLink = normalizeHref(nameAnchor.attr("href"));
          let npi = "";
          let npiLink = "";
          $(el).find("a.question").each((__, a) => {
            const t = $(a).text().trim();
            if (/^\d{10}$/.test(t)) {
              npi = t;
              npiLink = normalizeHref($(a).attr("href"));
            }
          });
          const address = textAfterBold($, el, "Address:") || "N/A";
          const phone = textAfterBold($, el, "Phone:") || "N/A";
          const fax = textAfterBold($, el, "Fax:") || "N/A";
          providers.push({ name, nameLink, npi, npiLink, address, phone, fax });
        });

        if (providers.length === 0) break; // no more results
        allProviders.push(...providers);
        page++;
      } catch (err) {
        // if 404, stop paging; otherwise rethrow
        if (err.response && err.response.status === 404) break;
        console.error("Page fetch error:", err && err.message ? err.message : err);
        // break or rethrow? we break to return what we have so far
        break;
      }
    }

    // build CSV content
    const csvRows = [
      ["#", "Provider Name", "NPI Number", "Address", "Phone", "Fax"],
      ...allProviders.map((p, i) => [
        String(i + 1),
        p.name.replace(/"/g, '""'),
        p.npi,
        p.address.replace(/"/g, '""'),
        p.phone.replace(/"/g, '""'),
        p.fax.replace(/"/g, '""')
      ])
    ];
    const csvContent = csvRows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");

    // build HTML output
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Providers</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><style>table th{background:#08326B;color:#fff}</style></head><body><div class="container py-4"><a href="/" class="btn btn-link mb-3">&larr; Home</a><h1 class="mb-3">Providers (${allProviders.length})</h1><p><small>Scanned pages: ${page <= maxPages ? page - 1 : maxPages} (maxPages=${maxPages})</small></p><button id="download" class="btn btn-primary mb-3">Download CSV</button><div class="table-responsive"><table class="table table-striped table-bordered"><thead><tr><th>#</th><th>Name</th><th>NPI</th><th>Address</th><th>Phone</th><th>Fax</th></tr></thead><tbody>`;

    allProviders.forEach((p, i) => {
      html += `<tr><td>${i + 1}</td><td><a href="${p.nameLink}" target="_blank" rel="noopener noreferrer">${p.name}</a></td><td>${p.npi ? `<a href="${p.npiLink}" target="_blank" rel="noopener noreferrer">${p.npi}</a>`: ""}</td><td>${p.address}</td><td>${p.phone}</td><td>${p.fax}</td></tr>`;
    });

    html += `</tbody></table></div><script>
(function(){
  const csv = ${JSON.stringify(csvContent)};
  document.getElementById('download').addEventListener('click', function(){
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'providers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
})();
</script></div></body></html>`;

    res.status(200).send(html);
  } catch (err) {
    console.error("State error:", err && err.message ? err.message : err);
    res.status(500).send(`<h2>Error scraping state</h2><pre>${String(err && err.message ? err.message : err)}</pre>`);
  }
};
module.exports = serverless(app);