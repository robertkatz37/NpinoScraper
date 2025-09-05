const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = 3000;

// Serve static files for assets
app.use('/static', express.static('public'));

// Helper to fetch and parse HTML
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

// Common CSS and JS for all pages
const getCommonStyles = () => `
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: #4f46e5;
      --primary-dark: #3730a3;
      --secondary-color: #06b6d4;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --dark-color: #1f2937;
      --light-color: #f8fafc;
      --border-radius: 12px;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      line-height: 1.6;
    }

    .main-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-xl);
      margin: 2rem auto;
      max-width: 1400px;
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="%23ffffff" stop-opacity="0.1"/><stop offset="1" stop-color="%23ffffff" stop-opacity="0"/></linearGradient></defs><rect width="11" height="20" fill="url(%23a)"/><rect x="20" width="11" height="20" fill="url(%23a)"/></svg>') repeat-x;
      opacity: 0.1;
    }

    .header h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      position: relative;
      z-index: 1;
    }

    .header .subtitle {
      font-size: 1.2rem;
      opacity: 0.9;
      position: relative;
      z-index: 1;
    }

    .breadcrumb-modern {
      background: var(--light-color);
      padding: 1rem 2rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .breadcrumb-modern a {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }

    .breadcrumb-modern a:hover {
      color: var(--primary-dark);
    }

    .content-section {
      padding: 3rem 2rem;
    }

    .section-title {
      font-size: 2rem;
      font-weight: 600;
      color: var(--dark-color);
      margin-bottom: 2rem;
      text-align: center;
      position: relative;
    }

    .section-title::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
      border-radius: 2px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .category-card, .state-card {
      background: white;
      border-radius: var(--border-radius);
      padding: 2rem;
      text-align: center;
      box-shadow: var(--shadow-md);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      color: var(--dark-color);
      border: 2px solid transparent;
      position: relative;
      overflow: hidden;
    }

    .category-card::before, .state-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }

    .category-card:hover, .state-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--shadow-xl);
      text-decoration: none;
      color: var(--dark-color);
      border-color: var(--primary-color);
    }

    .category-card:hover::before, .state-card:hover::before {
      transform: scaleX(1);
    }

    .card-icon {
      font-size: 2.5rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .card-description {
      font-size: 0.9rem;
      color: #6b7280;
    }

    .loading-spinner {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--primary-color);
      color: white;
      border-radius: var(--border-radius);
      font-weight: 500;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .stats-bar {
      background: var(--light-color);
      padding: 1.5rem 2rem;
      border-radius: var(--border-radius);
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat-number {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary-color);
    }

    .stat-label {
      color: #6b7280;
      font-weight: 500;
    }

    .btn-modern {
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: var(--border-radius);
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .btn-modern:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      color: white;
      text-decoration: none;
    }

    .btn-secondary {
      background: white;
      color: var(--primary-color);
      border: 2px solid var(--primary-color);
    }

    .btn-secondary:hover {
      background: var(--primary-color);
      color: white;
    }

    .table-container {
      background: white;
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }

    .table-modern {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }

    .table-modern thead {
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      color: white;
    }

    .table-modern th {
      padding: 1rem;
      font-weight: 600;
      text-align: left;
      border: none;
    }

    .table-modern td {
      padding: 1rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      vertical-align: middle;
    }

    .table-modern tbody tr:hover {
      background-color: var(--light-color);
    }

    .table-modern a {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
    }

    .table-modern a:hover {
      color: var(--primary-dark);
      text-decoration: underline;
    }

    .footer {
      background: var(--dark-color);
      color: white;
      padding: 2rem;
      text-align: center;
      margin-top: 3rem;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }
      
      .card-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }
      
      .category-card, .state-card {
        padding: 1.5rem;
      }
      
      .content-section {
        padding: 2rem 1rem;
      }
      
      .stats-bar {
        flex-direction: column;
        text-align: center;
      }

      .table-modern {
        font-size: 0.875rem;
      }

      .table-modern th,
      .table-modern td {
        padding: 0.75rem 0.5rem;
      }
    }

    .fade-in {
      animation: fadeIn 0.6s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .slide-in {
      animation: slideIn 0.8s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  </style>`;

