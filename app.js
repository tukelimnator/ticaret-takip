/**
 * TicaretTakip — app.js  v4
 * Sefer bazlı çoklu ürün yönetimi (uçuş başına maks. 10 ürün)
 * + Dark Mode, Canvas Chart, CSV Export, LocalStorage
 */

'use strict';

// ============================================================
// Constants
// ============================================================
const STORAGE_KEY = 'ticaret-takip-v4';
const THEME_KEY   = 'ticaret-takip-theme';
const MAX_PRODUCTS = 10;

const COLORS = [
  'hsl(210,82%,56%)', 'hsl(240,70%,60%)', 'hsl(260,68%,58%)',
  'hsl(170,72%,40%)', 'hsl(190,75%,46%)', 'hsl(25,85%,55%)',
  'hsl(300,55%,55%)', 'hsl(45,90%,50%)',  'hsl(160,65%,42%)',
  'hsl(280,60%,58%)', 'hsl(200,80%,50%)', 'hsl(220,72%,52%)',
];

// ============================================================
// State
// ============================================================

/**
 * Trip data model:
 * {
 *   id: number,
 *   date: string,          // YYYY-MM-DD
 *   flight: number,        // $ shared expense
 *   hotel: number,         // $ shared expense
 *   notes: string,
 *   color: string,         // hsl(...)
 *   products: [
 *     { id: number, name: string, qty: number, purchase: number, sale: number }
 *   ],
 *   grossNet: number,      // Σ (sale-purchase)*qty
 *   net: number,           // grossNet - flight - hotel
 * }
 */
let trips        = [];
let nextTripId   = 1;
let nextProdId   = 1;
let colorIndex   = 0;
let editingId    = null;
let filterDate   = '';
let expandedIds  = new Set();  // expanded trip IDs in table
let allExpanded  = false;
let chartMode    = 'daily';
let chartHoverIdx = -1;
let chartAnimProg = 0;
let chartAnimReq  = null;

// Form product rows state
let formProducts  = [];    // [{ rowId, name, qty, purchase, sale, cardId }]
let nextRowId     = 1;

// ============================================================
// DOM refs
// ============================================================
const $ = id => document.getElementById(id);
const html = document.documentElement;

const form          = $('trade-form');
const resetBtn      = $('reset-btn');
const cancelEditBtn = $('cancel-edit-btn');
const clearAllBtn   = $('clear-all-btn');
const exportBtn     = $('export-btn');
const expandAllBtn  = $('expand-all-btn');
const submitBtn     = $('submit-btn');
const submitLabel   = $('submit-label');
const submitIcon    = $('submit-icon');
const formCard      = document.querySelector('.form-card');
const themeToggle   = $('theme-toggle');

const emptyState     = $('empty-state');
const noResultsState = $('no-results-state');
const noResultsDate  = $('no-results-date');
const tableWrapper   = $('table-wrapper');
const summaryFooter  = $('summary-footer');
const tradesTbody   = $('trades-tbody');
const toast         = $('toast');
const statsRow      = $('stats-row');
const filterGroup   = $('filter-group');
const filterDateEl  = $('filter-date');
const clearFilterBtn = $('clear-filter-btn');
const chartCard     = $('chart-card');
const chartCanvas   = $('profit-chart');
const chartTooltip  = $('chart-tooltip');
const chartEmpty    = $('chart-empty');
const btnDaily      = $('btn-daily');
const btnCumulative = $('btn-cumulative');
const manageCardsBtn = $('manage-cards-btn');
const cardsModal     = $('cards-modal');
const cardsCloseBtn  = $('cards-close-btn');
const addCardForm    = $('add-card-form');
const cardsListEl    = $('cards-list');
const flightCardSel  = $('flight-card');
const hotelCardSel   = $('hotel-card');
const storageInfo   = $('storage-info');
const productHistory = $('product-history');
const addProductBtn = $('add-product-row-btn');
const productRowsContainer = $('product-rows-container');
const productCountBadge    = $('product-count-badge');

const fieldDate   = $('trade-date');
const fieldFlight = $('flight-cost');
const fieldHotel  = $('hotel-cost');
const fieldNotes  = $('trade-notes');
const notesCount  = $('notes-count');

const prevExpenses    = $('prev-expenses');
const prevGrossNet    = $('prev-gross-net');
const prevProductCount = $('prev-product-count');
const previewNetTotal = $('preview-net-total');

const totalCount       = $('total-count');
const totalProductsEl  = $('total-products');
const headerTotalSales = $('header-total-sales');
const headerNetProfit  = $('header-net-profit');
const totalSalesEl     = $('total-sales');
const totalExpensesEl  = $('total-expenses');
const dailyNetProfitEl = $('daily-net-profit');
const netProfitLabel   = $('net-profit-label');
const kpiBestVal       = $('kpi-best-val');
const kpiBestName      = $('kpi-best-name');
const kpiWorstVal      = $('kpi-worst-val');
const kpiWorstName     = $('kpi-worst-name');
const kpiAvgVal        = $('kpi-avg-val');
const kpiAvgSub        = $('kpi-avg-sub');
const kpiRatioVal      = $('kpi-ratio-val');
const kpiRatioSub      = $('kpi-ratio-sub');
const chartLegend      = $('chart-legend');

// ============================================================
// Theme
// ============================================================
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  html.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  if (trips.length) drawChart();
}
themeToggle.addEventListener('click', toggleTheme);

// ============================================================
// Helpers
// ============================================================
const fmt    = v => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtN   = v => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtDate = s => { if (!s) return '—'; const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`; };
const num    = v => { const n=parseFloat(v); return isNaN(n)?0:n; };
const qnum   = v => { const n=parseInt(v,10); return (!n||n<1)?1:n; };
const sign   = v => v<0?'−':v>0?'+':'';
const escape = s => { const d=document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; };
const ease   = t => 1 - Math.pow(1-t, 3);
const nextColor = () => { const c=COLORS[colorIndex%COLORS.length]; colorIndex++; return c; };

let toastTimer;
function showToast(msg, type='success') {
  toast.textContent = msg;
  toast.className   = `toast ${type} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className='toast'; }, 3500);
}

