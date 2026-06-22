/* ════════════════════════════════════════
   DEMO DATA  (seeded once if list empty)
════════════════════════════════════════ */
const DEMOS = [
  { id:'demo-1', title:'Vintage Leather Armchair', cat:'Furniture',
    desc:'Beautiful mid-century modern leather armchair in excellent condition. Minor wear on armrests, adds character.',
    condLabel:'Good', cond:8, value:450, trade:'Bookshelf or Desk Lamp',
    date:'2026-04-08',
    seller:{ name:'Sarah Johnson', avatar:null },
    images:['https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=700&q=80',
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&q=80',
            'https://images.unsplash.com/photo-1549497538-303791108f95?w=300&q=80'] },
  { id:'demo-2', title:'Canon EOS 5D Mark III Camera', cat:'Electronics',
    desc:'Professional DSLR camera with low shutter count. Includes battery, charger, and strap. Perfect working condition.',
    condLabel:'Like New', cond:9, value:1200, trade:'Laptop or Drone',
    date:'2026-04-10',
    seller:{ name:'Ali Raza', avatar:null },
    images:['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=700&q=80'] },
  { id:'demo-3', title:'Mountain Bike – Trek X-Caliber', cat:'Sports',
    desc:'29" mountain bike, aluminum frame, disc brakes. Recently serviced, new tires installed.',
    condLabel:'Good', cond:8, value:650, trade:'Gaming Console',
    date:'2026-04-15',
    seller:{ name:'Usman Khan', avatar:null },
    images:['https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=700&q=80'] },
  { id:'demo-4', title:'KitchenAid Stand Mixer', cat:'Home',
    desc:'5-quart KitchenAid mixer, barely used. Comes with dough hook, whisk, and flat beater. All original parts.',
    condLabel:'Like New', cond:9, value:380, trade:'Instant Pot or Air Fryer',
    date:'2026-04-16',
    seller:{ name:'Hina Malik', avatar:null },
    images:['https://images.unsplash.com/photo-1594498653385-d5172c532c00?w=700&q=80'] },
  { id:'demo-5', title:'Acoustic Guitar – Yamaha F310', cat:'Music',
    desc:'Full-size acoustic guitar. Minor pick scratches on body, plays perfectly. Includes bag.',
    condLabel:'Good', cond:7, value:200, trade:'Keyboard or Ukulele',
    date:'2026-04-17',
    seller:{ name:'Bilal Ahmed', avatar:null },
    images:['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=700&q=80'] },
  { id:'demo-6', title:'The Art of War – Collector\'s Set', cat:'Books',
    desc:"Collector's edition hardcover set. Excellent condition, barely read. A must for any bookshelf.",
    condLabel:'Like New', cond:9, value:85, trade:'Other books or board games',
    date:'2026-04-18',
    seller:{ name:'Sara Ahmed', avatar:null },
    images:['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&q=80'] }
];

function seedIfEmpty() {
  let existing = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
  const hasDemos = existing.some(p => String(p.id).startsWith('demo-'));
  if (!hasDemos) {
    localStorage.setItem('bartifyProducts', JSON.stringify([...DEMOS, ...existing]));
  }
}

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
let activeCategory = 'All';
let currentQuery   = '';

