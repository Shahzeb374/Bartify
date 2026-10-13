// Start the disposable browser fixture before running this test.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:8011';
const output = path.resolve(__dirname, '../../output/frontend-preview');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.route('**/config.js', route => route.fulfill({
      contentType: 'application/javascript',
      body: `const API_BASE_URL = '${base}///'.replace(/\\/+$/, '');`,
    }));
    // Keep test sockets away from the configured application and its database.
    await context.routeWebSocket('ws://127.0.0.1:8011/**', socket => socket.close());
    const page = await context.newPage();
    const errors = [];
    const defaultBackendRequests = [];
    page.on('request', request => { if (request.url().startsWith('http://127.0.0.1:8000')) defaultBackendRequests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    const credentials = { email: 'admin@example.com', password: 'Testing123!' };
    const loginResponse = await page.request.post(base + '/users/login', { data: credentials });
    const admin = await loginResponse.json();
    const pending = await (await page.request.get(base + '/admin/pending', { headers: { Authorization: 'Bearer ' + admin.access_token } })).json();
    const post = pending.posts[0];
    await page.request.post(base + '/admin/posts/' + post.id + '/decision', {
      headers: { Authorization: 'Bearer ' + admin.access_token }, data: { decision: 'approve', revision: post.revision },
    });

    const publicPages = ['index.html', 'about-us.html', 'how-it-works.html', 'privacy-policy.html', 'terms-conditions.html', 'marketplace.html', 'login.html', 'Signup.html', 'forgetpassword.html'];
    async function checkLayout(filename, mobile) {
      await page.goto(base + '/' + filename);
      await page.locator('body').waitFor();
      assert.equal(await page.evaluate(() => API_BASE_URL), base, `${filename}: shared configuration must load before page scripts`);
      if (filename === 'index.html') await page.locator('.product-card').first().waitFor();
      const problems = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(img => img.getAttribute('src') && img.complete && !img.naturalWidth).map(img => img.getAttribute('src')),
        font: getComputedStyle(document.body).fontFamily,
      }));
      assert.equal(problems.overflow, false, `${filename}: horizontal overflow at ${mobile ? 'mobile' : 'desktop'}`);
      assert.deepEqual(problems.brokenImages, [], `${filename}: broken image assets`);
      assert.match(problems.font, /Plus Jakarta Sans/, filename);
      if (mobile && await page.locator('#menuToggle').count()) {
        await page.locator('#menuToggle').click();
        assert.equal(await page.locator('#primaryNavigation').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'false');
      }
      await page.screenshot({ path: path.join(output, `${filename.replace('.html', '')}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
    }
    for (const filename of publicPages) await checkLayout(filename, false);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const filename of publicPages) await checkLayout(filename, true);

    // Preserve custom validation and actual multipart signup under the new layout.
    await page.goto(base + '/Signup.html');
    await page.locator('.btn-create').click();
    assert.match(await page.locator('#fullNameError').innerText(), /required/);
    assert.match(await page.locator('#contactError').innerText(), /required/);
    await page.locator('#fullName').fill('Theme Member');
    await page.locator('#email').fill(`theme-member-${Date.now()}@example.com`);
    await page.locator('#password').fill('Testing123!');
    await page.locator('#confirmPassword').fill('Testing123!');
    await page.locator('.btn-create').click();
    assert.match(await page.locator('#contactError').innerText(), /required/);
    assert.match(page.url(), /Signup.html$/);
    await page.locator('#contact').fill('+92 300 1234567');
    await page.locator('.btn-create').click();
    await page.waitForURL('**/index.html');
    await page.locator('#navLoggedIn').waitFor();
    assert.equal(await page.locator('#homeHero').isVisible(), false);
    await page.goto(base + '/dashboard.html');
    await page.waitForFunction(() => document.querySelector('#dashGreet').textContent.includes('Theme'));
    assert.equal(await page.locator('#headerProfileBtn').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true, 'Mobile account menu must remain fully reachable');
    await page.screenshot({ path: path.join(output, 'member-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.waitForFunction(() => document.querySelector('#main').getBoundingClientRect().left >= 260);
    await page.screenshot({ path: path.join(output, 'member-desktop.png'), fullPage: true });
    await page.locator('[data-section="addListing"]').first().click();
    await page.locator('#itemTitle').waitFor();
    const postRequests = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url() === base + '/posts/') postRequests.push(request); });
    await page.locator('#publishBtn').click();
    await page.locator('.toast-msg').filter({hasText:'Upload at least one product image'}).waitFor();
    assert.equal(postRequests.length, 0, 'Frontend blocks submissions without a product image');
    await page.screenshot({ path: path.join(output, 'add-listing-desktop.png'), fullPage: true });
    await page.locator('#itemTitle').fill('Camera for exchange');
    await page.locator('#itemDesc').fill('A good camera with charger and original box ready for exchange.');
    await page.locator('#itemCat').selectOption('Electronics');
    await page.locator('#itemCond').selectOption('8');
    await page.locator('#valueFrom').fill('500');
    await page.locator('#valueTo').fill('1000');
    await page.locator('#uploadGrid input[type="file"]').first().setInputFiles({
      name:'camera.png', mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5p8AAAAASUVORK5CYII=', 'base64'),
    });
    await page.locator('#uploadGrid .preview-img').waitFor();
    const createdResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url() === base + '/posts/');
    await page.locator('#publishBtn').click();
    const created = await createdResponse;
    assert.equal(created.status(), 200);
    const createdPost = (await created.json()).post;
    assert.equal(createdPost.images.length, 1);
    assert.equal((await page.request.get(base + createdPost.images[0])).status(), 200);
    await page.locator('#sec-pendingListings.active').waitFor();
    await page.goto(base + '/dashboard.html?section=editProfile');
    await page.locator('#sec-editProfile.active').waitFor();
    await page.locator('#epPhone').fill('   ');
    await page.locator('#sec-editProfile button[type="submit"]').click();
    await page.locator('.toast-msg').filter({hasText:'Contact number is required.'}).waitFor();
    await page.locator('#epPhone').fill('+92 301 1234567');
    const profileResponse = page.waitForResponse(response => response.request().method() === 'PUT' && response.url() === base + '/users/profile');
    await page.locator('#sec-editProfile button[type="submit"]').click();
    const updated = await profileResponse;
    assert.equal(updated.status(), 200);
    assert.equal((await updated.json()).user.contact, '+92 301 1234567');

    // An actual admin login still redirects to the protected console.
    await page.evaluate(() => localStorage.clear());
    await page.goto(base + '/login.html');
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.password);
    await page.locator('#password').press('Enter');
    await page.waitForURL('**/adminDashboard.html');
    await page.waitForFunction(() => !document.body.classList.contains('admin-auth-pending'));
    await page.locator('#verifyTableBody tr').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('#refreshOverviewBtn').disabled);
    assert.equal(await page.locator('#adminName').innerText(), 'Admin');
    await page.screenshot({ path: path.join(output, 'admin-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.locator('#hamburgerBtn').click();
    await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().left >= 0);
    await page.screenshot({ path: path.join(output, 'admin-mobile-menu.png'), fullPage: true });
    await page.locator('#sidebarClose').click();
    await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 1);
    await page.screenshot({ path: path.join(output, 'admin-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(defaultBackendRequests, [], 'All API and upload requests must use the configured backend');
    console.log('PASS: all 11 screens, shared URL, required signup/profile contact, required post image, uploaded image retrieval, and admin login.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
