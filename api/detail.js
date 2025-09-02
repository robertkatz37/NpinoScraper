import axios from "axios";
import cheerio from "cheerio";

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("URL query param is required");

  try {
    const fullUrl = url.startsWith("http") ? url : `https:${url}`;
    const response = await axios.get(fullUrl);
    const $ = cheerio.load(response.data);

    // Example: scrape name, address, phone (adjust selectors)
    const name = $("h1").first().text();
    const details = $(".panel-body").text();

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${name}</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <h1>${name}</h1>
        <pre>${details}</pre>
        <a href="/">Go Back</a>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err.message);
    res.status(500).send(`<h1>Internal Server Error</h1><p>${err.message}</p>`);
  }
}