/* ════════════════════════════════════════
   FILTERS
════════════════════════════════════════ */
function filterCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.cat;
  document.getElementById('productsHeading').textContent =
    activeCategory === 'All' ? 'All Listings' : activeCategory + ' Listings';
  renderProducts();
}
function doSearch() {
  currentQuery = document.getElementById('searchInput')?.value.trim() || '';
  renderProducts();
}
function doMobileSearch() {
  currentQuery = document.getElementById('mobileSearchInput')?.value.trim() || '';
  renderProducts();
}
function toggleMobileSearch() {
  const bar = document.getElementById('mobileSearchBar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) document.getElementById('mobileSearchInput').focus();
}

/* ════════════════════════════════════════
   RENDER GRID
════════════════════════════════════════ */
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let list = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');

  if (activeCategory !== 'All') {
    list = list.filter(p => p.cat && p.cat.toLowerCase() === activeCategory.toLowerCase());
  }
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    list = list.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.desc  && p.desc.toLowerCase().includes(q))  ||
      (p.cat   && p.cat.toLowerCase().includes(q))
    );
  }

  if (!list.length) {
    grid.innerHTML = `
      <div class="products-empty">
        <div class="empty-icon">📦</div>
        <div class="empty-title">${currentQuery ? 'No results found' : 'No listings yet'}</div>
        <div class="empty-sub">${currentQuery
          ? 'Try a different keyword or category.'
          : 'Be the first to list an item!'}</div>
        <a href="list-item.html" class="btn-list-first">List an Item</a>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => cardHTML(p)).join('');
}

/* ════════════════════════════════════════
   CARD HTML  (NO edit/delete, NO rating)
   Category badge top-left on image
════════════════════════════════════════ */
function cardHTML(p) {
  const hasImg = p.images && p.images.length;
  const imgEl  = hasImg
    ? `<img src="${p.images[0]}" alt="${esc(p.title)}" class="pc-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const phEl = `<div class="pc-img-placeholder"${hasImg ? ' style="display:none"' : ''}>
                  <i class="bi bi-image"></i></div>`;

  return `
    <div class="product-card" onclick="openDetail('${p.id}')">
      <div class="pc-img-wrap">
        ${imgEl}${phEl}
        <span class="pc-cat-badge">${esc(p.cat || 'General')}</span>
      </div>
      <div class="pc-body">
        <h3 class="pc-title">${esc(p.title)}</h3>
        ${p.desc ? `<p class="pc-desc">${esc(p.desc)}</p>` : ''}
        <div class="pc-bottom">
          <div>
            <div class="pc-value-label">Est. value</div>
            <div class="pc-value">Rs. ${Number(p.value || 0).toLocaleString()}</div>
          </div>
          <button class="pc-view-btn" onclick="event.stopPropagation();openDetail('${p.id}')">
            View Details
          </button>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════
   DETAIL MODAL  (Figma layout)
════════════════════════════════════════ */
function openDetail(id) {
  const list = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
  const p    = list.find(x => x.id === id);
  if (!p) return;

  /* Condition */
  const condLabel = p.condLabel
    || (p.cond >= 9 ? 'Like New' : p.cond >= 7 ? 'Good' : p.cond >= 5 ? 'Fair' : 'Poor');
  const condClass = condLabel.toLowerCase().replace(/\s/g, '-');

  const condChecks = {
    'Like New': ['Like new condition', 'No visible wear', 'Fully functional'],
    'Good':     ['Well maintained',    'Minor wear',       'Fully functional'],
    'Fair':     ['Shows use',          'Some wear marks',  'Works perfectly'],
    'Poor':     ['Heavy use visible',  'Cosmetic damage',  'Fully functional']
  }[condLabel] || ['Well maintained', 'Minor wear', 'Fully functional'];

  /* Seller */
  const seller = p.seller || {};
  const sellerName = seller.name || p.ownerName || 'Bartify User';
  const sellerInit = sellerName.charAt(0).toUpperCase();
  const sellerAvHTML = seller.avatar
    ? `<img src="${seller.avatar}" alt="">`
    : sellerInit;

  /* Date */
  const dateStr = p.date
    ? new Date(p.date).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric' })
    : '';

  /* Images */
  const imgs = (p.images && p.images.length) ? p.images : [];
  const mainHTML = imgs.length
    ? `<img src="${imgs[0]}" alt="${esc(p.title)}" class="pd-main-img" id="pdMainImg">`
    : `<div class="pd-main-placeholder"><i class="bi bi-image"></i></div>`;

  const thumbsHTML = imgs.length > 1
    ? `<div class="pd-thumbs">
        ${imgs.map((src, i) =>
          `<img src="${src}" class="pd-thumb${i===0?' active':''}"
                onclick="switchImg('${src}',this)" alt="">`
        ).join('')}
       </div>`
    : '';

  /* Preferred trade */
  const tradeHTML = p.trade
    ? `<div class="pd-label">Looking for</div>
       <p class="pd-trade-text">${esc(p.trade)}</p>` : '';

  document.getElementById('pdBody').innerHTML = `
    <div class="pd-gallery">
      ${mainHTML}
      ${thumbsHTML}
    </div>
    <div class="pd-info">
      <h2 class="pd-title">${esc(p.title)}</h2>

      <div class="pd-seller">
        <div class="pd-seller-av">${sellerAvHTML}</div>
        <div>
          <div class="pd-seller-name">${esc(sellerName)}</div>
        </div>
      </div>
      <div class="pd-seller-meta">
        ${dateStr ? `<span><i class="bi bi-calendar3"></i> ${dateStr}</span>` : ''}
      </div>

      <div class="pd-cond-pill ${condClass}">
        <i class="bi bi-patch-check-fill"></i>
        Condition: ${esc(condLabel)}
      </div>

      <ul class="pd-checks">
        ${condChecks.map(c => `<li><i class="bi bi-check-circle-fill"></i>${c}</li>`).join('')}
      </ul>

      <div class="pd-label">Description</div>
      <p class="pd-section-text">${esc(p.desc || 'No description provided.')}</p>

      ${tradeHTML}

      <div class="pd-value-box">
        <div class="pd-label">Estimated value</div>
        <div class="pd-value-big">Rs. ${Number(p.value || 0).toLocaleString()}</div>
      </div>

      <button class="pd-offer-btn" onclick="offerExchange('${p.id}')">
        Offer Exchange
      </button>
    </div>`;

  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function switchImg(src, thumb) {
  const main = document.getElementById('pdMainImg');
  if (main) main.src = src;
  document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

function closeDetail() {
  document.getElementById('pdOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function overlayClick(e) {
  if (e.target === document.getElementById('pdOverlay')) closeDetail();
}

/* ════════════════════════════════════════
   OFFER EXCHANGE  — login gate
════════════════════════════════════════ */
function offerExchange(id) {
  if (!getUser()) {
    showToast('Please log in to offer an exchange.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1300);
    return;
  }
  showToast('Exchange offer sent! 🎉', 'success');
}

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
function getUser() {
  return JSON.parse(
    localStorage.getItem('barterUser') ||
    localStorage.getItem('bartifyUser') ||
    'null'
  );
}

function checkLoginState() {
  const user = getUser();
  const out  = document.getElementById('navLoggedOut');
  const inn  = document.getElementById('navLoggedIn');

  if (user) {
    out.style.setProperty('display', 'none', 'important');
    inn.style.setProperty('display', 'flex', 'important');

    const pic = document.getElementById('navProfilePic');
    const av  = document.getElementById('navAvatar');

    // support all possible keys
    const avatarPath = user.avatar || user.picture || user.user_image || null;
    const avatarUrl  = toImageUrl(avatarPath);

    if (avatarUrl) {
      pic.src = avatarUrl;
      pic.style.setProperty('display', 'block', 'important');
      av.style.setProperty('display', 'none', 'important');
    } else {
      av.textContent = (user.firstName || user.name || 'U').charAt(0).toUpperCase();
      av.style.setProperty('display', 'flex', 'important');
      pic.style.setProperty('display', 'none', 'important');
    }

    const fullName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : (user.name || 'User');
    document.getElementById('dropdownName').textContent  = fullName;
    document.getElementById('dropdownEmail').textContent = user.email || '';

    const heroBtn = document.getElementById('heroBtn');
    if (heroBtn) { heroBtn.textContent = 'Start Trading'; heroBtn.href = 'list-item.html'; }
  } else {
    out.style.setProperty('display', 'flex', 'important');
    inn.style.setProperty('display', 'none', 'important');
  }
}

function toggleDropdown() {
  document.getElementById('navDropdown').classList.toggle('show');
}
document.addEventListener('click', function(e) {
  const wrap = document.querySelector('.nav-avatar-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('navDropdown');
    if (dd) dd.classList.remove('show');
  }
  const mBtn = document.querySelector('.mobile-search-btn');
  const mBar = document.getElementById('mobileSearchBar');
  if (mBar && mBtn && !mBar.contains(e.target) && !mBtn.contains(e.target)) {
    mBar.classList.remove('open');
  }
});
function logoutUser() {
  localStorage.removeItem('barterUser');
  localStorage.removeItem('bartifyUser');
  window.location.href = 'index.html';
}

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
function showToast(msg, type) {
  const icons = { success:'bi-check-circle-fill', error:'bi-x-circle-fill' };
  const t = document.createElement('div');
  t.className = `toast-item ${type || ''}`;
  t.innerHTML = `<i class="bi ${icons[type] || 'bi-info-circle-fill'}"></i> ${msg}`;
  document.getElementById('toastWrap').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
const API_BASE_URL = 'http://127.0.0.1:8000';

function toImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}

window.addEventListener('DOMContentLoaded', () => {
  seedIfEmpty();
  checkLoginState();
  renderProducts();

  const justAdded  = localStorage.getItem('bartifyJustAdded');
  const justEdited = localStorage.getItem('bartifyJustEdited');
  if (justAdded)  { localStorage.removeItem('bartifyJustAdded');  showToast('Listing published! 🎉','success'); }
  if (justEdited) { localStorage.removeItem('bartifyJustEdited'); showToast('Listing updated!','success'); }
});