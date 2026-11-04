// Run against backend/tests/serve_browser_fixture.py. Requires Playwright.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:8011';

(async () => {
  const browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined});
  try {
    const context = await browser.newContext();
    await context.route('**/config.js', route => route.fulfill({contentType:'application/javascript', body:`const API_BASE_URL = '${base}';`}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/login.html`);
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('Testing123!');
    await page.getByRole('button', {name:'Sign In', exact:true}).click();
    await page.waitForURL('**/adminDashboard.html');
    await page.locator('#verifyTableBody tr').first().waitFor();
    assert.equal(await page.locator('#adminName').innerText(), 'Admin');
    assert.equal(await page.locator('#verifyTableBody tr').count(), 20);
    assert.match(await page.locator('#queuePage').innerText(), /22 posts/);

    await page.locator('#queueNext').click();
    await page.waitForFunction(() => document.querySelector('#queuePage').textContent.includes('Page 2'));
    assert.equal(await page.locator('#verifyTableBody tr').count(), 2);
    await page.locator('#searchInput').fill('laptop 01');
    await page.waitForFunction(() => document.querySelector('#queuePage').textContent.startsWith('1 posts'));
    await page.locator('#verifyTableBody button').click();
    assert.equal(await page.locator('#moderationDialog').evaluate(el => el.open), true);
    assert.match(await page.locator('#reviewPrediction').innerText(), /Model result: Clean/);
    await page.locator('#approvePost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    await page.waitForFunction(() => document.querySelector('#verifyTableBody').children.length === 0);
    assert.equal((await (await page.request.get(`${base}/posts/`)).json()).total, 1);

    await page.locator('#viewAllLink').click();
    await page.locator('#verifyTableBody button').first().waitFor();
    await page.locator('#verifyTableBody button').first().click();
    await page.locator('#rejectPost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    await page.waitForFunction(() => document.querySelector('#queuePage').textContent.startsWith('20 posts'));
    assert.equal((await (await page.request.get(`${base}/posts/`)).json()).total, 1);
    await page.locator('#refreshOverviewBtn').click();
    await page.waitForFunction(() => !document.querySelector('#refreshOverviewBtn').disabled);
    assert.match(await page.locator('#moderationActivity').innerText(), /rejected/);
    assert.match(await page.locator('#moderationActivity').innerText(), /approved/);

    // Navigation must reload the queue after clearing a filter.
    await page.locator('#searchInput').fill('no matching post');
    await page.waitForFunction(() => document.querySelector('#queuePage').textContent.startsWith('0 posts'));
    await page.locator('[data-nav="dashboard"]').click();
    await page.waitForFunction(() => document.querySelector('#queuePage').textContent.startsWith('20 posts'));

    // Sidebar records and mutations use the disposable fixture database.
    await page.locator('[data-nav="users"]').click();
    await page.locator('#usersRows tr').first().waitFor();
    assert.equal(await page.locator('#usersRows tr').count(), 3);
    await page.locator('#searchInput').fill('Buyer');
    await page.waitForFunction(() => document.querySelector('#usersPage').textContent.startsWith('1 records'));
    await page.locator('#usersRows button').click();
    await page.getByRole('button', {name:'Suspend user',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#adminDetailStatus').textContent === 'User suspended');
    await page.getByRole('button', {name:'Activate user',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#adminDetailStatus').textContent === 'User active');
    await page.locator('#closeAdminDetail').click();

    await page.locator('[data-nav="listings"]').click();
    await page.locator('#listingsRows tr').first().waitFor();
    assert.match(await page.locator('#listingsPage').innerText(), /22 records/);
    await page.locator('#listingsNext').click();
    await page.waitForFunction(() => document.querySelector('#listingsPage').textContent.includes('Page 2'));
    await page.locator('#listingsFilter').selectOption('active');
    await page.waitForFunction(() => document.querySelector('#listingsPage').textContent.startsWith('1 records'));
    await page.locator('#listingsRows button').click();
    await page.locator('#moderationDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#approvePost').isDisabled(), true);
    assert.match(await page.locator('#reviewStatus').innerText(), /active/);
    await page.locator('#closeReview').click();
    await page.locator('[data-nav="reports"]').click();
    await page.locator('#reportsFilter').selectOption('resolved');
    await page.locator('#reportsRows tr').first().waitFor();
    assert.equal(await page.locator('#reportsRows tr').count(), 2);
    assert.match(await page.locator('#reportsRows').innerText(), /Rejected/);

    const buyerLogin = await page.request.post(base + '/users/login', {data:{email:'buyer@example.com',password:'Testing123!'}});
    const buyerToken = (await buyerLogin.json()).access_token;
    const publicPosts = await (await page.request.get(base + '/posts/')).json();
    const offerResponse = await page.request.post(base + '/offers/', {
      headers:{Authorization:'Bearer ' + buyerToken},
      multipart:{post_id:String(publicPosts.posts[0].id),title:'Browser test guitar',category:'Music'}
    });
    assert.equal(offerResponse.status(), 200);
    await page.locator('[data-nav="exchanges"]').click();
    await page.locator('#exchangesRows tr').first().waitFor();
    assert.match(await page.locator('#exchangesRows').innerText(), /Browser test guitar/);
    await page.locator('#exchangesRows button').click();
    assert.match(await page.locator('#adminDetailBody').innerText(), /Buyer/);
    await page.locator('#closeAdminDetail').click();
    const downloaded = page.waitForEvent('download');
    await page.locator('#exchangesExportBtn').click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), 'bartify-exchanges.csv');
    const stream = await download.createReadStream();
    let csv = ''; for await (const chunk of stream) csv += chunk;
    assert.match(csv, /Browser test guitar/);

    await page.locator('[data-nav="analytics"]').click();
    await page.locator('#analyticsStats .stat-card').first().waitFor();
    assert.equal(await page.locator('#analyticsStats .stat-value').first().innerText(), '3');
    assert.equal(await page.locator('.admin-month').count(), 6);
    await page.locator('[data-nav="settings"]').click();
    await page.waitForFunction(() => document.querySelector('#fullNameInput').value === 'Admin');
    await page.locator('#fullNameInput').fill('Test Administrator');
    await page.locator('#profilePassword').fill('Testing123!');
    await page.getByRole('button', {name:'Save Profile',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#profileStatus').textContent === 'Admin profile saved');
    assert.equal(await page.locator('#adminName').innerText(), 'Test Administrator');
    await page.locator('[data-nav="users"]').click();
    await page.locator('[data-nav="settings"]').click();
    await page.waitForFunction(() => document.querySelector('#fullNameInput').value === 'Test Administrator');
    await page.locator('#currentPasswordInput').fill('Testing123!');
    await page.locator('#newPasswordInput').fill('Updated123!');
    await page.locator('#confirmPasswordInput').fill('Updated123!');
    await page.getByRole('button', {name:'Change Password',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#passwordStatus').textContent === 'Password changed successfully');
    const updatedLogin = await page.request.post(base + '/users/login', {data:{email:'admin@example.com',password:'Updated123!'}});
    assert.equal(updatedLogin.status(), 200);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#hamburgerBtn').click();
    await page.locator('[data-nav="users"]').click();
    await page.locator('#usersRows tr').first().waitFor();
    assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({width:1280,height:720});

    // An admin opening the member dashboard is sent back to admin.
    await page.goto(`${base}/dashboard.html`);
    await page.waitForURL('**/adminDashboard.html');
    await page.locator('#verifyTableBody tr').first().waitFor();
    await page.setViewportSize({width:390, height:844});
    await page.locator('#hamburgerBtn').click();
    await page.locator('#refreshOverviewBtn').click();
    await page.locator('#sidebarClose').click();
    await page.locator('#verifyTableBody button').first().click();
    const dialog = await page.locator('#moderationDialog').boundingBox();
    assert.ok(dialog.width <= 390 && dialog.x >= 0);
    await page.locator('#closeReview').click();

    // Account suspension signs out an open dashboard and a separate public-page session.
    await page.setViewportSize({width:1280,height:720});
    const sellerLogin = await page.request.post(base + '/users/login', {data:{email:'seller@example.com',password:'Testing123!'}});
    const sellerSession = await sellerLogin.json();
    const memberContexts = [];
    const memberPages = [];
    for (const target of ['dashboard.html', 'about-us.html']) {
      const memberContext = await browser.newContext(); memberContexts.push(memberContext);
      await memberContext.route('**/config.js', route => route.fulfill({contentType:'application/javascript',body:`const API_BASE_URL = '${base}';`}));
      const memberPage = await memberContext.newPage(); memberPages.push(memberPage);
      memberPage.on('pageerror', error => errors.push(error.message));
      await memberPage.goto(base + '/login.html');
      await memberPage.evaluate(session => {
        localStorage.setItem('barterToken', session.access_token);
        localStorage.setItem('barterUser', JSON.stringify(session.user));
      }, sellerSession);
      await memberPage.goto(base + '/' + target);
    }
    await memberPages[0].waitForFunction(() => typeof chatSocket !== 'undefined' && chatSocket?.readyState === 1);
    await page.locator('[data-nav="users"]').click();
    await page.locator('#searchInput').fill('Seller');
    await page.waitForFunction(() => document.querySelector('#usersPage').textContent.startsWith('1 records'));
    await page.locator('#usersRows button').click();
    await page.getByRole('button', {name:'Suspend user',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#adminDetailStatus').textContent === 'User suspended');
    for (const memberPage of memberPages) {
      await memberPage.waitForURL('**/login.html?reason=session-ended', {timeout:25000});
      assert.equal(await memberPage.evaluate(() => localStorage.getItem('barterToken')), null);
    }
    assert.equal((await (await page.request.get(base + '/posts/')).json()).total, 0);
    await page.getByRole('button', {name:'Activate user',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#adminDetailStatus').textContent === 'User active');
    const oldSession = await page.request.get(base + '/users/me', {headers:{Authorization:'Bearer '+sellerSession.access_token}});
    assert.equal(oldSession.status(), 401);
    assert.equal((await (await page.request.get(base + '/posts/')).json()).total, 1);
    await page.locator('#closeAdminDetail').click();
    for (const memberContext of memberContexts) await memberContext.close();

    // Approved posts can be suspended, returned to review, approved, and deleted.
    await page.locator('[data-nav="listings"]').click();
    await page.locator('#listingsFilter').selectOption('active');
    await page.waitForFunction(() => document.querySelector('#listingsPage').textContent.startsWith('1 records'));
    await page.locator('#listingsRows button').click();
    await page.locator('#suspendPost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    assert.equal((await (await page.request.get(base + '/posts/')).json()).total, 0);
    await page.locator('#listingsFilter').selectOption('suspended');
    await page.locator('#listingsRows button').waitFor();
    await page.locator('#listingsRows button').click();
    await page.locator('#restorePost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    await page.locator('#listingsFilter').selectOption('pending');
    await page.locator('#searchInput').fill('laptop 01');
    await page.waitForFunction(() => document.querySelector('#listingsPage').textContent.startsWith('1 records'));
    await page.locator('#listingsRows button').click();
    await page.locator('#approvePost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    await page.locator('#listingsFilter').selectOption('active');
    await page.locator('#listingsRows button').waitFor();
    await page.locator('#listingsRows button').click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#deletePost').click();
    assert.equal(await page.locator('#moderationDialog').evaluate(el => el.open), true);
    assert.equal((await (await page.request.get(base + '/posts/')).json()).total, 1);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#deletePost').click();
    await page.waitForFunction(() => !document.querySelector('#moderationDialog').open);
    assert.equal((await (await page.request.get(base + '/posts/')).json()).total, 0);

    // Forged browser role cannot override the server's member role.
    const login = await page.request.post(`${base}/users/login`, {data:{email:'seller@example.com', password:'Testing123!'}});
    const member = await login.json();
    await page.evaluate(token => {
      localStorage.setItem('barterToken', token);
      localStorage.setItem('barterUser', JSON.stringify({role_id:2, name:'Fake admin'}));
    }, member.access_token);
    await page.goto(`${base}/adminDashboard.html`);
    await page.waitForURL('**/dashboard.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}/adminDashboard.html`);
    await page.waitForURL('**/login.html');
    assert.deepEqual(errors, []);
    console.log('PASS: login/roles, queue review, navigation/mobile, automatic suspension logout, reactivation, approved-post suspension/restore/deletion.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