// ============================================================
// Calculations
// ============================================================
function calcTrip(products, flight, hotel) {
  const grossNet = products.reduce((s,p) => s + (p.sale - p.purchase) * p.qty, 0);
  const net      = grossNet - flight - hotel;
  const totalSale = products.reduce((s,p) => s + p.sale * p.qty, 0);
  const margin   = totalSale > 0 ? (net / totalSale) * 100 : 0;
  return { grossNet, net, margin, totalSale };
}

function calcProductNet(p) {
  return (p.sale - p.purchase) * p.qty;
}

function marginClass(m) {
  if (m >= 20) return 'good';
  if (m >= 5)  return 'ok';
  if (m >= 0)  return 'low';
  return 'negative';
}

// ============================================================
// Storage
// ============================================================
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, nextTripId, nextProdId, colorIndex }));
    updateStorageInfo();
  } catch(e) { console.warn('LocalStorage write error:', e); }
}

function loadFromStorage() {
  try {
    // Migrate from v3 (individual trades) if found
    const oldRaw = localStorage.getItem('ticaret-takip-v3');
    if (oldRaw && !localStorage.getItem(STORAGE_KEY)) {
      const old = JSON.parse(oldRaw);
      if (old.trades && old.trades.length) {
        trips = old.trades.map(t => ({
          id: t.id,
          date: t.date,
          flight: t.flight || 0,
          hotel:  t.hotel  || 0,
          notes:  t.notes  || '',
          color:  t.color,
          products: [{
            id: 1,
            name: t.product,
            qty:  t.qty || 1,
            purchase: t.purchase,
            sale: t.sale,
          }],
          grossNet: 0, net: 0,
        }));
        trips.forEach(trip => {
          const { grossNet, net } = calcTrip(trip.products, trip.flight, trip.hotel);
          trip.grossNet = grossNet;
          trip.net      = net;
        });
        nextTripId  = (old.nextId || trips.length) + 1;
        nextProdId  = trips.length + 1;
        colorIndex  = old.colorIndex || 0;
        saveToStorage();
        showToast('✓ Eski veriler otomatik olarak taşındı.', 'info');
        return;
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    trips       = d.trips      || [];
    nextTripId  = d.nextTripId || trips.length + 1;
    nextProdId  = d.nextProdId || 1;
    colorIndex  = d.colorIndex || 0;
    // Ensure computed fields
    trips.forEach(trip => {
      const { grossNet, net } = calcTrip(trip.products, trip.flight, trip.hotel);
      trip.grossNet = grossNet;
      trip.net      = net;
    });
  } catch(e) {
    console.warn('Storage load error:', e);
    trips = []; nextTripId = 1; nextProdId = 1; colorIndex = 0;
  }
}

function updateStorageInfo() {
  try {
    const bytes = new Blob([localStorage.getItem(STORAGE_KEY)||'']).size;
    const total = trips.reduce((s,t) => s + t.products.length, 0);
    storageInfo.textContent = `Depolama: ${(bytes/1024).toFixed(1)} KB — ${trips.length} sefer, ${total} ürün`;
  } catch(_) {}
}

// ============================================================
// Product Rows (Form)
// ============================================================
function createFormProductRow(rowId, data = {}) {
  const pNet = data.sale && data.purchase
    ? calcProductNet({ sale: num(data.sale), purchase: num(data.purchase), qty: qnum(data.qty||1) })
    : 0;
  const netClass = pNet > 0 ? 'profit' : pNet < 0 ? 'loss' : 'zero';

  const div = document.createElement('div');
  div.className = 'product-form-row';
  div.dataset.rowId = rowId;
  div.setAttribute('role', 'listitem');

  // Get index for display
  const rowIndex = formProducts.findIndex(r => r.rowId === rowId) + 1;

  div.innerHTML = `
    <div class="col-name-field" style="display:flex;align-items:center;gap:.5rem">
      <span class="row-num-badge">${rowIndex}</span>
      <input
        type="text"
        class="form-input prod-name"
        placeholder="Ürün adı..."
        maxlength="100"
        autocomplete="off"
        list="product-history"
        value="${escape(data.name||'')}"
        aria-label="Ürün ${rowIndex} adı"
        required
      />
    </div>
    <div class="col-qty-field">
      <input
        type="number"
        class="form-input prod-qty"
        placeholder="1"
        min="1"
        step="1"
        value="${data.qty||1}"
        inputmode="numeric"
        aria-label="Ürün ${rowIndex} adedi"
      />
    </div>
    <div class="col-purchase-field">
      <div class="input-wrapper">
        <span class="input-prefix" aria-hidden="true">$</span>
        <input
          type="number"
          class="form-input has-prefix prod-purchase"
          placeholder="0,00"
          min="0"
          step="0.01"
          value="${data.purchase||''}"
          inputmode="decimal"
          aria-label="Ürün ${rowIndex} alış fiyatı"
        />
      </div>
    </div>
    <div class="col-sale-field">
      <div class="input-wrapper">
        <span class="input-prefix" aria-hidden="true">$</span>
        <input
          type="number"
          class="form-input has-prefix prod-sale"
          placeholder="0,00"
          min="0"
          step="0.01"
          value="${data.sale||''}"
          inputmode="decimal"
          aria-label="Ürün ${rowIndex} satış fiyatı"
        />
      </div>
    </div>
    <div class="col-net-field">
      <span class="product-row-net ${netClass}" data-net-display>
        ${pNet !== 0 ? (sign(pNet) + fmt(pNet)) : '—'}
      </span>
    </div>
    <div class="col-remove-field">
      ${formProducts.length > 1
        ? `<button type="button" class="btn-icon remove-product-row" data-remove="${rowId}" aria-label="Ürün ${rowIndex}'i kaldır" title="Ürünü Kaldır">
             <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
               <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
             </svg>
           </button>`
        : '<span style="width:36px;display:block"></span>'
      }
    </div>
  `;

  // Input listeners for live preview
  const inputs = div.querySelectorAll('input');
  inputs.forEach(inp => inp.addEventListener('input', () => {
    syncRowState(rowId, div);
    updateLivePreview();
  }));

  return div;
}

function syncRowState(rowId, div) {
  const rowState = formProducts.find(r => r.rowId === rowId);
  if (!rowState) return;
  rowState.name     = div.querySelector('.prod-name').value;
  rowState.qty      = qnum(div.querySelector('.prod-qty').value);
  rowState.purchase = num(div.querySelector('.prod-purchase').value);
  rowState.sale     = num(div.querySelector('.prod-sale').value);

  // Update inline net display
  const pNet    = calcProductNet(rowState);
  const netEl   = div.querySelector('[data-net-display]');
  const netClass = pNet > 0 ? 'profit' : pNet < 0 ? 'loss' : 'zero';
  netEl.className = `product-row-net ${netClass}`;
  netEl.textContent = pNet !== 0 ? (sign(pNet) + fmt(pNet)) : '—';
}

function renderFormRows() {
  productRowsContainer.innerHTML = '';
  formProducts.forEach(rowState => {
    const div = createFormProductRow(rowState.rowId, rowState);
    productRowsContainer.appendChild(div);
  });
  updateProductCountBadge();
  addProductBtn.disabled = formProducts.length >= MAX_PRODUCTS;
}

function addFormProductRow(data = {}) {
  if (formProducts.length >= MAX_PRODUCTS) {
    showToast(`⚠ Bir sefere en fazla ${MAX_PRODUCTS} ürün eklenebilir.`, 'error');
    return;
  }
  const rowId = nextRowId++;
  formProducts.push({ rowId, name: data.name||'', qty: data.qty||1, purchase: data.purchase||0, sale: data.sale||0, cardId: data.cardId||null });
  renderFormRows();
  // Focus the new row's name input
  setTimeout(() => {
    const rows = productRowsContainer.querySelectorAll('.product-form-row');
    const lastRow = rows[rows.length - 1];
    if (lastRow) lastRow.querySelector('.prod-name')?.focus();
  }, 50);
}

function removeFormProductRow(rowId) {
  if (formProducts.length <= 1) return;
  formProducts = formProducts.filter(r => r.rowId !== rowId);
  renderFormRows();
  updateLivePreview();
}

function updateProductCountBadge() {
  const n = formProducts.length;
  productCountBadge.textContent = `${n}/${MAX_PRODUCTS}`;
  productCountBadge.style.background = n >= MAX_PRODUCTS
    ? 'rgba(249,115,22,.15)' : '';
  productCountBadge.style.color = n >= MAX_PRODUCTS
    ? 'var(--orange-700)' : '';
}

addProductBtn.addEventListener('click', () => addFormProductRow());

productRowsContainer.addEventListener('click', e => {
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) removeFormProductRow(parseInt(removeBtn.dataset.remove, 10));
});

// ============================================================
// Live Preview
// ============================================================
function updateLivePreview() {
  // Gather current form state
  const flight = num(fieldFlight.value);
  const hotel  = num(fieldHotel.value);

  // Sync all rows
  productRowsContainer.querySelectorAll('.product-form-row').forEach(div => {
    const rowId = parseInt(div.dataset.rowId, 10);
    syncRowState(rowId, div);
  });

  const { grossNet, net } = calcTrip(formProducts, flight, hotel);
  const expenses = flight + hotel;

  prevExpenses.textContent   = fmt(expenses);
  prevGrossNet.textContent   = sign(grossNet) + fmt(grossNet);
  prevGrossNet.style.color   = grossNet > 0 ? 'var(--green-700)' : grossNet < 0 ? 'var(--red-700)' : '';
  prevProductCount.textContent = formProducts.length;

  const netClass = net > 0 ? 'profit' : net < 0 ? 'loss' : 'neutral';
  previewNetTotal.textContent = (net >= 0 ? '+' : '−') + fmt(net);
  previewNetTotal.className   = `preview-net-value ${netClass}`;
}

[fieldFlight, fieldHotel].forEach(el => el.addEventListener('input', updateLivePreview));

fieldNotes.addEventListener('input', () => {
  notesCount.textContent = `${fieldNotes.value.length}/500`;
});

// ============================================================
// Autocomplete datalist
// ============================================================
function updateDatalist() {
  const names = [...new Set(trips.flatMap(t => t.products.map(p => p.name)))].sort();
  productHistory.innerHTML = names.map(n => `<option value="${escape(n)}"></option>`).join('');
}

// ============================================================
// Submit (Add / Update trip)
// ============================================================
form.addEventListener('submit', e => {
  e.preventDefault();

  if (!fieldDate.value) {
    fieldDate.focus();
    showToast('⚠ Lütfen sefer tarihi seçin.', 'error');
    return;
  }

  // Validate all product rows
  let valid = true;
  productRowsContainer.querySelectorAll('.product-form-row').forEach((div, i) => {
    const rowId = parseInt(div.dataset.rowId, 10);
    syncRowState(rowId, div);
    const rowState = formProducts.find(r => r.rowId === rowId);
    if (!rowState) return;
    if (!rowState.name.trim()) {
      div.querySelector('.prod-name').focus();
      showToast(`⚠ ${i+1}. ürünün adını girin.`, 'error');
      valid = false;
    } else if (rowState.purchase <= 0) {
      div.querySelector('.prod-purchase').focus();
      showToast(`⚠ ${i+1}. ürünün alış fiyatı > 0 olmalıdır.`, 'error');
      valid = false;
    } else if (rowState.sale <= 0) {
      div.querySelector('.prod-sale').focus();
      showToast(`⚠ ${i+1}. ürünün satış fiyatı > 0 olmalıdır.`, 'error');
      valid = false;
    }
  });
  if (!valid) return;

  const flight = num(fieldFlight.value);
  const hotel  = num(fieldHotel.value);
  const notes  = fieldNotes.value.trim();
  const flightCard = parseInt(flightCardSel.value, 10) || null;
  const hotelCard  = parseInt(hotelCardSel.value, 10) || null;

  const products = formProducts.map((r, i) => ({
    id: i + 1,
    name: r.name.trim(),
    qty:  r.qty,
    purchase: r.purchase,
    sale: r.sale,
    cardId: r.cardId,
  }));

  const { grossNet, net } = calcTrip(products, flight, hotel);

  if (editingId !== null) {
    const idx = trips.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      trips[idx] = { ...trips[idx], date: fieldDate.value, flight, hotel, flightCard, hotelCard, notes, products, grossNet, net };
      showToast(`✏ Sefer güncellendi — Net: ${sign(net)+fmt(net)}`, 'info');
    }
    exitEditMode();
  } else {
    const trip = {
      id: nextTripId++,
      date: fieldDate.value,
      flight, hotel, flightCard, hotelCard, notes,
      color: nextColor(),
      products,
      grossNet, net,
    };
    trips.push(trip);
    expandedIds.add(trip.id);  // auto-expand newly added trip
    const netStr = net >= 0 ? `+${fmt(net)} kâr` : `${sign(net)}${fmt(net)} zarar`;
    showToast(`✓ Sefer eklendi — ${products.length} ürün — ${netStr}`, net>=0?'success':'error');

    const savedDate = fieldDate.value;
    resetFormFields();
    fieldDate.value = savedDate;
    productRowsContainer.querySelector('.prod-name')?.focus();
  }

  saveToStorage();
  renderAll();
});