const getCommonScripts = () => `
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Add loading states and smooth transitions
    document.addEventListener('DOMContentLoaded', function() {
      // Add fade-in animation to cards
      const cards = document.querySelectorAll('.category-card, .state-card');
      cards.forEach((card, index) => {
        card.style.animationDelay = (index * 0.1) + 's';
        card.classList.add('fade-in');
      });

      // Add loading state to navigation links
      document.querySelectorAll('a[href*="/category"], a[href*="/state"]').forEach(link => {
        link.addEventListener('click', function() {
          const loadingEl = document.createElement('div');
          loadingEl.className = 'loading-spinner position-fixed top-50 start-50 translate-middle';
          loadingEl.style.zIndex = '9999';
          loadingEl.innerHTML = '<div class="spinner"></div> Loading...';
          document.body.appendChild(loadingEl);
        });
      });
    });

    // CSV Download function
    function downloadCSV() {
      const csvContent = document.getElementById('csvData').textContent;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'healthcare_providers.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  </script>`;

// Homepage -> Scrape all categories
app.get("/", async (req, res) => {
  try {
    const $ = await fetchHTML("https://npino.com/");
    let sections = [];

    $(".panel-info").each((i, panel) => {
      const panelTitle = $(panel).find(".panel-heading .panel-title").text().trim();
      let items = [];

      $(panel).find(".panel-body a.question").each((j, link) => {
        const url = $(link).attr("href");
        const text = $(link).text().trim();

        if (text.toLowerCase() === "all doctors") {
          return;
        }

        if (url && text) {
          items.push({ text, url });
        }
      });

      if (panelTitle && items.length > 0) {
        sections.push({ title: panelTitle, items });
      }
    });

    // Category icons mapping
    const categoryIcons = {
      'doctors': 'fas fa-user-md',
      'dentist': 'fas fa-tooth',
      'hospital': 'fas fa-hospital',
      'pharmacy': 'fas fa-pills',
      'nurse': 'fas fa-user-nurse',
      'specialist': 'fas fa-stethoscope',
      'clinic': 'fas fa-clinic-medical',
      'default': 'fas fa-medical-kit'
    };

    const getIconForCategory = (title) => {
      const lowerTitle = title.toLowerCase();
      for (const [key, icon] of Object.entries(categoryIcons)) {
        if (lowerTitle.includes(key)) return icon;
      }
      return categoryIcons.default;
    };

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NPINO Healthcare Provider Directory</title>
  ${getCommonStyles()}
</head>
<body>
  <div class="main-container">
    <div class="header">
      <h1><i class="fas fa-heartbeat"></i> NPINO Healthcare Directory</h1>
      <p class="subtitle">Find healthcare providers across the United States</p>
    </div>
    
    <div class="content-section">
      <div class="stats-bar">
        <div class="stat-item">
          <i class="fas fa-layer-group text-primary"></i>
          <div>
            <div class="stat-number">${sections.length}</div>
            <div class="stat-label">Categories</div>
          </div>
        </div>
        <div class="stat-item">
          <i class="fas fa-database text-success"></i>
          <div>
            <div class="stat-number">${sections.reduce((sum, s) => sum + s.items.length, 0)}</div>
            <div class="stat-label">Provider Types</div>
          </div>
        </div>
        <div class="stat-item">
          <i class="fas fa-globe-americas text-info"></i>
          <div>
            <div class="stat-number">50+</div>
            <div class="stat-label">States Covered</div>
          </div>
        </div>
      </div>`;

    sections.forEach(section => {
      html += `
      <div class="mb-5">
        <h2 class="section-title">${section.title}</h2>
        <div class="card-grid">`;

      section.items.forEach(item => {
        const icon = getIconForCategory(item.text);
        html += `
          <a href="/category?url=${encodeURIComponent(item.url)}" class="category-card">
            <div class="card-icon">
              <i class="${icon}"></i>
            </div>
            <div class="card-title">${item.text}</div>
            <div class="card-description">Browse providers by state</div>
          </a>`;
      });

      html += `</div></div>`;
    });

    html += `
    </div>
    
    <div class="footer">
      <p><i class="fas fa-shield-alt"></i> Secure Healthcare Provider Directory | Data sourced from NPINO</p>
    </div>
  </div>
  
  ${getCommonScripts()}
</body>
</html>`;

    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <div class="alert alert-danger m-4">
        <h4><i class="fas fa-exclamation-triangle"></i> Error</h4>
        <p>Unable to load healthcare provider data: ${error.message}</p>
      </div>
    `);
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

    // Extract category name from URL for display
    const categoryName = categoryUrl.split('/').pop().replace(/[_-]/g, ' ').toUpperCase();

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${categoryName} - Select State | NPINO</title>
  ${getCommonStyles()}
</head>
<body>
  <div class="main-container">
    <div class="header">
      <h1><i class="fas fa-map-marked-alt"></i> Select State</h1>
      <p class="subtitle">Choose a state to find ${categoryName.toLowerCase()}</p>
    </div>
    
    <div class="breadcrumb-modern">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item"><a href="/"><i class="fas fa-home"></i> Home</a></li>
          <li class="breadcrumb-item active" aria-current="page">${categoryName}</li>
        </ol>
      </nav>
    </div>
    
    <div class="content-section">
      <div class="stats-bar">
        <div class="stat-item">
          <i class="fas fa-flag-usa text-primary"></i>
          <div>
            <div class="stat-number">${states.length}</div>
            <div class="stat-label">States Available</div>
          </div>
        </div>
        <div class="stat-item">
          <i class="fas fa-user-md text-success"></i>
          <div>
            <div class="stat-number">1000+</div>
            <div class="stat-label">Providers Expected</div>
          </div>
        </div>
      </div>
      
      <div class="card-grid">`;

    states.forEach((st, index) => {
      let stateUrl = normalizeUrl(st.url);
      html += `
        <a href="/state?url=${encodeURIComponent(stateUrl)}" class="state-card">
          <div class="card-icon">
            <i class="fas fa-map-marker-alt"></i>
          </div>
          <div class="card-title">${st.text}</div>
          <div class="card-description">View all providers</div>
        </a>`;
    });

    html += `
      </div>
    </div>
    
    <div class="footer">
      <p><i class="fas fa-shield-alt"></i> Secure Healthcare Provider Directory | Data sourced from NPINO</p>
    </div>
  </div>
  
  ${getCommonScripts()}
</body>
</html>`;

    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <div class="alert alert-danger m-4">
        <h4><i class="fas fa-exclamation-triangle"></i> Error</h4>
        <p>Unable to load state data: ${error.message}</p>
      </div>
    `);
  }
});

