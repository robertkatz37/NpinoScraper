const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;

// Helper to fetch and parse HTML
async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      // Helps avoid occasional anti-bot blocks
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 30000,
  });
  return cheerio.load(data);
}

// Normalize //, /, or relative hrefs to absolute https://npino.com/...
function normalizeUrl(href) {
  if (!href) return "";
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("http")) return href;
  if (!href.startsWith("/")) href = "/" + href;
  return "https://npino.com" + href;
}

// Extract text right after a <b>Label:</b>
function textAfterBold($, containerEl, label) {
  const b = $(containerEl).find(`b:contains('${label}')`).first();
  if (!b.length) return "";
  let node = b[0].nextSibling;
  while (node) {
    if (node.type === "text") {
      // cheerio text nodes use .data
      const val = (node.data || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (val) return val;
      // keep walking in case there are empty whitespace nodes
      node = node.nextSibling;
      continue;
    }
    if (node.type === "tag") {
      // Sometimes the value might be wrapped (rare). Grab its text.
      const val = $(node).text().replace(/\u00a0/g, " ").trim();
      if (val) return val;
    }
    if (node.name === "br") break;
    node = node.nextSibling;
  }
  return "";
}

// Homepage -> Scrape all categories
// Homepage -> Scrape all sections
app.get("/", async (req, res) => {
  try {
    const $ = await fetchHTML("https://npino.com/");
    let sections = [];

    // Select all panel-info divs
    $(".panel-info").each((i, panel) => {
      const panelTitle = $(panel).find(".panel-heading .panel-title").text().trim();
      let items = [];

      // Get all links inside this panel
      $(panel).find(".panel-body a.question").each((j, link) => {
        const url = $(link).attr("href");
        const text = $(link).text().trim();
        if (url && text) {
          items.push({ text, url });
        }
      });

      if (panelTitle && items.length > 0) {
        sections.push({ title: panelTitle, items });
      }
    });

    // Build HTML
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NPINO Healthcare Providers</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .section-title {
      margin-top: 40px;
      margin-bottom: 20px;
      font-weight: 700;
      text-align: center;
    }
    .category-card {
      border-radius: 12px;
      padding: 20px;
      color: #000;
      text-align: center;
      transition: transform 0.3s, background-color 0.3s;
      cursor: pointer;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 15px;
    }
    .category-card:hover {
      transform: translateY(-5px);
      filter: brightness(1.2);
      text-decoration: none;
      color: #000;
    }
  </style>
</head>
<body class="bg-light">
  <div class="container mt-4">
    <h1 class="mb-5 text-center">NPINO Healthcare Providers</h1>
`;

    // Loop through sections
    sections.forEach(section => {
      html += `<h2 class="section-title">${section.title}</h2><div class="row g-3">`;

      section.items.forEach(item => {
        // Generate a random pastel color for each card
        const r = Math.floor(Math.random() * 127 + 127);
        const g = Math.floor(Math.random() * 127 + 127);
        const b = Math.floor(Math.random() * 127 + 127);
        const bgColor = `rgb(${r},${g},${b})`;

        html += `
          <a href="/category?url=${encodeURIComponent(item.url)}" class="col-md-3 category-card" style="background-color: ${bgColor}"> ${item.text} </a>
        `;
      });

      html += `</div>`; // close row
    });

    html += `
  </div>
</body>
</html>
`;

    res.send(html);
  } catch (error) {
    res.status(500).send("Error scraping homepage: " + error.message);
  }
});

// Category -> Scrape states
app.get("/category", async (req, res) => {
  try {
    let categoryUrl = req.query.url;
    if (!categoryUrl) return res.send("Category URL missing!");
    if (categoryUrl.startsWith("//")) categoryUrl = "https:" + categoryUrl;
    else if (!categoryUrl.startsWith("http")) categoryUrl = "https://npino.com" + categoryUrl;

    const $ = await fetchHTML(categoryUrl);
    let states = [];
    $(".panel-info .panel-body a.question").each((i, el) => {
      let stateUrl = $(el).attr("href");
      states.push({ text: $(el).text().trim(), url: stateUrl });
    });

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>States</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .section-title {
      margin-top: 40px;
      margin-bottom: 20px;
      font-weight: 700;
      text-align: center;
    }
    .state-card {
      border-radius: 12px;
      padding: 20px;
      color: #fff;
      text-align: center;
      transition: transform 0.3s, filter 0.3s;
      cursor: pointer;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 15px;
    }
    .state-card:hover {
      transform: translateY(-5px);
      filter: brightness(1.2);
      text-decoration: none;
      color: #fff;
    }
  </style>
</head>
<body class="bg-light">
  <div class="container mt-4">
    <h1 class="mb-4 text-center">States for ${categoryUrl}</h1>
    <div class="row g-3">
`;

// Define a fixed color palette
const colors = [
  '#08326B', '#FF6F61', '#6B8E23', '#FFB347',
  '#FF7F50', '#20B2AA', '#9370DB', '#F08080'
];

states.forEach((st, index) => {
  let stateUrl = st.url;
  stateUrl = normalizeUrl(stateUrl);

  // Pick color from palette cyclically
  const bgColor = colors[index % colors.length];

  html += `
    <a href="/state?url=${encodeURIComponent(stateUrl)}" class="col-md-3 state-card" style="background-color: ${bgColor}">
      ${st.text}
    </a>
  `;
});

html += `
    </div>
  </div>
</body>
</html>
`;


    res.send(html);
  } catch (error) {
    res.status(500).send("Error scraping category: " + error.message);
  }
});


// Scrape all pages for a state
// Scrape all pages for a state / lookup
app.get("/state", async (req, res) => {
  try {
    const stateUrl = req.query.url;
    if (!stateUrl) return res.send("Please provide a valid ?url=");

    let page = 1;
    let allProviders = [];

    while (true) {
      const url = `${stateUrl}${stateUrl.includes("?") ? "&" : "?"}page=${page}`;
      console.log(`Scraping: ${url}`);

      let response;
      try {
        response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log("No more pages (404). Stopping.");
          break;
        }
        throw err;
      }

      const $ = cheerio.load(response.data);

      const providers = [];
      $(".inlinediv").each((_, el) => {
        // NAME
        const nameAnchor = $(el).find("strong a.question").first();
        const name = nameAnchor.text().trim();
        const nameLink = normalizeUrl(nameAnchor.attr("href"));

        // NPI: check <strong> first, fallback to <small>
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

        // ADDRESS / PHONE / FAX
        const address = textAfterBold($, el, "Address:") || "N/A";
        const phone = textAfterBold($, el, "Phone:") || "N/A";
        const fax = textAfterBold($, el, "Fax:") || "N/A";

        providers.push({ name, nameLink, npi, npiLink, address, phone, fax });
      });

      if (providers.length === 0) break;

      allProviders.push(...providers);
      page++;
    }

    // Convert data to CSV
    const csvHeaders = ["#", "Provider Name", "NPI Number", "Address", "Phone", "Fax"];
    const csvRows = allProviders.map((p, index) => [
      index + 1,
      `"${p.name}"`,
      `"${p.npi}"`,
      `"${p.address}"`,
      `"${p.phone}"`,
      `"${p.fax}"`,
    ]);
    const csvContent = [csvHeaders.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

    // Build HTML
    let html = `
      <html>
        <head>
          <title>Providers</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { color: #08326B; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #08326B; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            a { color: #08326B; text-decoration: none; }
            a:hover { text-decoration: underline; color: #0056b3; }
            .btn { background-color: #08326B; color: white; padding: 8px 12px; border: none; cursor: pointer; margin-bottom: 10px; }
            .btn:hover { background-color: #0056b3; }
          </style>
        </head>
        <body>
          <h2>Providers in ${stateUrl}</h2>
          <p><b>Total Providers Detected:</b> ${allProviders.length}</p>
          <button class="btn" onclick="downloadCSV()">Download CSV</button>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Provider Name</th>
                <th>NPI Number</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Fax</th>
              </tr>
            </thead>
            <tbody>
    `;

    allProviders.forEach((p, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td><a href="${p.nameLink}" target="_blank">${p.name}</a></td>
          <td><a href="${p.npiLink}" target="_blank">${p.npi}</a></td>
          <td>${p.address}</td>
          <td>${p.phone}</td>
          <td>${p.fax}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
          <script>
            function downloadCSV() {
              const csv = \`${csvContent}\`;
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.setAttribute('download', 'providers.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          </script>
        </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error scraping state:", error.message);
    res.status(500).send("Error scraping state: " + error.message);
  }
});
module.exports = app;
module.exports.handler = serverless(app);