// Dashboard authentication, overview, and pending post moderation.
document.addEventListener('DOMContentLoaded', () => {
  const API = BartifySession.api;
  const $ = id => document.getElementById(id);
  let page = 1;
  let posts = [];
  let selected = null;
  let refreshing = false;
  let deciding = false;
  let searchTimer;
  let queueRequest = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const label = value => ({clean:'Clean', issue:'Issue', unavailable:'Check unavailable'}[value] || 'Check unavailable');
  const confidence = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

  window.adminNotice = message => { $('overviewStatus').textContent = message; };

  async function request(path, options = {}) {
    const token = localStorage.getItem('barterToken');
    if (!token) { window.location.replace('login.html'); throw new Error('Please log in again.'); }
    const response = await fetch(`${API}${path}`, {
      ...options, headers: {Authorization: `Bearer ${token}`, ...options.headers},
    });
    if (response.status === 401) {
      BartifySession.clear();
      window.location.replace('login.html');
    }
    if (response.status === 403) {
      document.body.classList.add('admin-auth-pending');
      $('adminAccessState').textContent = 'Administrator access is required. Please sign in with an active admin account.';
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(typeof data.detail === 'string' ? data.detail : 'Request failed. Please retry.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function renderOverview(data) {
    $('overviewUsers').textContent = data.total_users.toLocaleString();
    $('overviewListings').textContent = data.total_listings.toLocaleString();
    $('overviewOffers').textContent = data.accepted_offers.toLocaleString();
    $('overviewIssues').textContent = data.issue_count.toLocaleString();
    $('pendingQueueCount').textContent = `(${data.pending_count})`;
    $('notifBtn').querySelector('.notif-dot').style.display = data.pending_count ? '' : 'none';
    $('moderationActivity').innerHTML = data.recent_activity.length ? data.recent_activity.map(item => `
      <li class="activity-item"><div class="activity-text">
        <p><strong>${escape(item.admin_name)}</strong> ${escape(item.decision)} “${escape(item.post_title)}”.</p>
        <span class="activity-time">Model: ${escape(label(item.model_label))} · ${escape(item.created_at ? new Date(item.created_at).toLocaleString() : '')}</span>
      </div></li>`).join('') : '<li class="activity-item">No review decisions yet.</li>';
    return data.unavailable_count;
  }

  async function loadQueue() {
    const sequence = ++queueRequest;
    const search = $('page-dashboard').hidden ? '' : $('searchInput').value.trim();
    const params = new URLSearchParams({page, page_size: 20, search});
    $('queuePrev').disabled = $('queueNext').disabled = true;
    const data = await request(`/admin/pending?${params}`);
    if (sequence !== queueRequest) return;
    if (page > 1 && !data.posts.length) { page--; return loadQueue(); }
    posts = data.posts;
    $('verifyTableBody').innerHTML = posts.map(post => `
      <tr><td class="td-listing">${escape(post.title)}</td><td>${escape(post.user.name)}</td>
      <td class="td-muted">${escape(post.category)}</td><td class="score">${confidence(post.confidence)}</td>
      <td><span class="status ${post.model_label === 'clean' ? 'status-verified' : post.model_label === 'issue' ? 'status-flagged' : 'status-pending-neutral'}">${label(post.model_label)}</span></td>
      <td><button class="btn-mini" data-review-id="${post.id}">Review</button></td></tr>`).join('');
    $('noResults').hidden = posts.length > 0;
    $('noResults').textContent = search ? 'No pending posts match your search.' : 'No posts are waiting for review.';
    $('queuePage').textContent = `${data.total} posts · Page ${page} of ${Math.max(1, Math.ceil(data.total / 20))}`;
    $('queuePrev').disabled = page <= 1;
    $('queueNext').disabled = page * 20 >= data.total;
  }

  async function refresh() {
    if (refreshing || deciding) return;
    refreshing = true;
    $('refreshOverviewBtn').disabled = true;
    window.adminNotice('Refreshing dashboard and model checks…');
    try {
      const data = await request('/admin/refresh', {method: 'POST'});
      const unavailable = renderOverview(data);
      await loadQueue();
      await window.reloadAdminSection?.();
      window.adminNotice(unavailable ? `${unavailable} post(s) could not be checked. Use New Report to retry; they remain pending.` : `Updated ${new Date().toLocaleTimeString()}. All queued posts still need an admin decision.`);
    } catch (error) {
      window.adminNotice(`${error.message} Use New Report to retry.`);
    } finally {
      refreshing = false;
      $('refreshOverviewBtn').disabled = false;
    }
  }

  function openReview(id, post = null) {
    selected = post || posts.find(post => post.id === id);
    if (!selected) return;
    $('reviewTitle').textContent = selected.title;
    $('reviewMeta').textContent = `Post #${selected.id} · ${selected.user.name} · ${selected.category}`;
    $('reviewPrediction').textContent = `Model result: ${label(selected.model_label)} · Confidence: ${confidence(selected.confidence)}`;
    $('reviewDescription').textContent = selected.description;
    $('reviewTrade').textContent = selected.in_exchange_for || 'Not specified';
    $('reviewValue').textContent = `Estimated value: Rs. ${selected.price_from.toLocaleString()} – ${selected.price_to.toLocaleString()} · Condition: ${selected.condition_score}/10`;
    $('reviewImages').replaceChildren();
    selected.images.forEach(path => {
      if (!path?.startsWith('/uploads/')) return;
      const img = document.createElement('img');
      img.src = new URL(path, API).href;
      img.alt = `Image for ${selected.title}`;
      img.loading = 'lazy';
      $('reviewImages').append(img);
    });
    const unavailable = selected.status !== 'pending' || !['clean', 'issue'].includes(selected.model_label);
    $('approvePost').disabled = $('rejectPost').disabled = unavailable;
    $('reviewStatus').textContent = selected.status !== 'pending' ? `This post is ${selected.status}.` : unavailable ? 'Close this review and use New Report to retry the model check.' : '';
    $('moderationDialog').showModal();
  }

  async function decide(decision) {
    if (!selected || selected.status !== 'pending' || deciding) return;
    deciding = true;
    $('approvePost').disabled = $('rejectPost').disabled = $('closeReview').disabled = true;
    $('reviewStatus').textContent = 'Saving decision…';
    try {
      const result = await request(`/admin/posts/${selected.id}/decision`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({decision, revision: selected.revision}),
      });
      $('moderationDialog').close();
      selected = null;
      window.adminNotice(result.message);
      renderOverview(await request('/admin/overview'));
      await loadQueue();
      await window.reloadAdminSection?.();
    } catch (error) {
      if (selected) $('reviewStatus').textContent = error.message;
      window.adminNotice(error.message);
      if (error.status === 409 || error.status === 404) {
        $('moderationDialog').close();
        selected = null;
        await loadQueue().catch(() => {});
      }
    } finally {
      deciding = false;
      $('closeReview').disabled = false;
      $('approvePost').disabled = $('rejectPost').disabled = !selected || selected.status !== 'pending' || !['clean', 'issue'].includes(selected.model_label);
    }
  }

  $('verifyTableBody').addEventListener('click', event => {
    const button = event.target.closest('[data-review-id]');
    if (button) openReview(Number(button.dataset.reviewId));
  });
  $('approvePost').addEventListener('click', () => decide('approve'));
  $('rejectPost').addEventListener('click', () => decide('reject'));
  $('closeReview').addEventListener('click', () => $('moderationDialog').close());
  $('moderationDialog').addEventListener('cancel', event => { if (deciding) event.preventDefault(); });
  $('refreshOverviewBtn').addEventListener('click', refresh);
  $('queuePrev').addEventListener('click', () => { page--; loadQueue().catch(error => window.adminNotice(error.message)); });
  $('queueNext').addEventListener('click', () => { page++; loadQueue().catch(error => window.adminNotice(error.message)); });
  $('searchInput').maxLength = 255;
  $('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    if ($('page-dashboard').hidden) return;
    // Invalidate any request for the previous query immediately.
    queueRequest++;
    searchTimer = setTimeout(() => {
      if ($('page-dashboard').hidden) return;
      page = 1;
      loadQueue().catch(error => window.adminNotice(error.message));
    }, 250);
  });
  window.resetAdminQueue = () => {
    clearTimeout(searchTimer);
    $('searchInput').value = ''; page = 1;
    loadQueue().catch(error => window.adminNotice(error.message));
  };
  document.querySelector('.logout-link').addEventListener('click', event => {
    event.preventDefault(); BartifySession.clear(); window.location.replace('login.html');
  });
  $('helpBtn').addEventListener('click', () => {
    window.navigateAdmin('dashboard');
    window.adminNotice('Use New Report to refresh. Open Review to inspect a pending post, then approve or reject it. Sidebar pages show real records; Reports contains model-flagged posts and review history.');
  });
  $('notifBtn').addEventListener('click', () => {
    window.navigateAdmin('dashboard');
    document.querySelector('.pending-card').scrollIntoView({behavior: 'smooth'});
  });
  window.adminAPI = {
    request,
    review: async id => openReview(id, await request(`/admin/posts/${id}`)),
  };

  (async () => {
    try {
      const user = await BartifySession.resolve({adminOnly: true});
      if (!user) return;
      $('adminName').textContent = user.name;
      document.body.classList.remove('admin-auth-pending');
      await refresh();
    } catch (error) {
      $('adminAccessState').replaceChildren(document.createTextNode(`${error.message} `));
      const retry = document.createElement('button');
      retry.textContent = 'Retry'; retry.onclick = () => location.reload();
      $('adminAccessState').append(retry);
    }
  })();
});

