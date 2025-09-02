export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Npino Scraper</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <h1>Welcome to Npino Scraper</h1>
      <form action="/category" method="get">
        <label>Enter Category URL:</label>
        <input type="text" name="url" placeholder="//npino.com/lookup/...">
        <button type="submit">Scrape Category</button>
      </form>
    </body>
    </html>
  `);
}
