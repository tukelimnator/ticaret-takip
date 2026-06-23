const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Add cards state
code = code.replace(
  'let formProducts = []; // Array of { rowId, name, qty, purchase, sale }',
  'let formProducts = [];\nlet cards = JSON.parse(localStorage.getItem(\'ticaret-takip-cards\')) || [];\nlet nextCardId = parseInt(localStorage.getItem(\'ticaret-takip-card-id\'), 10) || 1;'
);

// 2. Add DOM refs
code = code.replace(
  'const btnDaily      = $(\'btn-daily\');\nconst btnCumulative = $(\'btn-cumulative\');',
  `const btnDaily      = $('btn-daily');
const btnCumulative = $('btn-cumulative');
const manageCardsBtn = $('manage-cards-btn');
const cardsModal     = $('cards-modal');
const cardsCloseBtn  = $('cards-close-btn');
const addCardForm    = $('add-card-form');
const cardsListEl    = $('cards-list');
const flightCardSel  = $('flight-card');
const hotelCardSel   = $('hotel-card');`
);

// 3. Add to saveToStorage
code = code.replace(
  "localStorage.setItem('ticaret-takip-v4-id', nextTripId.toString());",
  "localStorage.setItem('ticaret-takip-v4-id', nextTripId.toString());\n    localStorage.setItem('ticaret-takip-cards', JSON.stringify(cards));\n    localStorage.setItem('ticaret-takip-card-id', nextCardId.toString());"
);

// 4. Add select to product HTML
code = code.replace(
  `<div class="form-group">\n        <label class="form-label">Adet</label>`,
  `<div class="form-group">\n        <label class="form-label">Kart</label>\n        <select class="card-select prod-card form-input" style="padding:.5rem;">\n          <option value="">Seçilmedi</option>\n          \${cards.map(c => \`<option value="\${c.id}" \${data.cardId == c.id ? 'selected' : ''}>\${escape(c.name)}</option>\`).join('')}\n        </select>\n      </div>\n      <div class="form-group">\n        <label class="form-label">Adet</label>`
);

// 5. Add cardId to syncRowState
code = code.replace(
  "const sale = num(rowEl.querySelector('.prod-sale').value);",
  "const sale = num(rowEl.querySelector('.prod-sale').value);\n  const cardId = parseInt(rowEl.querySelector('.prod-card').value, 10) || null;"
);
code = code.replace(
  "{ rowId, name, qty, purchase, sale }",
  "{ rowId, name, qty, purchase, sale, cardId }"
);

// 6. Add to addFormProductRow
code = code.replace(
  "purchase: data.purchase||0, sale: data.sale||0 });",
  "purchase: data.purchase||0, sale: data.sale||0, cardId: data.cardId||null });"
);

// 7. Extract flight/hotel cards in submit
code = code.replace(
  "const notes  = fieldNotes.value.trim();",
  "const notes  = fieldNotes.value.trim();\n  const flightCard = parseInt(flightCardSel.value, 10) || null;\n  const hotelCard  = parseInt(hotelCardSel.value, 10) || null;"
);

// 8. Add to products map in submit
code = code.replace(
  "sale: r.sale,",
  "sale: r.sale,\n    cardId: r.cardId,"
);

// 9. Add to trips update
code = code.replace(
  "{ ...trips[idx], date: fieldDate.value, flight, hotel, notes, products, grossNet, net };",
  "{ ...trips[idx], date: fieldDate.value, flight, hotel, flightCard, hotelCard, notes, products, grossNet, net };"
);
code = code.replace(
  "flight, hotel, notes,",
  "flight, hotel, flightCard, hotelCard, notes,"
);

// 10. Enter/exit edit mode
code = code.replace(
  "fieldNotes.value  = trip.notes || '';",
  "fieldNotes.value  = trip.notes || '';\n  flightCardSel.value = trip.flightCard || '';\n  hotelCardSel.value  = trip.hotelCard || '';"
);
code = code.replace(
  "sale:     p.sale,",
  "sale:     p.sale,\n    cardId:   p.cardId,"
);

// 11. Reset
code = code.replace(
  "fieldNotes.value  = '';",
  "fieldNotes.value  = '';\n  flightCardSel.value = '';\n  hotelCardSel.value = '';"
);