// ============================================================
// Edit Trip
// ============================================================
function enterEditMode(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return;
  editingId = id;

  fieldDate.value   = trip.date;
  fieldFlight.value = trip.flight;
  fieldHotel.value  = trip.hotel;
  fieldNotes.value  = trip.notes || '';
  flightCardSel.value = trip.flightCard || '';
  hotelCardSel.value  = trip.hotelCard || '';
  notesCount.textContent = `${fieldNotes.value.length}/500`;
  if (trip.notes) $('notes-details').open = true;

  // Populate product rows
  formProducts = trip.products.map(p => ({
    rowId:    nextRowId++,
    name:     p.name,
    qty:      p.qty,
    purchase: p.purchase,
    sale:     p.sale,
    cardId:   p.cardId,
  }));
  renderFormRows();
  updateLivePreview();

  submitLabel.textContent = 'Seferi Güncelle';
  submitBtn.classList.add('edit-mode-btn');
  submitIcon.innerHTML = `<path d="M2 12l3-1 7-7-2-2-7 7-1 3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  cancelEditBtn.style.display = '';
  formCard.classList.add('edit-mode');
  formCard.scrollIntoView({ behavior:'smooth', block:'start' });
  setTimeout(() => productRowsContainer.querySelector('.prod-name')?.focus(), 400);
}

function exitEditMode() {
  editingId = null;
  submitLabel.textContent = 'Seferi Kaydet';
  submitBtn.classList.remove('edit-mode-btn');
  submitIcon.innerHTML = `<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  cancelEditBtn.style.display = 'none';
  formCard.classList.remove('edit-mode');
  resetFormFields();
}

