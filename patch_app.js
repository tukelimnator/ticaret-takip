const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Add DOM ref for toggle
code = code.replace(
  "const addCardForm    = $('add-card-form');",
  "const addCardForm    = $('add-card-form');\nconst toggleAddCardBtn = $('toggle-add-card-btn');"
);

// Toggle UI logic
code = code.replace(
  "cardsCloseBtn.addEventListener('click', () => cardsModal.classList.remove('open'));",
  "cardsCloseBtn.addEventListener('click', () => cardsModal.classList.remove('open'));\n\ntoggleAddCardBtn.addEventListener('click', () => {\n  const isHidden = addCardForm.style.display === 'none';\n  addCardForm.style.display = isHidden ? 'flex' : 'none';\n  toggleAddCardBtn.innerHTML = isHidden \n    ? `<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M18 15l-6-6-6 6\"/></svg> Kapat`\n    : `<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 5v14M5 12h14\"/></svg> Yeni Kart Ekle`;\n});"
);

// Update calculateCardsUsage to store expenses
code = code.replace(
  /function calculateCardsUsage\(\) \{[\s\S]*?\}\n\nfunction updateCardSelects\(\)/m,
  `function calculateCardsUsage() {
  cards.forEach(c => {
    c.used = 0;
    c.expenses = [];
  });
  trips.forEach(t => {
    const tDate = t.date;
    if (t.flightCard) {
      const c = cards.find(x => x.id === t.flightCard);
      if (c && t.flight > 0) {
        c.used += t.flight;
        c.expenses.push({ tripId: t.id, date: tDate, desc: 'Uçak Bileti', amount: t.flight });
      }
    }
    if (t.hotelCard) {
      const c = cards.find(x => x.id === t.hotelCard);
      if (c && t.hotel > 0) {
        c.used += t.hotel;
        c.expenses.push({ tripId: t.id, date: tDate, desc: 'Konaklama', amount: t.hotel });
      }
    }
    t.products.forEach(p => {
      if (p.cardId) {
        const c = cards.find(x => x.id === p.cardId);
        const cost = p.qty * p.purchase;
        if (c && cost > 0) {
          c.used += cost;
          c.expenses.push({ tripId: t.id, date: tDate, desc: p.name + (p.qty > 1 ? ' (x'+p.qty+')' : ''), amount: cost });
        }
      }
    });
  });
}

function updateCardSelects()`
);

// Update renderCardsList
code = code.replace(
  /function renderCardsList\(\) \{[\s\S]*?\}\n\nfunction deleteCard\(id\)/m,
  `function renderCardsList() {
  calculateCardsUsage();
  cardsListEl.innerHTML = cards.map(c => {
    const limit = c.limit || 1;
    const used = c.used || 0;
    const isOverLimit = used > limit;
    let pct = (used / limit) * 100;
    if (pct > 100) pct = 100;
    
    const barCls = pct > 90 ? 'danger' : pct > 75 ? 'warn' : 'safe';
    const statusHtml = isOverLimit 
      ? \`<div style="font-size:0.75rem;font-weight:700;color:var(--red-600);background:var(--red-100);padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;">YETERSİZ LİMİT (Aşılan: $\${Math.round(used - limit).toLocaleString('en-US')})</div>\`
      : \`<div style="font-size:0.75rem;font-weight:700;color:var(--green-700);background:var(--green-100);padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;">YETERLİ (Kalan: $\${Math.round(limit - used).toLocaleString('en-US')})</div>\`;
    
    let expensesHtml = '<div style="font-size:0.7rem;color:var(--text-muted);padding:.5rem 0;">Henüz bu karta atanan harcama yok.</div>';
    if (c.expenses && c.expenses.length > 0) {
      expensesHtml = '<ul style="list-style:none;padding:0;margin:0.5rem 0;font-size:0.75rem;">' + 
        c.expenses.map(exp => \`
          <li style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-color);">
            <span style="color:var(--text-secondary)">\${fmtDate(exp.date)} - \${escape(exp.desc)}</span>
            <span style="font-weight:600;color:var(--text-primary);">$\${fmt(exp.amount)}</span>
          </li>
        \`).join('') +
      '</ul>';
    }

    return \`
      <div class="card-item" style="display:flex;flex-direction:column;gap:0.4rem;">
        <div class="card-item-header" style="margin-bottom:0;">
          <div>
            <span class="card-name" style="font-size:1rem;">\${escape(c.name)}</span>
            \${c.dueDate ? \`<span style="font-size:0.7rem;color:var(--text-muted);margin-left:8px;">📅 Hesap Kesim: Ayın \${c.dueDate}'i</span>\` : ''}
          </div>
          <button class="card-delete-btn" onclick="deleteCard(\${c.id})" title="Kartı Sil" style="padding:4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        \${expensesHtml}
        
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-top:0.5rem;">
          <span style="color:var(--text-secondary)">Kullanılan: $\${Math.round(used).toLocaleString('en-US')}</span>
          <span style="font-weight:700">Limit: $\${Math.round(limit).toLocaleString('en-US')}</span>
        </div>
        <div class="card-progress-wrap" style="margin-bottom:0;">
          <div class="card-progress \${barCls}" style="width:\${pct}%"></div>
        </div>
        \${statusHtml}
      </div>
    \`;
  }).join('') || '<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:1rem;">Henüz kart eklenmedi.</div>';
}

function deleteCard(id)`
);

// Close form on submit
code = code.replace(
  "renderCardsList();\n});",
  "renderCardsList();\n  addCardForm.style.display = 'none';\n  toggleAddCardBtn.innerHTML = `<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 5v14M5 12h14\"/></svg> Yeni Kart Ekle`;\n});"
);

fs.writeFileSync('app.js', code, 'utf8');
console.log('App patched.');
