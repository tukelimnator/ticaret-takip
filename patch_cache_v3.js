const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Add cache busting query params
html = html.replace('href="style.css?v=2"', 'href="style.css?v=3"');
html = html.replace('src="app.js?v=2"', 'src="app.js?v=3"');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Cache busting v3 applied.');