function resetFormFields(keepDate = false) {
  const savedDate = fieldDate.value;
  form.reset();
  fieldFlight.value = '0';
  fieldHotel.value  = '0';
  if (keepDate) fieldDate.value = savedDate;
  notesCount.textContent = '0/500';
  // Reset product rows to 1 blank row
  formProducts = [];
  nextRowId    = 1;
  addFormProductRow();
  updateLivePreview();
}

// ============================================================
// Delete Trip
// ============================================================
function deleteTrip(id) {
  const idx = trips.findIndex(t => t.id === id);
  if (idx === -1) return;
  const removed = trips.splice(idx, 1)[0];
  expandedIds.delete(id);
  if (editingId === id) exitEditMode();
  saveToStorage();
  renderAll();
  showToast(`🗑 Sefer silindi (${removed.products.length} ürün).`, 'error');
}

function clearAll() {
  if (!trips.length) return;
  const total = trips.reduce((s,t) => s+t.products.length, 0);
  if (!confirm(`${trips.length} sefer ve ${total} ürün kalıcı olarak silinecek. Emin misiniz?`)) return;
  trips = []; nextTripId = 1; nextProdId = 1; colorIndex = 0;
  filterDate = ''; filterDateEl.value = ''; clearFilterBtn.style.display = 'none';
  expandedIds.clear();
  exitEditMode();
  saveToStorage();
  renderAll();
  showToast('🗑 Tüm sefer kayıtları silindi.', 'error');
}

// ============================================================
// Expand / Collapse trips in table
// ============================================================
function toggleTripExpand(id) {
  if (expandedIds.has(id)) expandedIds.delete(id);
  else expandedIds.add(id);
  // Update only this trip's rows
  refreshExpansionUI(id);
}

function refreshExpansionUI(id) {
  const headerRow = tradesTbody.querySelector(`tr.trip-header-row[data-id="${id}"]`);
  if (!headerRow) return;
  const isOpen  = expandedIds.has(id);
  const toggle  = headerRow.querySelector('.trip-toggle');
  if (toggle) toggle.classList.toggle('open', isOpen);
  headerRow.classList.toggle('expanded', isOpen);

  const subRows = tradesTbody.querySelectorAll(`tr.product-sub-row[data-trip="${id}"]`);
  subRows.forEach(r => r.classList.toggle('visible', isOpen));
}

function toggleExpandAll() {
  const filtered = getFiltered();
  if (allExpanded) {
    filtered.forEach(t => expandedIds.delete(t.id));
    allExpanded = false;
    expandAllBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Tümünü Aç
    `;
  } else {
    filtered.forEach(t => expandedIds.add(t.id));
    allExpanded = true;
    expandAllBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Tümünü Kapat
    `;
  }
  renderTable();
}

expandAllBtn.addEventListener('click', toggleExpandAll);

// ============================================================
// Render table
// ============================================================
function getFiltered() {
  return filterDate ? trips.filter(t => t.date === filterDate) : trips;
}