// Scrape all pages for a state
app.get("/state", async (req, res) => {
  try {
    const stateUrl = req.query.url;
    if (!stateUrl) return res.send("Please provide a valid ?url=");

    // Extract state name and category from URL for display
    const urlParts = stateUrl.split('/');
    const stateName = urlParts[urlParts.length - 1].replace(/[_-]/g, ' ').toUpperCase();
    const categoryName = urlParts[urlParts.length - 2].replace(/[_-]/g, ' ').toUpperCase();

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

    // Convert data to CSV
    const csvHeaders = ["#", "Provider Name", "NPI Number", "Address", "Phone", "Fax"];
    const csvRows = allProviders.map((p, index) => [
      index + 1,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.npi}"`,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${p.phone}"`,
      `"${p.fax}"`,
    ]);
    const csvContent = [csvHeaders.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

    // Build HTML
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${categoryName} in ${stateName} | NPINO</title>
  ${getCommonStyles()}
</head>
<body>
  <div class="main-container">
    <div class="header">
      <h1><i class="fas fa-list-alt"></i> Provider Directory</h1>
      <p class="subtitle">${categoryName} in ${stateName}</p>
    </div>
    
    <div class="breadcrumb-modern">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item"><a href="/"><i class="fas fa-home"></i> Home</a></li>
          <li class="breadcrumb-item"><a href="#" onclick="history.back()"><i class="fas fa-arrow-left"></i> ${categoryName}</a></li>
          <li class="breadcrumb-item active" aria-current="page">${stateName}</li>
        </ol>
      </nav>
    </div>
    
    <div class="content-section">
      <div class="stats-bar">
        <div class="stat-item">
          <i class="fas fa-users text-primary"></i>
          <div>
            <div class="stat-number">${allProviders.length}</div>
            <div class="stat-label">Total Providers</div>
          </div>
        </div>
        <div class="stat-item">
          <i class="fas fa-download text-success"></i>
          <button class="btn-modern" onclick="downloadCSV()">
            <i class="fas fa-file-csv"></i> Download CSV
          </button>
        </div>
        <div class="stat-item">
          <i class="fas fa-print text-info"></i>
          <button class="btn-modern btn-secondary" onclick="window.print()">
            <i class="fas fa-print"></i> Print List
          </button>
        </div>
      </div>
      
      <div class="table-container">
        <table class="table-modern">
          <thead>
            <tr>
              <th><i class="fas fa-hashtag"></i></th>
              <th><i class="fas fa-user-md"></i> Provider Name</th>
              <th><i class="fas fa-id-card"></i> NPI Number</th>
              <th><i class="fas fa-map-marker-alt"></i> Address</th>
              <th><i class="fas fa-phone"></i> Phone</th>
              <th><i class="fas fa-fax"></i> Fax</th>
            </tr>
          </thead>
          <tbody>`;

    allProviders.forEach((provider, index) => {
      html += `
            <tr>
              <td><strong>${index + 1}</strong></td>
              <td>
                ${provider.nameLink ? `<a href="${provider.nameLink}" target="_blank">${provider.name}</a>` : provider.name}
              </td>
              <td>
                ${provider.npiLink ? `<a href="${provider.npiLink}" target="_blank">${provider.npi}</a>` : provider.npi}
              </td>
              <td>${provider.address}</td>
              <td>
                ${provider.phone !== 'N/A' ? `<a href="tel:${provider.phone.replace(/\D/g, '')}">${provider.phone}</a>` : provider.phone}
              </td>
              <td>${provider.fax}</td>
            </tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Hidden CSV data for download -->
    <script type="text/plain" id="csvData">${csvContent}</script>
    
    <div class="footer">
      <p><i class="fas fa-shield-alt"></i> Secure Healthcare Provider Directory | Data sourced from NPINO</p>
    </div>
  </div>
  
  ${getCommonScripts()}
</body>
</html>`;

    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <div class="alert alert-danger m-4">
        <h4><i class="fas fa-exclamation-triangle"></i> Error</h4>
        <p>Unable to load provider data: ${error.message}</p>
        <p class="text-muted">Please try again or contact support if the issue persists.</p>
      </div>
    `);
  }
});

// API endpoint to get providers data as JSON
app.get("/api/providers", async (req, res) => {
  try {
    const stateUrl = req.query.url;
    if (!stateUrl) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    let page = 1;
    let allProviders = [];

    while (true) {
      const url = `${stateUrl}${stateUrl.includes("?") ? "&" : "?"}page=${page}`;
      console.log(`API Scraping: ${url}`);

      let response;
      try {
        response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          timeout: 30000,
        });
      } catch (err) {
        if (err.response && err.response.status === 404) {
          break;
        }
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

    res.json({
      success: true,
      total: allProviders.length,
      providers: allProviders,
      scrapedPages: page - 1
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).send(`
    <div class="container mt-5">
      <div class="alert alert-warning text-center">
        <h4><i class="fas fa-exclamation-triangle"></i> Page Not Found</h4>
        <p>The requested page could not be found.</p>
        <a href="/" class="btn btn-primary">
          <i class="fas fa-home"></i> Go to Homepage
        </a>
      </div>
    </div>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Healthcare Provider Directory running on http://localhost:${PORT}`);
  console.log(`📊 API endpoint available at http://localhost:${PORT}/api/providers?url=<state_url>`);
  console.log(`💚 Health check available at http://localhost:${PORT}/health`);
});