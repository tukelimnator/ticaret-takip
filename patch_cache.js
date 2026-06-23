const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Add cache busting query params
html = html.replace('href="style.css"', 'href="style.css?v=2"');
html = html.replace('src="app.js"', 'src="app.js?v=2"');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Cache busting applied.');