function renderTable() {
  tradesTbody.innerHTML = '';
  const filtered = getFiltered();

  filtered.forEach((trip, i) => {
    const isOpen = expandedIds.has(trip.id);
    const { net, grossNet, margin } = { net: trip.net, grossNet: trip.grossNet, margin: 0 };
    const totalSale = trip.products.reduce((s,p) => s + p.sale * p.qty, 0);
    const tripMargin = totalSale > 0 ? (net / totalSale) * 100 : 0;
    const netClass   = net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero';
    const netSym     = net > 0 ? '▲' : net < 0 ? '▼' : '—';
    const mClass     = marginClass(tripMargin);

    // ---- Trip header row ----
    const tr = document.createElement('tr');
    tr.className   = `trip-header-row${isOpen?' expanded':''}`;
    tr.dataset.id  = trip.id;
    tr.innerHTML = `
      <td>
        <button class="trip-toggle${isOpen?' open':''}" aria-label="${isOpen?'Kapat':'Aç'} — ${fmtDate(trip.date)}" aria-expanded="${isOpen}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </td>
      <td><span class="row-num-sm">#${i+1}</span></td>
      <td>
        <span class="trip-badge">
          <span class="trip-color-dot" style="background:${trip.color}"></span>
          ${fmtDate(trip.date)}
          ${trip.notes
            ? `<span class="note-icon" title="${escape(trip.notes)}" aria-label="Sefer notu">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M3.5 4h5M3.5 6.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
               </span>`
            : ''}
        </span>
      </td>
      <td>
        <span class="product-count-tag">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.1"/><rect x="6" y=".5" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.1"/><rect x=".5" y="6" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.1"/><rect x="6" y="6" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.1"/></svg>
          ${trip.products.length} ürün
        </span>
      </td>
      <td><span class="amount cost">${trip.flight > 0 ? fmt(trip.flight) : '<span style="color:var(--text-muted)">—</span>'}</span></td>
      <td><span class="amount cost">${trip.hotel  > 0 ? fmt(trip.hotel)  : '<span style="color:var(--text-muted)">—</span>'}</span></td>
      <td>
        <span style="font-weight:600;font-variant-numeric:tabular-nums;color:${grossNet>=0?'var(--green-700)':'var(--red-700)'}">
          ${sign(grossNet)+fmt(grossNet)}
        </span>
      </td>
      <td>
        <span class="profit-pill ${netClass}">
          ${netSym} ${net < 0 ? '−' : net > 0 ? '+' : ''}${fmt(Math.abs(net))}
        </span>
      </td>
      <td>
        <span class="margin-badge ${mClass}">
          ${tripMargin >= 0 ? '+' : ''}${tripMargin.toFixed(1)}%
        </span>
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon edit" data-edit="${trip.id}" aria-label="Seferi düzenle" title="Düzenle">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9.5 2l2.5 2.5L5 11H2.5V8.5L9.5 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn-icon" data-delete="${trip.id}" aria-label="Seferi sil" title="Sil">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 3.5h10M5 3.5V2h4v1.5M3 3.5l.6 8.5h6.8L11 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </td>
    `;
    tradesTbody.appendChild(tr);

    // ---- Product sub-rows ----
    trip.products.forEach((p, pi) => {
      const pNet    = calcProductNet(p);
      const pNetClass = pNet > 0 ? 'positive' : pNet < 0 ? 'negative' : 'zero';
      const pSym    = pNet > 0 ? '▲' : pNet < 0 ? '▼' : '—';

      const sub = document.createElement('tr');
      sub.className = `product-sub-row${isOpen ? ' visible' : ''}`;
      sub.dataset.trip = trip.id;
      sub.innerHTML = `
        <td></td>
        <td><span class="row-num-sm">${pi+1}</span></td>
        <td colspan="2">
          <span class="sub-product-badge">
            <span class="sub-dot"></span>
            ${escape(p.name)}
          </span>
        </td>
        <td><span class="qty-badge">×${p.qty}</span></td>
        <td><span class="amount">${fmt(p.purchase)}</span></td>
        <td><span class="amount">${fmt(p.sale)}</span></td>
        <td>
          <span class="profit-pill ${pNetClass}">
            ${pSym} ${pNet<0?'−':pNet>0?'+':''}${fmt(Math.abs(pNet))}
          </span>
        </td>
        <td colspan="2"></td>
      `;
      tradesTbody.appendChild(sub);
    });
  });
}

// Table click delegation
tradesTbody.addEventListener('click', e => {
  const editBtn   = e.target.closest('[data-edit]');
  const deleteBtn = e.target.closest('[data-delete]');
  const toggleBtn = e.target.closest('.trip-toggle');
  const headerRow = e.target.closest('.trip-header-row');

  if (editBtn)   { enterEditMode(parseInt(editBtn.dataset.edit, 10)); return; }
  if (deleteBtn) { deleteTrip(parseInt(deleteBtn.dataset.delete, 10)); return; }
  if (toggleBtn || headerRow) {
    const id = parseInt((toggleBtn || headerRow)?.closest('tr')?.dataset.id, 10);
    if (id) toggleTripExpand(id);
  }
});

// ============================================================
// Summary & Stats
// ============================================================
function updateSummary(filtered) {
  const totalSales    = filtered.reduce((s,t) => s + t.products.reduce((ss,p) => ss + p.sale*p.qty, 0), 0);
  const totalExpenses = filtered.reduce((s,t) => s + t.flight + t.hotel, 0);
  const totalNet      = filtered.reduce((s,t) => s + t.net, 0);

  totalSalesEl.textContent    = fmt(totalSales);
  totalExpensesEl.textContent = fmt(totalExpenses);

  const pfx = totalNet >= 0 ? '+' : '−';
  dailyNetProfitEl.textContent = pfx + fmt(totalNet);
  dailyNetProfitEl.className   = 'summary-val large ' + (totalNet>0?'profit':totalNet<0?'loss':'');
  netProfitLabel.textContent   = filterDate ? `${fmtDate(filterDate)} Net Kar` : 'Toplam Net Kar';

  renderPerTripSummary(filtered);
}

