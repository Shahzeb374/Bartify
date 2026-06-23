

/* ═══ DEMO SEED PRODUCTS ═══ */
const DEMO_PRODUCTS = [
  { id:'demo-1', title:'Vintage Leather Armchair', cat:'Furniture',
    desc:'Beautiful mid-century modern leather armchair in excellent condition. Minor wear on armrests, adds character.',
    cond:8, value:450, valueFrom:400, valueTo:500, trade:'Bookshelf or Desk Lamp',
    date:'2026-04-08', seller:{ name:'Sarah Johnson', avatar:null },
    images:['https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=700&q=80',
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&q=80'] },
  { id:'demo-2', title:'Canon EOS 5D Mark III Camera', cat:'Electronics',
    desc:'Professional DSLR camera with low shutter count. Includes battery, charger, and strap. Perfect working condition.',
    cond:9, value:1200, valueFrom:1100, valueTo:1300, trade:'Laptop or Drone',
    date:'2026-04-10', seller:{ name:'Ali Raza', avatar:null },
    images:['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=700&q=80'] },
  { id:'demo-3', title:'Mountain Bike – Trek X-Caliber', cat:'Sports',
    desc:'29" mountain bike, aluminum frame, disc brakes. Recently serviced, new tires installed.',
    cond:8, value:650, valueFrom:600, valueTo:700, trade:'Gaming Console',
    date:'2026-04-15', seller:{ name:'Usman Khan', avatar:null },
    images:['https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=700&q=80'] },
  { id:'demo-4', title:'Web Design Service', cat:'Services',
    desc:'Professional website design service. I will design a modern, responsive website for your business or portfolio.',
    cond:0, value:300, valueFrom:250, valueTo:400, trade:'Graphic Design or Video Editing',
    date:'2026-04-16', seller:{ name:'Hina Malik', avatar:null },
    images:['https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=700&q=80'] },
  { id:'demo-5', title:'Acoustic Guitar – Yamaha F310', cat:'Music',
    desc:'Full-size acoustic guitar. Minor pick scratches on body, plays perfectly. Includes bag.',
    cond:7, value:200, valueFrom:180, valueTo:220, trade:'Keyboard or Ukulele',
    date:'2026-04-17', seller:{ name:'Bilal Ahmed', avatar:null },
    images:['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=700&q=80'] },
  { id:'demo-6', title:'The Art of War – Collector\'s Set', cat:'Books',
    desc:"Collector's edition hardcover set. Excellent condition, barely read. A must for any bookshelf.",
    cond:9, value:85, valueFrom:80, valueTo:100, trade:'Other books or board games',
    date:'2026-04-18', seller:{ name:'Sara Ahmed', avatar:null },
    images:['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&q=80'] }
];

function seedIfEmpty() {
  let existing = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
  // Refresh demos if they exist but use old format (no valueFrom)
  const hasDemos = existing.some(p => String(p.id).startsWith('demo-'));
  const demosOutdated = existing.some(p => String(p.id).startsWith('demo-') && p.valueFrom === undefined);
  if (!hasDemos || demosOutdated) {
    const userProducts = existing.filter(p => !String(p.id).startsWith('demo-'));
    localStorage.setItem('bartifyProducts', JSON.stringify([...DEMO_PRODUCTS, ...userProducts]));
  }
}

/* ═══ STATE ═══ */
let activeCategory = 'All';
let currentQuery   = '';

/* ═══ FILTERS ═══ */
function filterCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.cat;
  const h = document.getElementById('productsHeading');
  if (h) h.textContent = activeCategory === 'All' ? 'All Listings' : activeCategory + ' Listings';
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

/* ═══ RENDER GRID ═══ */
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
        <div class="empty-sub">${currentQuery ? 'Try a different keyword or category.' : 'Be the first to list an item!'}</div>
        <a href="dashboard.html?section=addListing" class="btn-list-first">List an Item</a>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => cardHTML(p)).join('');
}

/* ═══ VALUE HELPER ═══ */
function getDisplayValue(p) {
  if (p.valueFrom !== undefined && p.valueTo !== undefined && Number(p.valueTo) > 0) {
    if (Number(p.valueFrom) === Number(p.valueTo)) return Number(p.valueFrom).toLocaleString();
    return Number(p.valueFrom).toLocaleString() + ' — ' + Number(p.valueTo).toLocaleString();
  }
  if (p.valueFrom !== undefined && Number(p.valueFrom) > 0) return Number(p.valueFrom).toLocaleString();
  return Number(p.value || 0).toLocaleString();
}

