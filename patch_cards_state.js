const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

// 1. Add variables
if (!js.includes('let cards = [];')) {
  js = js.replace(
    `let nextRowId     = 1;`,
    `let nextRowId     = 1;\n\n// Cards state\nlet cards         = [];\nlet nextCardId    = 1;`
  );
}

// 2. Update saveToStorage
js = js.replace(
  `localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, nextTripId, nextProdId, colorIndex }));`,
  `localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, nextTripId, nextProdId, colorIndex, cards, nextCardId }));`
);

// 3. Update loadFromStorage
js = js.replace(
  `colorIndex  = d.colorIndex || 0;`,
  `colorIndex  = d.colorIndex || 0;\n    cards       = d.cards || [];\n    nextCardId  = d.nextCardId || 1;`
);

js = js.replace(
  `trips = []; nextTripId = 1; nextProdId = 1; colorIndex = 0;`,
  `trips = []; nextTripId = 1; nextProdId = 1; colorIndex = 0; cards = []; nextCardId = 1;`
);

fs.writeFileSync('app.js', js, 'utf8');
console.log('Cards state patched successfully.');