// ============================================================
// Per-trip profit breakdown
// ============================================================
function renderPerTripSummary(filtered) {
  const section = $('pts-section');
  const rowsEl  = $('pts-rows');
  const totalLbl = $('pts-total-label');
  if (!section || !rowsEl) return;

  // Only show when there are 2+ trips visible
  if (filtered.length < 2) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  // Scale: bar widths relative to the max absolute net
  const maxAbs = Math.max(...filtered.map(t => Math.abs(t.net)), 1);
  const totalNet = filtered.reduce((s,t) => s + t.net, 0);

  // Total label
  const profCnt = filtered.filter(t => t.net > 0).length;
  const lossCnt = filtered.filter(t => t.net < 0).length;
  totalLbl.innerHTML =
    `<span style="color:var(--green-700)">${profCnt} kârlı</span>` +
    (lossCnt ? ` &nbsp;·&nbsp; <span style="color:var(--red-700)">${lossCnt} zararlı</span>` : '');

  rowsEl.innerHTML = filtered.map((trip, i) => {
    const net      = trip.net;
    const isPos    = net > 0;
    const isZero   = net === 0;
    const barPct   = (Math.abs(net) / maxAbs * 100).toFixed(1);
    const expense  = trip.flight + trip.hotel;
    const netCls   = isZero ? 'zero' : isPos ? 'positive' : 'negative';
    const barCls   = isPos || isZero ? 'pos' : 'neg';
    const sym      = isPos ? '▲' : isZero ? '—' : '▼';
    const pfxStr   = isPos ? '+' : isZero ? '' : '−';
    const prodCount = trip.products.length;

    // Product names preview (first 3)
    const namePreview = trip.products
      .slice(0, 3)
      .map(p => escape(p.name))
      .join(', ') + (prodCount > 3 ? ` +${prodCount-3} daha` : '');

    return `
      <div class="pts-row"
           role="listitem"
           tabindex="0"
           data-goto-trip="${trip.id}"
           aria-label="${fmtDate(trip.date)} seferi — ${pfxStr}${fmtN(Math.abs(net))} $"
           title="Tabloda görmek için tıklayın">
        <div class="pts-meta">
          <span class="pts-num">#${i+1}</span>
          <span class="pts-date">${fmtDate(trip.date)}</span>
          <span class="pts-chip prods">${prodCount} ürün</span>
          ${expense > 0
            ? `<span class="pts-chip expense" title="Uçak + Konaklama">Gider: ${fmt(expense)}</span>`
            : ''}
        </div>
        <div class="pts-bar-wrap" title="${namePreview}">
          <div class="pts-bar ${barCls}" style="width:${barPct}%"></div>
        </div>
        <div class="pts-net ${netCls}">
          <span class="pts-sym">${sym}</span>
          ${pfxStr}${fmt(Math.abs(net))}
        </div>
      </div>
    `;
  }).join('');

  // Click/keyboard: scroll + expand that trip in the table
  rowsEl.querySelectorAll('[data-goto-trip]').forEach(el => {
    const go = () => {
      const id = parseInt(el.dataset.gotoTrip, 10);
      expandedIds.add(id);
      renderTable();
      setTimeout(() => {
        const tripRow = tradesTbody.querySelector(`tr.trip-header-row[data-id="${id}"]`);
        if (tripRow) {
          tripRow.scrollIntoView({ behavior:'smooth', block:'center' });
          // Flash highlight
          tripRow.style.transition = 'background .1s';
          tripRow.style.background = 'var(--blue-100)';
          setTimeout(() => { tripRow.style.background = ''; }, 800);
        }
      }, 80);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); go(); } });
  });
}


function updateHeaderStats(all) {
  const totalSales = all.reduce((s,t) => s + t.products.reduce((ss,p) => ss + p.sale*p.qty, 0), 0);
  const totalProds = all.reduce((s,t) => s + t.products.length, 0);
  const totalNet   = getFiltered().reduce((s,t) => s + t.net, 0);

  totalCount.textContent        = all.length;
  totalProductsEl.textContent   = totalProds;
  headerTotalSales.textContent  = '$' + Math.round(totalSales).toLocaleString('en-US');
  headerNetProfit.textContent   = (totalNet>=0?'+':'−') + fmt(totalNet);
  headerNetProfit.style.color   = totalNet > 0 ? '#86EFAC' : totalNet < 0 ? '#FCA5A5' : '#86EFAC';
}

function updateKPIs(all) {
  if (!all.length) return;
  const best  = all.reduce((a,b) => b.net > a.net ? b : a, all[0]);
  const worst = all.reduce((a,b) => b.net < a.net ? b : a, all[0]);
  const avg   = all.reduce((s,t) => s + t.net, 0) / all.length;
  const profitable = all.filter(t => t.net > 0).length;
  const ratio = Math.round((profitable / all.length) * 100);

  const bestDate  = fmtDate(best.date)  + ' (' + best.products.length  + ' ürün)';
  const worstDate = fmtDate(worst.date) + ' (' + worst.products.length + ' ürün)';

  kpiBestVal.textContent   = (best.net >= 0 ? '+' : '−') + fmt(best.net);
  kpiBestVal.style.color   = best.net  >= 0 ? 'var(--green-700)' : 'var(--red-700)';
  kpiBestName.textContent  = bestDate;
  kpiWorstVal.textContent  = (worst.net >= 0 ? '+' : '−') + fmt(worst.net);
  kpiWorstVal.style.color  = worst.net >= 0 ? 'var(--green-700)' : 'var(--red-700)';
  kpiWorstName.textContent = worstDate;
  kpiAvgVal.textContent    = (avg >= 0 ? '+' : '−') + fmt(avg);
  kpiAvgVal.style.color    = avg >= 0 ? 'var(--green-700)' : 'var(--red-700)';
  kpiAvgSub.textContent    = `${all.length} sefer ortalaması`;
  kpiRatioVal.textContent  = `%${ratio}`;
  kpiRatioVal.style.color  = ratio >= 50 ? 'var(--green-700)' : 'var(--red-700)';
  kpiRatioSub.textContent  = `${profitable}/${all.length} sefer kârlı`;
}

// ============================================================
// Render All
// ============================================================
function renderAll() {
  const filtered  = getFiltered();
  const hasAny    = trips.length > 0;
  const hasFilter = filtered.length > 0;

  filterGroup.style.display   = hasAny ? '' : 'none';
  exportBtn.style.display     = hasAny ? '' : 'none';
  clearAllBtn.style.display   = hasAny ? '' : 'none';
  expandAllBtn.style.display  = hasAny ? '' : 'none';
  statsRow.style.display      = hasAny ? '' : 'none';
  chartCard.style.display     = hasAny ? '' : 'none';

  emptyState.style.display     = !hasAny ? '' : 'none';
  noResultsState.style.display = (hasAny && !hasFilter) ? '' : 'none';
  tableWrapper.style.display   = hasFilter ? '' : 'none';
  summaryFooter.style.display  = hasFilter ? '' : 'none';

  if (!hasAny) {
    updateStorageInfo();
    updateDatalist();
    return;
  }

  if (!hasFilter) {
    noResultsDate.textContent = `"${fmtDate(filterDate)}" tarihinde sefer bulunamadı.`;
  } else {
    renderTable();
    updateSummary(filtered);
  }

  updateHeaderStats(trips);
  updateKPIs(trips);
  updateStorageInfo();
  updateDatalist();

  // Chart
  const { dates } = getChartData();
  if (dates.length >= 1) {
    chartCard.style.display = '';
    const show2 = dates.length >= 2;
    chartEmpty.style.display  = show2 ? 'none' : '';
    chartCanvas.style.display = show2 ? '' : 'none';
    if (show2) {
      resizeObserver.observe(chartCanvas.parentElement);
      animateChart();
    }
  }
}

