// ══════════════════════════════════════════════
// USER
// ══════════════════════════════════════════════
function getUser() {
  try {
    return JSON.parse(
      localStorage.getItem('barterUser') ||
      localStorage.getItem('bartifyUser') ||
      'null'
    ) || {};
  } catch(e) { return {}; }
}

function applyUser() {
  const u = getUser();
  const firstName = u.firstName || (u.name ? u.name.split(' ')[0] : 'User');
  const lastName  = u.lastName  || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
  const full      = `${firstName} ${lastName}`.trim() || 'User';
  const initial   = firstName.charAt(0).toUpperCase() || 'U';
  const av        = u.avatar || u.picture || null;

  document.getElementById('sidebarName').textContent  = full;
  document.getElementById('sidebarEmail').textContent = u.email || '';

  const sbAv = document.getElementById('sidebarAvatar');
  if (av) { sbAv.innerHTML = `<img src="${av}" alt="avatar">`; }
  else    { sbAv.textContent = initial; }

  const hBtn = document.getElementById('headerProfileBtn');
  if (av) { hBtn.innerHTML = `<img src="${av}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
  else    { hBtn.innerHTML = `<i class="fa-solid fa-user"></i>`; }
}

// Auto-set valueTo minimum when valueFrom changes
function syncValueTo() {
  const from = parseInt(document.getElementById('valueFrom').value) || 0;
  const toEl  = document.getElementById('valueTo');
  if (from && (!toEl.value || parseInt(toEl.value) < from)) {
    toEl.placeholder = from + '+';
  }
}
let sidebarOpen = true;

function toggleSidebar() {
  if (window.innerWidth < 769) {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay').style.display =
      sb.classList.contains('mobile-open') ? 'block' : 'none';
  } else {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
    document.getElementById('header').classList.toggle('sidebar-collapsed', !sidebarOpen);
    document.getElementById('main').classList.toggle('sidebar-collapsed', !sidebarOpen);
  }
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

function toggleGroup(hdr) {
  hdr.classList.toggle('open');
  hdr.nextElementSibling.classList.toggle('open');
}

function scrollToTop() {
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ══════════════════════════════════════════════
// BACK BUTTON — always goes to Dashboard → addListing
// ══════════════════════════════════════════════
function goBack() {
  window.location.href = 'dashboard.html?section=addListing';
}

// ══════════════════════════════════════════════
// IMAGE UPLOAD (up to 4)
// ══════════════════════════════════════════════
let uploadedImages = [null, null, null, null];

function renderUploadSlots() {
  const grid = document.getElementById('uploadGrid');
  grid.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const box = document.createElement('div');
    box.className = 'upload-box';
    box.id = `slot-${i}`;

    if (uploadedImages[i]) {
      box.innerHTML = `
        <img src="${uploadedImages[i]}" class="preview-img" alt="img ${i+1}">
        <button type="button" class="remove-img" onclick="removeImage(${i})">
          <i class="fa-solid fa-times"></i>
        </button>`;
    } else {
      box.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>${i === 0 ? 'Upload' : 'Add'}</span>
        <input type="file" accept="image/*" onchange="handleImageUpload(event, ${i})">`;
    }
    grid.appendChild(box);
  }
}

function handleImageUpload(e, index) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedImages[index] = ev.target.result;
    renderUploadSlots();
  };
  reader.readAsDataURL(file);
}

function removeImage(index) {
  uploadedImages[index] = null;
  renderUploadSlots();
}

// ══════════════════════════════════════════════
// EDIT MODE — pre-fill form
// ══════════════════════════════════════════════
let editingId = null;