// Sidebar navigation and database-backed section controls.
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const api = (...args) => window.adminAPI.request(...args);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
  const title = value => String(value || '').replace(/^./, c => c.toUpperCase());
  const sections = ['users', 'listings', 'reports', 'exchanges'];
  const state = Object.fromEntries(sections.map(key => [key, {page:1, items:[], sequence:0, total:0}]));
  let active = 'dashboard';
  let searchTimer;
  let analyticsSequence = 0;
  let detailBusy = false;
  const sidebar = $('sidebar');
  function closeSidebar() {
    sidebar.classList.remove('open');
    $('sidebarOverlay').classList.remove('show');
    $('hamburgerBtn').setAttribute('aria-expanded', 'false');
  }
  $('hamburgerBtn').addEventListener('click', () => {
    sidebar.classList.add('open');
    $('sidebarOverlay').classList.add('show');
    $('hamburgerBtn').setAttribute('aria-expanded', 'true');
  });
  $('sidebarClose').addEventListener('click', closeSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);
  window.addEventListener('resize', () => { if (innerWidth > 900) closeSidebar(); });
  window.navigateAdmin = key => {
    if (!$(`page-${key}`)) return;
    clearTimeout(searchTimer);
    Object.values(state).forEach(s => s.sequence++);
    active = key;
    document.querySelectorAll('.page').forEach(page => { page.hidden = page.id !== `page-${key}`; });
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === key);
      if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('searchInput').value = '';
    $('searchInput').disabled = ['analytics', 'settings'].includes(key);
    $('searchInput').placeholder = sections.includes(key) ? `Search ${key}...` : 'Search pending posts...';
    $('searchInput').setAttribute('aria-label', sections.includes(key) ? `Search ${key}` : 'Search pending posts');
    if (innerWidth <= 900) closeSidebar();
    if (key === 'dashboard') window.resetAdminQueue();
    else {
      if (state[key]) state[key].page = 1;
      window.reloadAdminSection();
    }
  };
  document.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault(); window.navigateAdmin(link.dataset.nav);
  }));
  $('viewAllLink').addEventListener('click', e => { e.preventDefault(); window.resetAdminQueue(); });
  window.reloadAdminSection = async () => {
    if (state[active]) return loadSection(active);
    if (active === 'analytics') return loadAnalytics();
    if (active === 'settings') return loadSettings();
  };
  document.querySelectorAll('[data-reload]').forEach(button => button.addEventListener('click', () => window.reloadAdminSection()));
  $('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    const key = active;
    if (!state[key]) return;
    state[key].sequence++;
    searchTimer = setTimeout(() => { state[key].page = 1; loadSection(key); }, 250);
  });
  function parameters(key, page = state[key].page, pageSize = 20) {
    return new URLSearchParams({page, page_size:pageSize, search:$('searchInput').value.trim(), status:$(`${key}Filter`).value});
  }
  async function loadSection(key) {
    const s = state[key];
    const sequence = ++s.sequence;
    const filter = $(`${key}Filter`).value;
    $(`${key}Prev`).disabled = $(`${key}Next`).disabled = true;
    $(`${key}Status`).textContent = 'Loading...';
    $(`${key}Rows`).replaceChildren();
    $(`${key}Page`).textContent = '';
    try {
      const data = await api(`/admin/${key}?${parameters(key)}`);
      if (sequence !== s.sequence || key !== active) return;
      if (!data.items.length && s.page > 1) { s.page--; return loadSection(key); }
      s.items = data.items; s.total = data.total;
      renderTable(key, filter, data.items);
      $(`${key}Status`).textContent = data.total ? '' : 'No records match this filter.';
      $(`${key}Page`).textContent = `${data.total} records · Page ${s.page} of ${Math.max(1, Math.ceil(data.total / 20))}`;
      $(`${key}Prev`).disabled = s.page <= 1;
      $(`${key}Next`).disabled = s.page * 20 >= data.total;
    } catch (error) {
      if (sequence === s.sequence) $(`${key}Status`).textContent = `${error.message} Use Refresh to retry.`;
    }
  }
  const badge = status => `<span class="status ${['active','accepted','approved','clean'].includes(status) ? 'status-verified' : ['rejected','suspended','issue'].includes(status) ? 'status-flagged' : 'status-pending-neutral'}">${escape(title(status))}</span>`;
  const viewButton = (id, label = 'View') => `<button type="button" class="btn-mini" data-record="${id}">${label}</button>`;
  function renderTable(key, filter, items) {
    let headers, rows;
    if (key === 'users') {
      headers = ['Name', 'Email', 'Role', 'Listings', 'Status', 'Action'];
      rows = items.map(u => [escape(u.name), escape(u.email), u.role_id === 2 ? 'Admin' : 'Member', u.listings, badge(u.status), viewButton(u.id)]);
    } else if (key === 'exchanges') {
      headers = ['Offer', 'Listing', 'Offered by', 'Listing owner', 'Status', 'Action'];
      rows = items.map(o => [escape(o.title), escape(o.listing), escape(o.offered_by), escape(o.owner), badge(o.status), viewButton(o.id)]);
    } else if (key === 'reports' && ['submitted','reviewed'].includes(filter)) {
      headers = ['Reported target', 'Type', 'Reported by', 'Reason', 'Status', 'Action'];
      rows = items.map(r => [escape(r.target_name), escape(title(r.target_type)), escape(r.reporter_name), escape(title(r.reason)), badge(r.status), viewButton(r.id, 'Review')]);
    } else if (key === 'reports' && filter === 'resolved') {
      headers = ['Listing', 'Admin', 'Decision', 'Model result', 'Reviewed at'];
      rows = items.map(r => [escape(r.title), escape(r.admin_name), badge(r.decision), badge(r.model_label), escape(date(r.created_at))]);
    } else {
      headers = ['Listing', 'Owner', 'Category', 'Status', 'Model result', 'Action'];
      rows = items.map(p => [escape(p.title), escape(p.user.name), escape(p.category), badge(p.status), badge(p.model_label), viewButton(p.id, p.status === 'pending' ? 'Review' : 'View')]);
    }
    $(`${key}Head`).innerHTML = `<tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr>`;
    $(`${key}Rows`).innerHTML = rows.map(cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
  }
  sections.forEach(key => {
    $(`${key}Filter`).addEventListener('change', () => { clearTimeout(searchTimer); state[key].page = 1; loadSection(key); });
    $(`${key}Prev`).addEventListener('click', () => { state[key].page--; loadSection(key); });
    $(`${key}Next`).addEventListener('click', () => { state[key].page++; loadSection(key); });
    $(`${key}Rows`).addEventListener('click', async e => {
      const button = e.target.closest('[data-record]');
      if (!button) return;
      const record = state[key].items.find(r => r.id === Number(button.dataset.record));
      if (!record) return;
      if (key === 'reports' && record.target_type) return showReport(record);
      if (key === 'users' || key === 'exchanges') return showDetails(key, record);
      button.disabled = true;
      try { await window.adminAPI.review(record.id); }
      catch (error) { $(`${key}Status`).textContent = error.message; }
      finally { button.disabled = false; }
    });
  });
  function showReport(report) {
    $('adminDetailTitle').textContent = 'Report #' + report.id;
    const fields = [['Target', report.target_name], ['Type', report.target_type], ['Reported by', report.reporter_name], ['Reason', report.reason], ['Details', report.details], ['Submitted', date(report.created_at)], ['Status', report.status]];
    if (report.post_description) fields.push(['Post description when reported', report.post_description]);
    if (report.resolution) fields.push(['Review note', report.resolution], ['Reviewed', date(report.reviewed_at)]);
    $('adminDetailBody').innerHTML = '<dl class="admin-detail-fields">' + fields.map(([key,value]) => '<dt>' + escape(key) + '</dt><dd>' + escape(value) + '</dd>').join('') + '</dl>';
    $('adminDetailStatus').textContent = '';
    $('adminDetailActions').replaceChildren();
    for (const [label, id, type] of [['View target user', report.target_user_id, 'user'], ['View post', report.post_id, 'post']]) {
      if (!id) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'btn-outline'; button.textContent = label;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          if (type === 'user') {
            const user = await api('/admin/users/' + id);
            showDetails('users', user);
          } else {
            await window.adminAPI.review(id);
            $('adminDetailDialog').close();
          }
        } catch (error) { $('adminDetailStatus').textContent = error.message; }
        finally { button.disabled = false; }
      });
      $('adminDetailActions').append(button);
    }
    if (report.status === 'pending') {
      const form = document.createElement('form');
      form.className = 'admin-report-review';
      form.innerHTML = '<label for="reportResolution">Review note</label><textarea id="reportResolution" required minlength="3" maxlength="1000" rows="3"></textarea><p>Closing a report records your decision. Use user or listing controls separately for account or post actions.</p><button class="btn-save" type="submit" value="resolved">Resolve report</button> <button class="btn-outline" type="submit" value="dismissed">Dismiss report</button>';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (detailBusy) return;
        const resolution = $('reportResolution').value.trim();
        if (resolution.length < 3) { $('adminDetailStatus').textContent = 'Please add a review note.'; return; }
        detailBusy = true;
        $('closeAdminDetail').disabled = true;
        const buttons = Array.from($('adminDetailDialog').querySelectorAll('button'));
        buttons.forEach(button => { button.disabled = true; });
        try {
          const result = await api('/admin/reports/' + report.id + '/decision', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({decision:event.submitter?.value || 'resolved', resolution})});
          showReport(result.report);
          $('adminDetailStatus').textContent = result.message;
          await loadSection('reports');
        } catch (error) { $('adminDetailStatus').textContent = error.message; }
        finally { detailBusy = false; buttons.forEach(button => { button.disabled = false; }); $('closeAdminDetail').disabled = false; }
      });
      $('adminDetailBody').append(form);
    }
    if (!$('adminDetailDialog').open) $('adminDetailDialog').showModal();
  }

  function showDetails(key, record) {
    $('adminDetailTitle').textContent = key === 'users' ? record.name : record.title;
    const fields = key === 'users'
      ? [['Email',record.email], ['Contact',record.contact || 'Not provided'], ['Role',record.role_id === 2 ? 'Admin' : 'Member'], ['Status',title(record.status)], ['Listings',record.listings], ['Accepted exchanges',record.accepted_exchanges], ['Joined',date(record.created_at)]]
      : [['Listing',record.listing], ['Listing owner',record.owner], ['Offered by',record.offered_by], ['Description',record.description || 'Not provided'], ['Status',title(record.status)], ['Created',date(record.created_at)]];
    $('adminDetailBody').innerHTML = `<dl class="admin-detail-fields">${fields.map(([name,value]) => `<dt>${escape(name)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`;
    $('adminDetailStatus').textContent = '';
    $('adminDetailActions').replaceChildren();
    if (key === 'users' && record.role_id !== 2) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'btn-outline';
      const status = record.status === 'active' ? 'suspended' : 'active';
      button.textContent = status === 'active' ? 'Activate user' : 'Suspend user';
      button.addEventListener('click', async () => {
        if (detailBusy) return;
        detailBusy = true; button.disabled = true; $('closeAdminDetail').disabled = true;
        try {
          const result = await api(`/admin/users/${record.id}/status`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status})});
          showDetails(key, result.user);
          $('adminDetailStatus').textContent = result.message;
          await window.reloadAdminSection();
        } catch (error) { $('adminDetailStatus').textContent = error.message; }
        finally { detailBusy = false; button.disabled = false; $('closeAdminDetail').disabled = false; }
      });
      $('adminDetailActions').append(button);
    }
    if (!$('adminDetailDialog').open) $('adminDetailDialog').showModal();
  }
  $('closeAdminDetail').addEventListener('click', () => { if (!detailBusy) $('adminDetailDialog').close(); });
  $('adminDetailDialog').addEventListener('cancel', event => { if (detailBusy) event.preventDefault(); });
  $('exchangesExportBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const params = parameters('exchanges', 1, 100);
    const records = [];
    try {
      let total;
      do {
        const data = await api(`/admin/exchanges?${params}`);
        records.push(...data.items); total = data.total;
        if (!data.items.length) break;
        params.set('page', Number(params.get('page')) + 1);
      } while (records.length < total);
      const cell = value => {
        let text = String(value ?? '');
        if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const rows = [['ID','Offer','Listing','Offered by','Owner','Status','Created'], ...records.map(r => [r.id,r.title,r.listing,r.offered_by,r.owner,r.status,r.created_at])];
      const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = 'bartify-exchanges.csv';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('exchangesStatus').textContent = `Exported ${records.length} records.`;
    } catch (error) { $('exchangesStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  async function loadAnalytics() {
    const sequence = ++analyticsSequence;
    $('analyticsStatus').textContent = 'Loading statistics...';
    try {
      const data = await api('/admin/analytics');
      if (sequence !== analyticsSequence) return;
      $('analyticsStats').innerHTML = [['Total users',data.total_users],['New users this month',data.new_users],['Total listings',data.total_listings],['Accepted exchanges',data.accepted_exchanges]].map(([name,count]) => `<div class="stat-card"><div class="stat-label">${name}</div><div class="stat-value">${count.toLocaleString()}</div></div>`).join('');
      const max = Math.max(1, ...data.months.map(m => m.initiated));
      $('analyticsChart').innerHTML = '<p>Initiated offers / currently accepted offers, grouped by creation month.</p>' + data.months.map(m => `<div class="admin-month"><span>${escape(m.month)}</span><div><div class="admin-bar" style="width:${100 * m.initiated / max}%"></div><div class="admin-bar accepted" style="width:${100 * m.accepted / max}%"></div></div><span>${m.initiated} / ${m.accepted}</span></div>`).join('');
      $('analyticsCategories').innerHTML = data.categories.length ? data.categories.map(c => `<div class="donut-legend-row"><span>${escape(c.name)}</span><strong>${c.count}</strong></div>`).join('') : '<p>No listings yet.</p>';
      $('analyticsStatus').textContent = `Updated ${new Date().toLocaleTimeString()}.`;
    } catch (error) { $('analyticsStatus').textContent = `${error.message} Use Refresh statistics to retry.`; }
  }
  async function loadSettings() {
    $('settingsStatus').textContent = 'Loading profile...';
    try {
      const user = await api('/users/me');
      $('fullNameInput').value = user.name; $('emailInput').value = user.email;
      $('settingsStatus').textContent = '';
    } catch (error) { $('settingsStatus').textContent = error.message; }
  }
  $('adminProfileForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    $('profileStatus').textContent = 'Saving...';
    try {
      const result = await api('/admin/profile', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('fullNameInput').value.trim(),email:$('emailInput').value.trim(),current_password:$('profilePassword').value})});
      $('adminName').textContent = result.name;
      $('profilePassword').value = '';
      $('profileStatus').textContent = result.message;
    } catch (error) { $('profileStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('adminPasswordForm').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('newPasswordInput').value !== $('confirmPasswordInput').value) { $('passwordStatus').textContent = 'New passwords do not match.'; return; }
    const form = event.currentTarget;
    const button = form.querySelector('button'); button.disabled = true;
    $('passwordStatus').textContent = 'Saving...';
    try {
      const result = await api('/admin/password', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:$('currentPasswordInput').value,new_password:$('newPasswordInput').value})});
      form.reset(); $('passwordStatus').textContent = result.message;
    } catch (error) { $('passwordStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  if (window.lucide) lucide.createIcons();
});