// ============================================================
// Chart (Canvas API)
// ============================================================
function getChartData() {
  const byDate = {};
  trips.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + t.net; });
  const dates  = Object.keys(byDate).sort();
  const values = dates.map(d => byDate[d]);
  let cum = 0;
  const cumulative = values.map(v => { cum += v; return cum; });
  return { dates, values, cumulative };
}

function updateChartLegend(hasCum) {
  chartLegend.innerHTML = `
    <span class="legend-item"><span class="legend-dot profit"></span>Kâr</span>
    <span class="legend-item"><span class="legend-dot loss"></span>Zarar</span>
    ${hasCum?'<span class="legend-item"><span class="legend-dot cum"></span>Kümülatif</span>':''}
  `;
}

function animateChart() {
  cancelAnimationFrame(chartAnimReq);
  chartAnimProg = 0;
  const step = () => {
    chartAnimProg = Math.min(1, chartAnimProg + 0.045);
    drawChart();
    if (chartAnimProg < 1) chartAnimReq = requestAnimationFrame(step);
  };
  chartAnimReq = requestAnimationFrame(step);
}

function drawChart() {
  if (!chartCanvas || !trips.length) return;
  const { dates, values, cumulative } = getChartData();
  if (dates.length < 2) return;

  const dpr  = window.devicePixelRatio || 1;
  const rect = chartCanvas.getBoundingClientRect();
  const W = rect.width, H = rect.height || 240;
  if (W === 0) return;

  chartCanvas.width  = W * dpr;
  chartCanvas.height = H * dpr;
  const ctx = chartCanvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const isDark = html.getAttribute('data-theme') === 'dark';
  const PAD    = { top:28, right:20, bottom:48, left:72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;

  const allVals = [...values, ...cumulative];
  const maxAbs  = Math.max(...allVals.map(Math.abs), 1);
  const toY     = v => PAD.top + cH/2 - (v/maxAbs)*(cH/2-4);
  const zeroY   = toY(0);

  const textColor = isDark?'#4A6280':'#94A3B8';
  const gridColor = isDark?'rgba(74,98,128,.15)':'rgba(148,163,184,.18)';
  const cardBg    = isDark?'#131E30':'#FFFFFF';

  ctx.fillStyle = cardBg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const v = maxAbs - (maxAbs*2/4)*i;
    const y = toY(v);
    ctx.strokeStyle = gridColor; ctx.lineWidth=1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(W-PAD.right,y); ctx.stroke();
    ctx.setLineDash([]);
    const label = Math.abs(v)>=10000?(v/1000).toFixed(0)+'K':Math.round(v).toLocaleString('en-US');
    ctx.fillStyle=textColor; ctx.font=`11px Inter,sans-serif`; ctx.textAlign='right';
    ctx.fillText((v>0?'+':'')+label, PAD.left-8, y+4);
  }

  ctx.strokeStyle=isDark?'rgba(74,98,128,.4)':'rgba(148,163,184,.5)';
  ctx.lineWidth=1.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(PAD.left,zeroY); ctx.lineTo(W-PAD.right,zeroY); ctx.stroke();

  const n    = dates.length;
  const step = cW / n;
  const barW = Math.max(8, Math.min(step*.55, 60));
  const prog = ease(chartAnimProg);
  const barAlpha = chartMode==='cumulative'?.28:1;

  dates.forEach((date, i) => {
    const v    = values[i];
    const animV = v * prog;
    const x    = PAD.left + step*i + step/2 - barW/2;
    const barH = Math.abs(animV/maxAbs)*(cH/2-4);
    const barY = v>=0 ? toY(animV) : zeroY;
    const isHov = i===chartHoverIdx;
    const alpha = isHov ? Math.min(1,barAlpha+.2) : barAlpha;

    if (barH < 1) {
      ctx.fillStyle=`rgba(148,163,184,${alpha})`; ctx.fillRect(x,zeroY-1,barW,2);
    } else {
      const grad = ctx.createLinearGradient(x,barY,x,barY+barH);
      if (v>=0) { grad.addColorStop(0,`rgba(34,197,94,${alpha})`); grad.addColorStop(1,`rgba(21,128,61,${alpha})`); }
      else       { grad.addColorStop(0,`rgba(239,68,68,${alpha})`); grad.addColorStop(1,`rgba(185,28,28,${alpha})`); }
      ctx.fillStyle=grad; ctx.beginPath();
      const r=Math.min(4,barW/4);
      v>=0 ? ctx.roundRect(x,barY,barW,barH,[r,r,0,0]) : ctx.roundRect(x,zeroY,barW,barH,[0,0,r,r]);
      ctx.fill();
      if (barH>24 && barAlpha>.5) {
        const absV=Math.abs(v);
        const lbl=absV>=10000?(v/1000).toFixed(1)+'K':Math.round(absV).toLocaleString('en-US');
        ctx.fillStyle='rgba(255,255,255,.92)'; ctx.font=`bold 9px Inter,sans-serif`;
        ctx.textAlign='center';
        ctx.fillText((v>0?'+':'-')+lbl, x+barW/2, v>=0?barY+13:barY+barH-4);
      }
    }

    const [,mo,dy]=date.split('-');
    ctx.fillStyle=isHov?(isDark?'#60A5FA':'#2563EB'):textColor;
    ctx.font=`${isHov?'bold ':''}10px Inter,sans-serif`; ctx.textAlign='center';
    ctx.fillText(`${dy}.${mo}`, x+barW/2, H-PAD.bottom+15);
  });

  // Cumulative line
  if (chartMode==='cumulative' && prog>.2) {
    const cp = ease(Math.max(0,(chartAnimProg-.15)/.85));
    const visN = Math.ceil(n*cp);
    const lg = ctx.createLinearGradient(PAD.left,0,W-PAD.right,0);
    lg.addColorStop(0,'#3B82F6'); lg.addColorStop(1,cumulative[n-1]>=0?'#22C55E':'#EF4444');
    ctx.strokeStyle=lg; ctx.lineWidth=2.5; ctx.setLineDash([]); ctx.lineJoin='round';
    ctx.beginPath();
    for (let i=0;i<visN;i++) {
      const x=PAD.left+step*i+step/2, y=toY(cumulative[i]);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    for (let i=0;i<visN;i++) {
      const x=PAD.left+step*i+step/2, y=toY(cumulative[i]);
      const isH=i===chartHoverIdx;
      ctx.fillStyle=cumulative[i]>=0?'#22C55E':'#EF4444';
      ctx.strokeStyle=isDark?'#131E30':'#FFFFFF'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,isH?6:4,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }
  }
  updateChartLegend(chartMode==='cumulative');
}

function getBarIdxFromX(clientX) {
  const rect=chartCanvas.getBoundingClientRect();
  const x=clientX-rect.left;
  const cW=rect.width-72-20;
  const {dates}=getChartData();
  const n=dates.length;
  if (!n) return -1;
  const step=cW/n;
  const idx=Math.floor((x-72)/step);
  return idx>=0&&idx<n?idx:-1;
}

chartCanvas.addEventListener('mousemove', e => {
  const {dates,values,cumulative}=getChartData();
  const idx=getBarIdxFromX(e.clientX);
  if (idx===-1&&chartHoverIdx!==-1){chartHoverIdx=-1;drawChart();chartTooltip.className='chart-tooltip';return;}
  if (idx===chartHoverIdx||idx===-1) return;
  chartHoverIdx=idx; drawChart();

  const rect=chartCanvas.getBoundingClientRect();
  const step=(rect.width-72-20)/dates.length;
  const profit=values[idx], cum=cumulative[idx];
  const dayTrips=trips.filter(t=>t.date===dates[idx]);
  const totalProds=dayTrips.reduce((s,t)=>s+t.products.length,0);

  chartTooltip.innerHTML=`
    <div class="tt-date">${fmtDate(dates[idx])}</div>
    <div class="tt-profit" style="color:${profit>=0?'var(--green-700)':'var(--red-700)'}">
      ${profit>=0?'▲ +':'▼ '}${fmtN(profit)} $
    </div>
    <div class="tt-meta">${dayTrips.length} sefer • ${totalProds} ürün</div>
    ${chartMode==='cumulative'?`<div class="tt-cum">Kümülatif: ${cum>=0?'+':''}${fmtN(cum)} $</div>`:''}
  `;
  const ttW=150;
  const barCX=72+step*idx+step/2;
  let left=barCX+8;
  if (left+ttW>rect.width-20) left=barCX-ttW-8;
  chartTooltip.style.left=`${left}px`; chartTooltip.style.top='24px';
  chartTooltip.className='chart-tooltip visible';
});

chartCanvas.addEventListener('mouseleave',()=>{chartHoverIdx=-1;drawChart();chartTooltip.className='chart-tooltip';});

const resizeObserver=new ResizeObserver(()=>{if(trips.length)drawChart();});

btnDaily.addEventListener('click',()=>{
  chartMode='daily';
  btnDaily.classList.add('active');       btnDaily.setAttribute('aria-pressed','true');
  btnCumulative.classList.remove('active'); btnCumulative.setAttribute('aria-pressed','false');
  animateChart();
});
btnCumulative.addEventListener('click',()=>{
  chartMode='cumulative';
  btnCumulative.classList.add('active');  btnCumulative.setAttribute('aria-pressed','true');
  btnDaily.classList.remove('active');    btnDaily.setAttribute('aria-pressed','false');
  animateChart();
});

// ============================================================
// Date Filter
// ============================================================
filterDateEl.addEventListener('change', () => {
  filterDate = filterDateEl.value;
  clearFilterBtn.style.display = filterDate ? '' : 'none';
  renderAll();
});
clearFilterBtn.addEventListener('click', () => {
  filterDate=''; filterDateEl.value=''; clearFilterBtn.style.display='none';
  renderAll();
});

// ============================================================
// CSV Export
// ============================================================
function exportCSV() {
  const src = getFiltered();
  if (!src.length) { showToast('Dışa aktarılacak sefer yok.', 'info'); return; }

  const rows = [];
  rows.push(['Sefer #','Tarih','Uçak ($)','Konaklama ($)','Ürün #','Ürün Adı','Adet','Birim Alış ($)','Birim Satış ($)','Ürün Net Kar ($)','Sefer Net Kar ($)','Sefer Notları'].join(';'));

  src.forEach((trip, ti) => {
    trip.products.forEach((p, pi) => {
      const pNet = calcProductNet(p);
      rows.push([
        ti+1, fmtDate(trip.date),
        pi===0?trip.flight.toFixed(2):'',
        pi===0?trip.hotel.toFixed(2):'',
        pi+1, `"${p.name.replace(/"/g,'""')}"`,
        p.qty, p.purchase.toFixed(2), p.sale.toFixed(2),
        pNet.toFixed(2),
        pi===0?trip.net.toFixed(2):'',
        pi===0?`"${(trip.notes||'').replace(/"/g,'""')}"` : '',
      ].join(';'));
    });
  });

  const csv  = rows.join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = filterDate ? `ticaret-takip-${filterDate}.csv` : `ticaret-takip-${new Date().toISOString().split('T')[0]}.csv`;
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📥 "${name}" indirildi.`, 'success');
}

// ============================================================
// Event Bindings
// ============================================================
resetBtn.addEventListener('click', () => editingId!==null ? exitEditMode() : resetFormFields());
cancelEditBtn.addEventListener('click', exitEditMode);
clearAllBtn.addEventListener('click', clearAll);
exportBtn.addEventListener('click', exportCSV);

// Ctrl/Cmd + Enter to submit
form.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') submitBtn.click();
});

// ============================================================
// Init
// ============================================================
function init() {
  initTheme();
  loadFromStorage();

  const today = new Date().toISOString().split('T')[0];
  fieldDate.value   = today;
  fieldFlight.value = '0';
  fieldHotel.value  = '0';

  // Start with 1 blank product row
  addFormProductRow();

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);


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
               cards.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('');
  
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
    
    return `
      <div class="card-item">
        <div class="card-item-header">
          <span class="card-name">${escape(c.name)}</span>
          <span class="card-limits">$${Math.round(used).toLocaleString('en-US')} / $${Math.round(limit).toLocaleString('en-US')}</span>
        </div>
        <div class="card-progress-wrap">
          <div class="card-progress ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="card-actions">
          <button class="card-delete-btn" onclick="deleteCard(${c.id})">Sil</button>
        </div>
      </div>
    `;
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
