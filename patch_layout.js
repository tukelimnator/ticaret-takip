const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
  `<button id="manage-cards-btn" class="manage-cards-btn" aria-label="Kredi Kartlarımı Yönet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            Kartlarım
          </button>`,
  `
          <nav class="app-tabs-nav" aria-label="Ana Menü">
            <button class="tab-btn active" data-target="tab-trips">✈️ Seferler</button>
            <button class="tab-btn" data-target="tab-cards">💳 Kartlarım</button>
          </nav>`
);

html = html.replace(
  `<!-- ===== KPI STATS ===== -->`,
  `<div class="tab-pane active" id="tab-trips">\n    <!-- ===== KPI STATS ===== -->`
);

const cardsModalRegex = /<!-- ===== CARDS MODAL ===== -->\s*<div class="modal-overlay" id="cards-modal"[^>]*>[\s\S]*?<div class="modal-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/;
const cardsMatch = html.match(cardsModalRegex);
if (cardsMatch) {
  const cardsBody = cardsMatch[1];
  html = html.replace(
    `</main>`,
    `</div>\n\n    <!-- ===== CARDS TAB ===== -->\n    <div class="tab-pane" id="tab-cards">\n      <section class="card">\n        <div class="card-header">\n          <h2 class="card-title">Kredi Kartlarım & Limit Takibi</h2>\n        </div>\n        <div class="card-body">\n${cardsBody}\n        </div>\n      </section>\n    </div>\n\n  </main>`
  );
  html = html.replace(cardsModalRegex, '');
} else {
  console.log('Cards modal not found in index.html!');
}

html = html.replace(
  `<span class="col-price">Birim Alış ($)</span>`,
  `<span class="col-price">Birim Alış ($)</span>\n            <span class="col-card" style="flex:1">Kredi Kartı</span>`
);

fs.writeFileSync('index.html', html, 'utf8');

// 2. Update style.css
let css = fs.readFileSync('style.css', 'utf8');
css += `
/* ---- 23. TABS ---- */
.app-tabs-nav {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-card);
  padding: 0.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
.tab-btn {
  background: transparent;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab-btn:hover {
  background: var(--bg-body);
  color: var(--text-primary);
}
.tab-btn.active {
  background: var(--blue-500);
  color: #fff;
}
.tab-pane {
  display: none;
  animation: fadeIn 0.3s ease-out;
}
.tab-pane.active {
  display: block;
}
.card-body {
  padding: 1.5rem;
}
.cards-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}
.col-card-field {
  flex: 1;
  min-width: 90px;
}
`;
fs.writeFileSync('style.css', css, 'utf8');

// 3. Update app.js
let js = fs.readFileSync('app.js', 'utf8');

js = js.replace(
  "const manageCardsBtn = $('manage-cards-btn');\nconst cardsModal     = $('cards-modal');\nconst cardsCloseBtn  = $('cards-close-btn');",
  "// const manageCardsBtn = $('manage-cards-btn');\n// const cardsModal     = $('cards-modal');\n// const cardsCloseBtn  = $('cards-close-btn');\nconst tabBtns = document.querySelectorAll('.tab-btn');\nconst tabPanes = document.querySelectorAll('.tab-pane');"
);

js = js.replace(
  /manageCardsBtn\.addEventListener\('click', \(\) => {[\s\S]*?cardsCloseBtn\.addEventListener\('click', \(\) => cardsModal\.classList\.remove\('open'\)\);/,
  `tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
    if (btn.dataset.target === 'tab-cards') {
      renderCardsList();
    }
  });
});`
);

js = js.replace(
  `<div class="col-sale-field">`,
  `<div class="col-card-field">
      <select class="form-input prod-card" aria-label="Ürün \${rowIndex} için kart" onchange="syncRowState(\${rowId}, this.closest('.product-form-row'))">
        <option value="">Kart...</option>
      </select>
    </div>
    <div class="col-sale-field">`
);

js = js.replace(
  `rowState.sale     = num(div.querySelector('.prod-sale').value);`,
  `rowState.sale     = num(div.querySelector('.prod-sale').value);\n  const cardSel = div.querySelector('.prod-card');\n  if (cardSel) rowState.cardId = parseInt(cardSel.value, 10) || null;`
);

js = js.replace(
  `// Populate product rows`,
  `updateCardSelects(); // Ensure options exist before setting values\n  // Populate product rows`
);

js = js.replace(
  `formProducts = trip.products.map(p => ({
    rowId:    nextRowId++,
    name:     p.name,
    qty:      p.qty,
    purchase: p.purchase,
    sale:     p.sale,
    cardId:   p.cardId,
  }));`,
  `formProducts = trip.products.map(p => ({
    rowId:    nextRowId++,
    name:     p.name,
    qty:      p.qty,
    purchase: p.purchase,
    sale:     p.sale,
    cardId:   p.cardId,
  }));
  setTimeout(() => {
    document.querySelectorAll('.product-form-row').forEach((div, i) => {
      const p = trip.products[i];
      const sel = div.querySelector('.prod-card');
      if (sel && p.cardId) sel.value = p.cardId;
    });
  }, 10);`
);

js = js.replace(
  `addFormProductRow();`,
  `addFormProductRow();\n  updateCardSelects();`
);

js = js.replace(
  `if (dates.length >= 1) {
    chartCard.style.display = '';
    const show2 = dates.length >= 2;
    chartEmpty.style.display  = show2 ? 'none' : '';
    chartCanvas.style.display = show2 ? '' : 'none';`,
  `if (dates.length >= 1) {
    chartCard.style.display = '';
    const show2 = dates.length >= 1; 
    chartEmpty.style.display  = show2 ? 'none' : '';
    chartCanvas.style.display = show2 ? '' : 'none';`
);

js = js.replace(
  `if (dates.length < 2) return;`,
  `if (dates.length < 1) return;`
);

js = js.replace(
  `const isHov = i===chartHoverIdx;`,
  `let x = PAD.left + step*i + step/2 - barW/2;\n    if (n === 1) x = PAD.left + cW/2 - barW/2;\n    const isHov = i===chartHoverIdx;`
);

js = js.replace(
  `const x    = PAD.left + step*i + step/2 - barW/2;`,
  ``
);

fs.writeFileSync('app.js', js, 'utf8');
console.log('Patch complete.');
