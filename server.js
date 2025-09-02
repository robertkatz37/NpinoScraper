const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;

// Helper to fetch and parse HTML
async function fetchHTML(url) {
  const { data } = await axios.get(url);
  return cheerio.load(data);
}

// Homepage -> Scrape all categories
app.get("/", async (req, res) => {
  try {
    const $ = await fetchHTML("https://npino.com/");
    let categories = [];
    $(".panel-info .panel-body a.question").each((i, el) => {
      const categoryUrl = $(el).attr("href");
      categories.push({ text: $(el).text().trim(), url: categoryUrl });
    });

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>NPINO Categories</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="bg-light">
        <div class="container mt-4">
          <h1 class="mb-4 text-center">NPINO Categories</h1>
          <div class="list-group">
    `;

    categories.forEach(cat => {
      html += `<a href="/category?url=${encodeURIComponent(cat.url)}" class="list-group-item list-group-item-action">${cat.text}</a>`;
    });

    html += `
          </div>
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
      </head>
      <body class="bg-light">
        <div class="container mt-4">
          <h1 class="mb-4 text-center">States for ${categoryUrl}</h1>
          <div class="list-group">
    `;

    states.forEach(st => {
      let stateUrl = st.url;
      if (stateUrl.startsWith("//")) stateUrl = "https:" + stateUrl;
      else if (!stateUrl.startsWith("http")) stateUrl = "https://npino.com" + stateUrl;
      html += `<a href="/state?url=${encodeURIComponent(stateUrl)}" class="list-group-item list-group-item-action">${st.text}</a>`;
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
app.get("/state", async (req, res) => {
  try {
    const stateUrl = req.query.url;
    if (!stateUrl) {
      return res.send("Please provide a valid ?url=");
    }

    let page = 1;
    let hasData = true;
    let allProviders = [];

    while (hasData) {
      const url = `${stateUrl}?page=${page}`;
      console.log(`Scraping: ${url}`);

      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const providers = [];

      $(".inlinediv").each((_, el) => {
        const nameElement = $(el).find("strong a.question");
        const npiElement = $(el).find("small a.question").first();

        const name = nameElement.text().trim();
        let nameLink = nameElement.attr("href") || "";
        if (nameLink.startsWith("//")) nameLink = "https:" + nameLink;
        else if (!nameLink.startsWith("http")) nameLink = "https://npino.com" + nameLink;

        const npi = npiElement.text().trim();
        let npiLink = npiElement.attr("href") || "";
        if (npiLink.startsWith("//")) npiLink = "https:" + npiLink;
        else if (!npiLink.startsWith("http")) npiLink = "https://npino.com" + npiLink;

        // Extract Address
        const addressText = $(el).find("b:contains('Address:')")[0];
        let address = "";
        if (addressText) {
          address = $(addressText.nextSibling).text().trim();
        }

        // Extract Phone
        const phoneText = $(el).find("b:contains('Phone:')")[0];
        let phone = "";
        if (phoneText) {
          phone = $(phoneText.nextSibling).text().trim();
        }

        // Extract Fax
        const faxText = $(el).find("b:contains('Fax:')")[0];
        let fax = "";
        if (faxText) {
          fax = $(faxText.nextSibling).text().trim();
        }

        providers.push({ name, nameLink, npi, npiLink, address, phone, fax });
      });

      if (providers.length === 0) {
        hasData = false;
      } else {
        allProviders = allProviders.concat(providers);
        page++;
      }
    }

    // Build HTML response
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
          </style>
        </head>
        <body>
          <h2>Providers in ${stateUrl}</h2>
          <p><b>Total Providers Detected:</b> ${allProviders.length}</p>
          <table>
            <thead>
              <tr>
                <th>Provider Name</th>
                <th>NPI Number</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Fax</th>
              </tr>
            </thead>
            <tbody>
    `;

    allProviders.forEach((p) => {
      html += `
        <tr>
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
        </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error scraping state:", error.message);
    res.status(500).send("Error scraping state: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
