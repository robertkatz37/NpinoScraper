import axios from "axios";
import cheerio from "cheerio";

// Helpers
async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 30000,
  });
  return cheerio.load(data);
}

function normalizeUrl(href) {
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
      const val = (node.data || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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

// Main serverless handler
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = url.searchParams;

  try {
    if (pathname === "/") {
      // Homepage
      const $ = await fetchHTML("https://npino.com/");
      let sections = [];
      $(".panel-info").each((i, panel) => {
        const panelTitle = $(panel).find(".panel-heading .panel-title").text().trim();
        let items = [];
        $(panel).find(".panel-body a.question").each((j, link) => {
          const href = $(link).attr("href");
          const text = $(link).text().trim();
          if (href && text) items.push({ text, url: href });
        });
        if (panelTitle && items.length > 0) sections.push({ title: panelTitle, items });
      });

      let html = `<html><head><title>NPINO</title></head><body>`;
      sections.forEach((section) => {
        html += `<h2>${section.title}</h2>`;
        section.items.forEach((item) => {
          html += `<a href="/category?url=${encodeURIComponent(item.url)}">${item.text}</a><br>`;
        });
      });
      html += "</body></html>";
      res.status(200).send(html);

    } else if (pathname === "/category") {
      let categoryUrl = query.get("url");
      if (!categoryUrl) return res.status(400).send("Category URL missing!");
      categoryUrl = normalizeUrl(categoryUrl);

      const $ = await fetchHTML(categoryUrl);
      let states = [];
      $(".panel-info .panel-body a.question").each((i, el) => {
        const stateUrl = $(el).attr("href");
        const text = $(el).text().trim();
        if (stateUrl && text) states.push({ text, url: stateUrl });
      });

      let html = `<html><head><title>States</title></head><body>`;
      states.forEach((st) => {
        html += `<a href="/state?url=${encodeURIComponent(normalizeUrl(st.url))}">${st.text}</a><br>`;
      });
      html += "</body></html>";
      res.status(200).send(html);

    } else if (pathname === "/state") {
      const stateUrl = query.get("url");
      if (!stateUrl) return res.status(400).send("State URL missing!");
      let page = 1;
      let allProviders = [];

      while (true) {
        const urlPage = `${stateUrl}${stateUrl.includes("?") ? "&" : "?"}page=${page}`;
        let response;
        try {
          response = await axios.get(urlPage, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
        } catch (err) {
          if (err.response && err.response.status === 404) break;
          throw err;
        }

        const $ = cheerio.load(response.data);
        const providers = [];
        $(".inlinediv").each((_, el) => {
          const nameAnchor = $(el).find("strong a.question").first();
          const name = nameAnchor.text().trim();
          const nameLink = normalizeUrl(nameAnchor.attr("href"));

          let npi = "";
          let npiLink = "";
          $(el)
            .find("a.question")
            .each((__, a) => {
              const t = $(a).text().trim();
              if (/^\d{10}$/.test(t)) {
                npi = t;
                npiLink = normalizeUrl($(a).attr("href"));
              }
            });

          const address = textAfterBold($, el, "Address:") || "N/A";
          const phone = textAfterBold($, el, "Phone:") || "N/A";
          const fax = textAfterBold($, el, "Fax:") || "N/A";

          providers.push({ name, nameLink, npi, npiLink, address, phone, fax });
        });

        if (providers.length === 0) break;
        allProviders.push(...providers);
        page++;
      }

      let html = `<html><head><title>Providers</title></head><body>`;
      html += `<h2>Providers (${allProviders.length})</h2>`;
      html += `<table border="1"><tr><th>#</th><th>Name</th><th>NPI</th><th>Address</th><th>Phone</th><th>Fax</th></tr>`;
      allProviders.forEach((p, i) => {
        html += `<tr>
          <td>${i + 1}</td>
          <td><a href="${p.nameLink}">${p.name}</a></td>
          <td>${p.npi}</td>
          <td>${p.address}</td>
          <td>${p.phone}</td>
          <td>${p.fax}</td>
        </tr>`;
      });
      html += `</table></body></html>`;
      res.status(200).send(html);

    } else {
      res.status(404).send("Not Found");
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Internal Server Error: " + error.message);
  }
}
module.exports = app;