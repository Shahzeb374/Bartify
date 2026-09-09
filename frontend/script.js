/* ═══ STATE ═══ */

/* ═══ STATE ═══ */
let activeCategory = 'All';
let currentQuery   = '';
let cachedPosts    = [];   // API se aaye posts yahan store honge
let detailRequest = 0;
let detailPost = null;
let reportTarget = null;
let reportSubmitting = false;

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
async function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  // Loading state
  grid.innerHTML = `
    <div class="products-empty">
      <div class="empty-icon" style="font-size:2rem;">⏳</div>
      <div class="empty-title">Loading listings…</div>
    </div>`;

  try {
    // Build query params
    const params = new URLSearchParams();
    if (activeCategory !== 'All') params.set('category', activeCategory);
    if (currentQuery)             params.set('search', currentQuery);
    params.set('page_size', '50');

    const token = localStorage.getItem('barterToken');
    const res = await fetch(`${API_BASE_URL}/posts/?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Server error: ' + res.status);

    const data = await res.json();
    const list = data.posts || [];
    cachedPosts = list;   // cache kar lo

    // Fix image URLs (relative → absolute)
    list.forEach(p => {
      if (p.images) {
        p.images = p.images.map(src =>
          src && src.startsWith('/uploads/') ? `${API_BASE_URL}${src}` : src
        );
      }
      if (p.seller && p.seller.avatar && p.seller.avatar.startsWith('/uploads/')) {
        p.seller.avatar = `${API_BASE_URL}${p.seller.avatar}`;
      }
    });

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

    // Agar dashboard se ?view=<id> ke saath redirect hua ho — wahi modal kholo
    const viewId = new URLSearchParams(window.location.search).get('view');
    if (viewId) {
      openDetail(viewId);
      window.history.replaceState({}, '', window.location.pathname);
    }

  } catch (err) {
    console.error('Failed to load posts:', err);
    grid.innerHTML = `
      <div class="products-empty">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not load listings</div>
        <div class="empty-sub">Make sure the server is running. <a href="#" onclick="renderProducts();return false;">Retry</a></div>
      </div>`;
  }
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
async function openDetail(id) {
  const sequence = ++detailRequest;
  detailPost = null;
  document.getElementById('pdBody').textContent = 'Loading listing and owner details...';
  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(response.status === 404 ? 'This listing is no longer available.' : 'Could not load listing details. Please retry.');
    const p = await response.json();
    if (sequence !== detailRequest) return;
    p.images = (p.images || []).map(resolveProfileImageUrl);
    detailPost = p;
    renderPostDetail(p);
  } catch (error) {
    if (sequence !== detailRequest) return;
    document.getElementById('pdBody').textContent = error.message;
    const retry = document.createElement('button');
    retry.className = 'pc-view-btn'; retry.textContent = 'Retry';
    retry.onclick = () => openDetail(id);
    document.getElementById('pdBody').append(retry);
  }
}

function renderPostDetail(p) {

  const condLabel = p.cond ? (p.cond + '/10') : (p.condLabel || '');
  const condClass = p.cond >= 9 ? 'like-new' : p.cond >= 7 ? 'good' : p.cond >= 5 ? 'fair' : 'poor';

  const sellerName = (p.seller && p.seller.name) ? p.seller.name : (p.ownerName || 'Bartify User');
  const sellerInit = sellerName.charAt(0).toUpperCase();
  const sellerAvatar = resolveProfileImageUrl(p.seller?.avatar);
  const sellerAvHTML = sellerAvatar ? `<img src="${esc(sellerAvatar)}" alt="Profile of ${esc(sellerName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(sellerInit)}</span>` : esc(sellerInit);
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
      <button type="button" class="pd-seller pd-owner-trigger" onclick="openOwnerProfile()" aria-haspopup="dialog" aria-controls="ownerProfileDialog" aria-label="View owner profile">
        <div class="pd-seller-av">${sellerAvHTML}</div>
        <div><div class="pd-seller-name">${esc(sellerName)}</div></div>
        <span class="pd-profile-hint">View profile</span>
      </button>

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
      <button type="button" class="report-link" onclick="openReport('post',${p.id})">Report post</button>
    </div>`;

  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function openOwnerProfile() {
  const p = detailPost;
  if (!p) return;
  const seller = p.seller;
  const stats = seller.barter_stats;
  const avatar = resolveProfileImageUrl(seller.avatar);
  const initial = esc((seller.name || 'U').charAt(0).toUpperCase());
  document.getElementById('ownerProfileBody').innerHTML = `
    <div class="owner-card-heading">
      <div class="pd-seller-av owner-card-avatar">${avatar ? '<img src="' + esc(avatar) + '" alt="Owner profile image" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>' + initial + '</span>' : initial}</div>
      <h3>${esc(seller.name)}</h3>
    </div>
      <section class="pd-owner-profile" aria-label="Listing owner profile">
        <p class="pd-owner-email">${esc(p.seller.email)}</p>
        <div class="pd-barter-stats">
          <div class="barter-stat stat-success"><strong>${stats.accepted}</strong><span>Successful (accepted)</span></div>
          <div class="barter-stat stat-failed"><strong>${stats.rejected}</strong><span>Failed (rejected)</span></div>
          <div class="barter-stat stat-pending"><strong>${stats.pending}</strong><span>Pending</span></div>
          <div class="barter-stat stat-total"><strong>${stats.total}</strong><span>Total offers</span></div>
        </div>
        <p class="pd-stats-note">Includes offers sent and received. Accepted offers do not confirm a completed handover.</p>
        <button type="button" class="report-link" onclick="openReport('user',${p.user_id})">Report user</button>
      </section>
  `;
  document.getElementById('ownerProfileDialog').showModal();
}

function switchImg(src, thumb) {
  const main = document.getElementById('pdMainImg');
  if (main) main.src = src;
  document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

function closeDetail() {
  detailRequest++;
  detailPost = null;
  document.getElementById('pdOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function overlayClick(e) {
  if (e.target === document.getElementById('pdOverlay')) closeDetail();
}

/* ═══ OFFER EXCHANGE — apna item detail dekar offer bhejna ═══ */
let offerImages     = [null, null, null, null];
let offerImageFiles = [null, null, null, null];

function offerExchange(id) {
  if (!getUser()) {
    showToast('Please log in to offer an exchange.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1300);
    return;
  }

  const p = cachedPosts.find(x => String(x.id) === String(id));
  closeDetail();

  document.getElementById('offerPostId').value = id;
  document.getElementById('offerSubText').textContent = p
    ? `Tell ${(p.seller && p.seller.name) || 'them'} what you'd like to trade for "${p.title}".`
    : `Tell them what you'd like to trade.`;

  document.getElementById('offerForm').reset();
  offerImages     = [null, null, null, null];
  offerImageFiles = [null, null, null, null];
  renderOfferUploadSlots();

  document.getElementById('offerOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeOfferModal() {
  document.getElementById('offerOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function overlayClickOffer(e) {
  if (e.target === document.getElementById('offerOverlay')) closeOfferModal();
}

function renderOfferUploadSlots() {
  const grid = document.getElementById('offerUploadGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const box = document.createElement('div');
    box.className = 'of-upload-box';
    if (offerImages[i]) {
      box.innerHTML = `
        <img src="${offerImages[i]}" class="of-preview" alt="img ${i+1}">
        <button type="button" class="of-remove" onclick="removeOfferImage(${i})"><i class="bi bi-x"></i></button>`;
    } else {
      box.innerHTML = `
        <i class="bi bi-cloud-arrow-up"></i>
        <span>${i === 0 ? 'Upload' : 'Add'}</span>
        <input type="file" accept="image/*" onchange="handleOfferImageUpload(event,${i})">`;
    }
    grid.appendChild(box);
  }
}

function handleOfferImageUpload(e, index) {
  const file = e.target.files[0];
  if (!file) return;
  offerImageFiles[index] = file;
  const reader = new FileReader();
  reader.onload = ev => { offerImages[index] = ev.target.result; renderOfferUploadSlots(); };
  reader.readAsDataURL(file);
}

function removeOfferImage(index) {
  offerImages[index]     = null;
  offerImageFiles[index] = null;
  renderOfferUploadSlots();
}

async function submitOffer(e) {
  e.preventDefault();
  const token = localStorage.getItem('barterToken');
  if (!token) {
    showToast('Please log in to offer an exchange.', 'error');
    return;
  }

  const postId = document.getElementById('offerPostId').value;
  const title = document.getElementById('offerTitle').value.trim();
  const cat   = document.getElementById('offerCat').value;
  if (!title || !cat) { showToast('Please fill in Title and Category.', 'error'); return; }

  const fromValCheck = document.getElementById('offerValueFrom').value;
  const toValCheck   = document.getElementById('offerValueTo').value;
  if (fromValCheck && toValCheck && Number(fromValCheck) > Number(toValCheck)) {
    showToast('"To" value must be greater than or equal to "From".', 'error');
    return;
  }

  const btn = document.getElementById('offerSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Sending…`;

  const fromVal = document.getElementById('offerValueFrom').value || '0';

  const formData = new FormData();
  formData.append('post_id', document.getElementById('offerPostId').value);
  formData.append('title', title);
  formData.append('description', document.getElementById('offerDesc').value.trim());
  formData.append('category', cat);
  formData.append('price_from', fromVal);
  formData.append('price_to', document.getElementById('offerValueTo').value || fromVal);
  formData.append('condition_score', document.getElementById('offerCond').value || '0');
  offerImageFiles.forEach(file => { if (file) formData.append('images', file); });

  try {
    const res = await fetch(`${API_BASE_URL}/offers/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'Failed to send offer');

    closeOfferModal();
    openDetail(postId);
    showToast('Exchange offer sent! 🎉', 'success');
  } catch (err) {
    showToast(err.message || 'Could not send offer.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send"></i> Send Offer`;
  }
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

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return !payload.exp || Date.now() >= payload.exp * 1000;
  } catch (e) {
    return true; // decode na ho saka to expired treat karo
  }
}

function clearSession() {
  localStorage.removeItem('barterToken');
  localStorage.removeItem('barterUser');
  localStorage.removeItem('bartifyUser');
}

function checkLoginState() {
  const token = localStorage.getItem('barterToken');
  if (token && isTokenExpired(token)) {
    clearSession();
    showToast('Session expired. Please log in again.', 'error');
  }

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

function confirmLogout() {
  new bootstrap.Modal(document.getElementById('logoutModal')).show();
}

function doLogout() {
  clearSession();
  const modal = document.getElementById('logoutModal');
  const instance = bootstrap.Modal.getInstance(modal);
  if (instance) instance.hide();
  showToast('Logged out. Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1400);
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
  confirmLogout();
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

// Koi bhi API call 401 de to session clear karke UI turant update karo
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).then(response => {
    if (response.status === 401 && localStorage.getItem('barterToken')) {
      clearSession();
      checkLoginState();
      showToast('Session expired. Please log in again.', 'error');
    }
    return response;
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const user = await BartifySession.resolve({memberOnly: true, optional: true});
    if (!user && localStorage.getItem('barterToken')) return;
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  checkLoginState();
  renderProducts();

  const justAdded  = localStorage.getItem('bartifyJustAdded');
  const justEdited = localStorage.getItem('bartifyJustEdited');
  if (justAdded)  { localStorage.removeItem('bartifyJustAdded');  showToast('Listing published! 🎉','success'); }
  if (justEdited) { localStorage.removeItem('bartifyJustEdited'); showToast('Listing updated!','success'); }
});

/* User and post reporting. Identity and target permissions are checked by the API. */
function openReport(type, id) {
  if (reportSubmitting) return;
  reportTarget = {target_type:type, target_id:Number(id)};
  const post = detailPost || cachedPosts.find(p => Number(p.id) === Number(id));
  document.getElementById('reportTitle').textContent = type === 'user' ? 'Report user' : 'Report post';
  document.getElementById('reportSubject').textContent = type === 'user' ? (post?.seller?.name || 'Listing owner') : (post?.title || `Post #${id}`);
  document.getElementById('reportForm').reset();
  document.getElementById('reportStatus').textContent = '';
  const signedIn = Boolean(localStorage.getItem('barterToken'));
  document.getElementById('reportForm').hidden = !signedIn;
  document.getElementById('reportLogin').hidden = signedIn;
  document.getElementById('submitReport').disabled = false;
  document.getElementById('reportDialog').showModal();
}

document.getElementById('closeReport').addEventListener('click', () => {
  if (!reportSubmitting) document.getElementById('reportDialog').close();
});
document.getElementById('reportDialog').addEventListener('cancel', event => {
  if (reportSubmitting) event.preventDefault();
});
document.getElementById('reportForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!reportTarget || reportSubmitting) return;
  const details = document.getElementById('reportDetails').value.trim();
  const status = document.getElementById('reportStatus');
  if (details.length < 10) { status.textContent = 'Please describe the problem in at least 10 characters.'; return; }
  reportSubmitting = true;
  document.getElementById('submitReport').disabled = document.getElementById('closeReport').disabled = true;
  status.textContent = 'Submitting report...';
  try {
    const response = await fetch(`${API_BASE_URL}/reports/`, {
      method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('barterToken') || ''}`},
      body:JSON.stringify({...reportTarget, reason:document.getElementById('reportReason').value, details}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not submit the report. Please retry.');
    status.textContent = data.message;
    document.getElementById('reportForm').hidden = true;
  } catch (error) { status.textContent = error.message; }
  finally {
    reportSubmitting = false;
    document.getElementById('submitReport').disabled = document.getElementById('closeReport').disabled = false;
  }
});

document.getElementById("closeOwnerProfile").addEventListener("click", () => document.getElementById("ownerProfileDialog").close());