/* ═══ CARD HTML ═══ */
function cardHTML(p) {
  const hasImg = p.images && p.images.length;
  const imgEl  = hasImg
    ? `<img src="${p.images[0]}" alt="${esc(p.title)}" class="pc-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const phEl = `<div class="pc-img-placeholder"${hasImg ? ' style="display:none"' : ''}><i class="bi bi-image"></i></div>`;

  const sellerName = (p.seller && p.seller.name) ? p.seller.name : (p.ownerName || 'Bartify User');
  const sellerInit = sellerName.charAt(0).toUpperCase();
  const dateStr    = p.date ? new Date(p.date).toLocaleDateString('en-PK',{ month:'short', day:'numeric', year:'numeric' }) : '';

  return `
    <div class="product-card" onclick="openDetail('${p.id}')">
      <div class="pc-img-wrap">
        ${imgEl}${phEl}
        <span class="pc-cat-badge">${esc(p.cat || 'General')}</span>
      </div>
      <div class="pc-body">
        <div class="pc-owner">
          <div class="pc-owner-avatar">${sellerInit}</div>
          <span class="pc-owner-name">${esc(sellerName)}</span>
          ${dateStr ? `<span class="pc-owner-date">${dateStr}</span>` : ''}
        </div>
        <h3 class="pc-title">${esc(p.title)}</h3>
        ${p.desc ? `<p class="pc-desc">${esc(p.desc)}</p>` : ''}
        <div class="pc-bottom">
          <div>
            <div class="pc-value-label">Est. value</div>
            <div class="pc-value">Rs. ${getDisplayValue(p)}</div>
          </div>
          <button class="pc-view-btn" onclick="event.stopPropagation();openDetail('${p.id}')">View Details</button>
        </div>
      </div>
    </div>`;
}

/* ═══ DETAIL MODAL ═══ */
function openDetail(id) {
  const list = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
  const p    = list.find(x => x.id === id);
  if (!p) return;

  const condLabel = p.cond ? (p.cond + '/10') : (p.condLabel || '');
  const condClass = p.cond >= 9 ? 'like-new' : p.cond >= 7 ? 'good' : p.cond >= 5 ? 'fair' : 'poor';

  const sellerName = (p.seller && p.seller.name) ? p.seller.name : (p.ownerName || 'Bartify User');
  const sellerInit = sellerName.charAt(0).toUpperCase();
  const sellerAvHTML = (p.seller && p.seller.avatar) ? `<img src="${p.seller.avatar}" alt="">` : sellerInit;
  const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-US',{ month:'numeric', day:'numeric', year:'numeric' }) : '';

  const imgs = (p.images && p.images.length) ? p.images : [];
  const mainHTML = imgs.length
    ? `<img src="${imgs[0]}" alt="${esc(p.title)}" class="pd-main-img" id="pdMainImg">`
    : `<div class="pd-main-placeholder"><i class="bi bi-image"></i></div>`;
  const thumbsHTML = imgs.length > 1
    ? `<div class="pd-thumbs">${imgs.map((src,i) =>
        `<img src="${src}" class="pd-thumb${i===0?' active':''}" onclick="switchImg('${src}',this)" alt="">`
      ).join('')}</div>` : '';

  const tradeHTML = p.trade
    ? `<div class="pd-label">Looking for</div><p class="pd-trade-text">${esc(p.trade)}</p>` : '';

  /* Condition pill — numeric format */
  const condPillHTML = condLabel
    ? `<div class="pd-cond-pill ${condClass}">
         <i class="bi bi-patch-check-fill" style="font-size:14px;"></i>
         Condition: ${esc(condLabel)}
       </div>` : '';

  document.getElementById('pdBody').innerHTML = `
    <div class="pd-gallery">
      ${mainHTML}
      ${thumbsHTML}
    </div>
    <div class="pd-info">
      <h2 class="pd-title">${esc(p.title)}</h2>
      <div class="pd-seller">
        <div class="pd-seller-av">${sellerAvHTML}</div>
        <div><div class="pd-seller-name">${esc(sellerName)}</div></div>
      </div>
      <div class="pd-seller-meta">
        ${dateStr ? `<span><i class="bi bi-calendar3"></i> ${dateStr}</span>` : ''}
        <span><i class="bi bi-tag"></i> ${esc(p.cat||'General')}</span>
      </div>
      ${condPillHTML}
      <div class="pd-label">Description</div>
      <p class="pd-section-text">${esc(p.desc || 'No description provided.')}</p>
      ${tradeHTML}
      <div class="pd-value-box">
        <div class="pd-label">Estimated value</div>
        <div class="pd-value-big">Rs. ${getDisplayValue(p)}</div>
      </div>
      <button class="pd-offer-btn" onclick="offerExchange('${p.id}')">Offer Exchange</button>
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

/* ═══ OFFER EXCHANGE — login gate ═══ */
function offerExchange(id) {
  if (!getUser()) {
    showToast('Please log in to offer an exchange.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1300);
    return;
  }
  showToast('Exchange offer sent! 🎉', 'success');
}

/* ═══ AUTH ═══ */
const API_BASE_URL = 'http://127.0.0.1:8000';

function resolveProfileImageUrl(src) {
  if (!src) return null;
  if (/^data:|^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`;
  return src;
}

function getUser() {
  const raw = JSON.parse(
    localStorage.getItem('barterUser') ||
    localStorage.getItem('bartifyUser') ||
    'null'
  );

  if (!raw) return null;

  const avatar = resolveProfileImageUrl(raw.avatar || raw.picture || raw.user_image || null);
  return {
    ...raw,
    avatar,
    picture: resolveProfileImageUrl(raw.picture || avatar),
    user_image: resolveProfileImageUrl(raw.user_image || avatar)
  };
}

function getUserAvatar(user) {
  if (!user) return null;
  return user.avatar || user.picture || user.user_image || null;
}

function checkLoginState() {
  const user = getUser();
  const out  = document.getElementById('navLoggedOut');
  const inn  = document.getElementById('navLoggedIn');

  if (user) {
    out.style.setProperty('display','none','important');
    inn.style.setProperty('display','flex','important');

    const pic    = document.getElementById('navProfilePic');
    const av     = document.getElementById('navAvatar');
    const avatar = getUserAvatar(user);

    if (avatar) {
      pic.src = avatar;
      pic.style.setProperty('display','block','important');
      av.style.setProperty('display','none','important');
    } else {
      av.textContent = (user.firstName || user.name || 'U').charAt(0).toUpperCase();
      av.style.setProperty('display','flex','important');
      pic.style.setProperty('display','none','important');
    }

    const fullName = user.firstName
      ? `${user.firstName} ${user.lastName||''}`.trim()
      : (user.name || 'User');
    document.getElementById('dropdownName').textContent  = fullName;
    document.getElementById('dropdownEmail').textContent = user.email || '';

    // Set dropdown avatar picture or initial
    const ddAv = document.getElementById('dropdownAvatar');
    if (ddAv) {
      if (avatar) {
        ddAv.innerHTML = `<img src="${avatar}" alt="avatar">`;
      } else {
        const initial = (user.firstName || user.name || 'U').charAt(0).toUpperCase();
        ddAv.innerHTML = `<span style="color:#fff;font-weight:700;font-size:15px;">${initial}</span>`;
      }
    }

    const heroBtn = document.getElementById('heroBtn');
    if (heroBtn) { heroBtn.textContent = 'Start Trading'; heroBtn.href = 'dashboard.html?section=addListing'; }
  } else {
    out.style.setProperty('display','flex','important');
    inn.style.setProperty('display','none','important');
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

/* ═══ TOAST ═══ */
function showToast(msg, type) {
  const icons = { success:'bi-check-circle-fill', error:'bi-x-circle-fill' };
  const t = document.createElement('div');
  t.className = `toast-item ${type || ''}`;
  t.innerHTML = `<i class="bi ${icons[type]||'bi-info-circle-fill'}"></i> ${msg}`;
  document.getElementById('toastWrap').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══ INIT ═══ */
document.addEventListener('DOMContentLoaded', () => {
  seedIfEmpty();
  checkLoginState();
  renderProducts();

  const justAdded  = localStorage.getItem('bartifyJustAdded');
  const justEdited = localStorage.getItem('bartifyJustEdited');
  if (justAdded)  { localStorage.removeItem('bartifyJustAdded');  showToast('Listing published! 🎉','success'); }
  if (justEdited) { localStorage.removeItem('bartifyJustEdited'); showToast('Listing updated!','success'); }
});