function checkEditMode() {
  const params = new URLSearchParams(window.location.search);
  const mode   = params.get('mode');
  const id     = params.get('id') || params.get('edit') ||
                 localStorage.getItem('bartifyEditListingId');

  if ((mode === 'edit' || params.get('edit')) && id) {
    editingId = id;
    const products = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;

    // Update titles
    document.getElementById('formTitle').textContent    = 'Edit Listing';
    document.getElementById('headerTitle').textContent  = 'Edit Listing';
    document.getElementById('publishBtnText').textContent = 'Save Changes';

    // Fill fields
    document.getElementById('itemTitle').value = p.title || '';
    document.getElementById('itemDesc').value  = p.desc  || '';
    document.getElementById('itemCat').value   = p.cat || p.category || '';
    document.getElementById('itemTrade').value = p.trade || '';

    // Condition — just numeric now
    const condVal = p.cond ? String(p.cond) : '';
    document.getElementById('itemCond').value = condVal;

    // Value range
    if (p.valueFrom !== undefined) {
      document.getElementById('valueFrom').value = p.valueFrom;
      document.getElementById('valueTo').value   = p.valueTo || '';
    } else if (p.value) {
      document.getElementById('valueFrom').value = p.value;
      document.getElementById('valueTo').value   = p.value;
    }

    // Images
    const imgs = p.images || (p.image ? [p.image] : []);
    imgs.forEach((src, i) => { if (i < 4) uploadedImages[i] = src; });
    renderUploadSlots();

    localStorage.removeItem('bartifyEditListingId');
  }
}

// ══════════════════════════════════════════════
// PUBLISH / SAVE
// ══════════════════════════════════════════════
function publishListing(e) {
  e.preventDefault();

  const title = document.getElementById('itemTitle').value.trim();
  const cat   = document.getElementById('itemCat').value;
  if (!title || !cat) { showToast('Please fill in Title and Category.','error'); return; }

  const fromVal = parseInt(document.getElementById('valueFrom').value) || 0;
  const toVal   = parseInt(document.getElementById('valueTo').value)   || fromVal;
  const condVal = parseInt(document.getElementById('itemCond').value)  || 0;

  // Condition label mapping
  const condLabel = condVal >= 9 ? 'Like New' : condVal >= 7 ? 'Good' : condVal >= 5 ? 'Fair' : condVal > 0 ? 'Poor' : '';

  const images = uploadedImages.filter(Boolean);
  const user   = getUser();
  const today  = new Date().toISOString().split('T')[0];

  let products = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');

  if (editingId) {
    // UPDATE existing
    products = products.map(p => {
      if (String(p.id) === String(editingId)) {
        return {
          ...p,
          title, cat, category:cat,
          desc:   document.getElementById('itemDesc').value.trim(),
          trade:  document.getElementById('itemTrade').value.trim(),
          cond:   condVal, condLabel,
          value:  fromVal, valueFrom:fromVal, valueTo:toVal,
          images: images.length ? images : (p.images || []),
          status: p.status || 'active'
        };
      }
      return p;
    });
    localStorage.setItem('bartifyProducts', JSON.stringify(products));
    localStorage.setItem('bartifyJustEdited', '1');
    showToast('Listing updated!', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html?section=editListing'; }, 1000);

  } else {
    // NEW listing
    const newProduct = {
      id:         'p-' + Date.now(),
      title, cat, category:cat,
      desc:       document.getElementById('itemDesc').value.trim(),
      trade:      document.getElementById('itemTrade').value.trim(),
      cond:       condVal, condLabel,
      value:      fromVal, valueFrom:fromVal, valueTo:toVal,
      images,
      status:     'active',
      date:       today,
      seller: {
        name:   user.firstName ? `${user.firstName} ${user.lastName||''}`.trim() : (user.name || 'User'),
        avatar: user.avatar || user.picture || null
      },
      ownerEmail: user.email || ''
    };
    products.push(newProduct);
    localStorage.setItem('bartifyProducts', JSON.stringify(products));
    localStorage.setItem('bartifyJustAdded', '1');
    showToast('Listing published! 🎉', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html?section=activeListings'; }, 1000);
  }
}

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════
function showToast(msg, type='') {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', '':'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast-msg ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons['']}"></i> ${msg}`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyUser();
  renderUploadSlots();
  checkEditMode();
});