// 12. Render sub-row card badge
code = code.replace(
  "const pnetStr = pnet===0 ? '\\$0.00' : `\${isPpos?'+':'-'}\${fmt(Math.abs(pnet))}`;",
  "const pnetStr = pnet===0 ? '\\$0.00' : `\${isPpos?'+':'-'}\${fmt(Math.abs(pnet))}`;\n          const c = cards.find(x => x.id === p.cardId);\n          const cBadge = c ? ` <span class=\"pts-chip\" style=\"font-size:0.55rem;background:var(--bg-tag);margin-left:4px;\" title=\"Kart: \${escape(c.name)}\">💳</span>` : '';"
);
code = code.replace(
  "<div class=\"td-content\">\${escape(p.name)}</div>",
  "<div class=\"td-content\">\${escape(p.name)}\${cBadge}</div>"
);

// 13. Append card logic at the end
code += `

// ============================================================
// Credit Cards Logic
// ============================================================

function calculateCardsUsage() {
  cards.forEach(c => c.used = 0);
  trips.forEach(t => {
    if (t.flightCard) { const c = cards.find(x => x.id === t.flightCard); if (c) c.used += t.flight; }
    if (t.hotelCard) { const c = cards.find(x => x.id === t.hotelCard); if (c) c.used += t.hotel; }
    t.products.forEach(p => {
      if (p.cardId) { const c = cards.find(x => x.id === p.cardId); if (c) c.used += (p.qty * p.purchase); }
    });
  });
}

function updateCardSelects() {
  const html = '<option value="">Kart Seçilmedi</option>' + 
               cards.map(c => \`<option value="\${c.id}">\${escape(c.name)}</option>\`).join('');
  
  const savedF = flightCardSel.value;
  const savedH = hotelCardSel.value;
  
  flightCardSel.innerHTML = html;
  hotelCardSel.innerHTML = html;
  
  flightCardSel.value = savedF;
  hotelCardSel.value = savedH;
  
  document.querySelectorAll('.prod-card').forEach(select => {
    const saved = select.value;
    select.innerHTML = html;
    select.value = saved;
  });
}

function renderCardsList() {
  calculateCardsUsage();
  cardsListEl.innerHTML = cards.map(c => {
    const limit = c.limit || 1;
    const used = c.used || 0;
    let pct = (used / limit) * 100;
    if (pct > 100) pct = 100;
    
    const cls = pct > 90 ? 'danger' : pct > 75 ? 'warn' : 'safe';
    
    return \`
      <div class="card-item">
        <div class="card-item-header">
          <span class="card-name">\${escape(c.name)}</span>
          <span class="card-limits">$\${Math.round(used).toLocaleString('en-US')} / $\${Math.round(limit).toLocaleString('en-US')}</span>
        </div>
        <div class="card-progress-wrap">
          <div class="card-progress \${cls}" style="width:\${pct}%"></div>
        </div>
        <div class="card-actions">
          <button class="card-delete-btn" onclick="deleteCard(\${c.id})">Sil</button>
        </div>
      </div>
    \`;
  }).join('') || '<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:1rem;">Henüz kart eklenmedi.</div>';
}

function deleteCard(id) {
  if (!confirm('Bu kartı silmek istediğinize emin misiniz?')) return;
  cards = cards.filter(c => c.id !== id);
  // Remove references in trips
  trips.forEach(t => {
    if (t.flightCard === id) t.flightCard = null;
    if (t.hotelCard === id) t.hotelCard = null;
    t.products.forEach(p => { if (p.cardId === id) p.cardId = null; });
  });
  saveToStorage();
  updateCardSelects();
  renderCardsList();
  renderAll(); // Rerender table to clear badges
}

addCardForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = $('new-card-name').value.trim();
  const limit = parseInt($('new-card-limit').value, 10);
  if (!name || limit <= 0) return;
  
  cards.push({ id: nextCardId++, name, limit, used: 0 });
  saveToStorage();
  $('new-card-name').value = '';
  $('new-card-limit').value = '';
  
  updateCardSelects();
  renderCardsList();
});

manageCardsBtn.addEventListener('click', () => {
  renderCardsList();
  cardsModal.classList.add('open');
});
cardsCloseBtn.addEventListener('click', () => cardsModal.classList.remove('open'));

// Hook into initial render
const origRenderAll = renderAll;
renderAll = function() {
  origRenderAll();
  updateCardSelects();
};
`;

fs.writeFileSync('app.js', code, 'utf8');
console.log('App.js patched successfully!');
