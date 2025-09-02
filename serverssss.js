const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { Parser } = require("json2csv");

const app = express();
const PORT = 3000;

// Helper functions
function normalizeUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (!url.startsWith("http")) return "https://npino.com" + url;
  return url;
}

function textAfterBold($, el, boldText) {
  let text = "";
  $(el)
    .find("b")
    .each((_, b) => {
      if ($(b).text().trim().includes(boldText)) {
        text = $(b)[0].nextSibling ? $(b)[0].nextSibling.nodeValue.trim() : "";
      }
    });
  return text;
}

// Serve scraping page with SSE and CSV download
app.get("/state", async (req, res) => {
  const stateUrl = req.query.url;
  if (!stateUrl) return res.send("Please provide ?url=");

  // Serve HTML page first
  if (!req.query.stream) {
    return res.send(`
      <html>
      <head>
        <title>Scraping Providers</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          .progress { width: 100%; background: #f3f3f3; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; margin-top: 20px; }
          .bar { height: 30px; width: 0; background-color: #08326B; color: white; text-align: center; line-height: 30px; }
          button { margin-top: 20px; padding: 10px 20px; background: #08326B; color: white; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Scraping Providers from ${stateUrl}</h2>
        <div class="progress">
          <div class="bar" id="bar">0</div>
        </div>
        <ul id="list"></ul>
        <button id="download" style="display:none;">Download CSV</button>
        <script>
          let providersData = [];
          const evtSource = new EventSource("/state?stream=1&url=${encodeURIComponent(stateUrl)}");
          const bar = document.getElementById("bar");
          const list = document.getElementById("list");
          const downloadBtn = document.getElementById("download");

          evtSource.onmessage = function(e) {
            const data = JSON.parse(e.data);
            if(data.done) {
              bar.textContent = "Scraping complete: " + data.total + " providers";
              downloadBtn.style.display = "inline-block";
              providersData = data.allProviders;
              evtSource.close();
              return;
            }
            if(data.provider) {
              providersData.push(data.provider);
              const li = document.createElement("li");
              li.innerHTML = '<a href="'+data.provider.nameLink+'" target="_blank">'+data.provider.name+'</a> | NPI: <a href="'+data.provider.npiLink+'" target="_blank">'+data.provider.npi+'</a>';
              list.appendChild(li);
            }
            bar.style.width = (data.total / data.totalExpected * 100) + "%";
            bar.textContent = data.total + " providers scraped";
          };

          downloadBtn.onclick = function() {
            const csvContent = "data:text/csv;charset=utf-8," 
              + ["No,Name,Name Link,NPI,NPI Link,Address,Phone,Fax"].join(",") + "\\n"
              + providersData.map((p,i) => {
                return [
                  i+1,
                  p.name,
                  p.nameLink,
                  p.npi,
                  p.npiLink,
                  p.address,
                  p.phone,
                  p.fax
                ].map(v => '"'+v.replace(/"/g,'""')+'"').join(",");
              }).join("\\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "providers.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
        </script>
      </body>
      </html>
    `);
  }

  // SSE streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let page = 1;
  let allProviders = [];
  let totalExpected = 1000; // Optional, dynamic update is possible

  while (true) {
    const url = `${stateUrl}${stateUrl.includes("?") ? "&" : "?"}page=${page}`;
    console.log(`Scraping: ${url}`);

    let response;
    try {
      response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      if (err.response && err.response.status === 404) break;
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      break;
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

      const provider = { name, nameLink, npi, npiLink, address, phone, fax };
      providers.push(provider);

      // Send provider update
      res.write(`data: ${JSON.stringify({ provider, total: allProviders.length + 1, totalExpected })}\n\n`);
    });

    if (providers.length === 0) break;

    allProviders.push(...providers);
    page++;
  }

  // Final completion message
  res.write(`data: ${JSON.stringify({ done: true, total: allProviders.length, allProviders })}\n\n`);
  res.end();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
