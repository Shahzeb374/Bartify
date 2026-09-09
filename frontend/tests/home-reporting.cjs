// Run against a fresh backend/tests/serve_browser_fixture.py server.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = 'http://127.0.0.1:8011';
(async () => {
  const browser = await chromium.launch({headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  try {
    const context = await browser.newContext();
    await context.route('http://127.0.0.1:8000/**', route => route.continue({url:route.request().url().replace('http://127.0.0.1:8000', base)}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const login = async email => (await (await page.request.post(base + '/users/login', {data:{email,password:'Testing123!'}})).json()).access_token;
    const admin = await login('admin@example.com');
    const seller = await login('seller@example.com');
    const buyer = await login('buyer@example.com');
    const auth = token => ({Authorization:'Bearer ' + token});
    const pending = await (await page.request.get(base + '/admin/pending', {headers:auth(admin)})).json();
    const post = pending.posts[0];
    const approval = await page.request.post(base + '/admin/posts/' + post.id + '/decision', {headers:auth(admin),data:{decision:'approve',revision:post.revision}});
    assert.equal(approval.status(), 200);
    for (const action of ['accept','reject',null]) {
      const response = await page.request.post(base + '/offers/', {headers:auth(buyer),multipart:{post_id:String(post.id),title:'Test guitar',category:'Music'}});
      assert.equal(response.status(), 200);
      const created = await response.json();
      if (action) {
        const result = await page.request.put(base + '/offers/' + created.offer.id + '/' + action, {headers:auth(seller)});
        assert.equal(result.status(), 200);
      }
    }
    const picture = await page.request.put(base + '/users/profile', {headers:auth(seller), multipart:{user_image:{name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5p8AAAAASUVORK5CYII=', 'base64')}}});
    assert.equal(picture.status(), 200);
    await page.goto(base + '/index.html');
    await page.locator('.pc-view-btn').first().click();
    await page.locator('.pd-owner-trigger').waitFor();
    assert.equal(await page.locator('#pdBody .pd-owner-profile').count(), 0);
    await page.locator('.pd-owner-trigger').click();
    await page.locator('.pd-barter-stats').waitFor();
    await page.waitForFunction(() => document.querySelector('.pd-seller-av img')?.naturalWidth > 0);
    assert.equal(await page.locator('.pd-owner-email').innerText(), 'seller@example.com');
    assert.equal(await page.locator('.pd-seller-name').innerText(), 'Seller');
    assert.deepEqual(await page.locator('.pd-barter-stats strong').allTextContents(), ['1','1','1','3']);
    assert.match(await page.locator('.pd-stats-note').innerText(), /do not confirm/);
    await page.getByRole('button', {name:'Report user',exact:true}).click();
    assert.equal(await page.locator('#reportLogin').isVisible(), true);
    assert.equal(await page.locator('#reportForm').isVisible(), false);
    await page.locator('#closeReport').click();
    assert.equal(await page.locator('#ownerProfileDialog').isVisible(), true);
    await page.locator('#closeOwnerProfile').click();
    assert.equal(await page.locator('#ownerProfileDialog').isVisible(), false);
    assert.equal(await page.locator('#pdOverlay').isVisible(), true);
    await page.evaluate(token => localStorage.setItem('barterToken', token), buyer);
    await page.goto(base + '/index.html');
    await page.locator('.pc-view-btn').first().click();
    await page.locator('#pdBody').getByRole('button', {name:'Report post',exact:true}).click();
    await page.locator('#reportReason').selectOption('misleading');
    await page.locator('#reportDetails').fill('The condition in this listing is inaccurate.');
    await page.locator('#submitReport').click();
    await page.waitForFunction(() => document.querySelector('#reportStatus').textContent.includes('Report submitted'));
    await page.locator('#closeReport').click();
    await page.locator('#pdBody').getByRole('button', {name:'Report post',exact:true}).click();
    await page.locator('#reportReason').selectOption('misleading');
    await page.locator('#reportDetails').fill('Trying the same report again for this listing.');
    await page.locator('#submitReport').click();
    await page.waitForFunction(() => document.querySelector('#reportStatus').textContent.includes('already have a pending report'));
    await page.locator('#closeReport').click();
    await page.locator('.pd-owner-trigger').click();
    await page.locator('.pd-barter-stats').waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button', {name:'Report user',exact:true}).click();
    await page.locator('#reportReason').selectOption('harassment');
    await page.locator('#reportDetails').fill('This user sent repeated unwanted messages.');
    const box = await page.locator('#reportDialog').boundingBox();
    assert.ok(box.width <= 390 && box.x >= 0);
    await page.locator('#submitReport').click();
    await page.waitForFunction(() => document.querySelector('#reportStatus').textContent.includes('Report submitted'));
    await page.locator('#closeReport').click();
    await page.setViewportSize({width:1280,height:800});
    await page.evaluate(token => localStorage.setItem('barterToken', token), admin);
    await page.goto(base + '/adminDashboard.html');
    await page.locator('#verifyTableBody tr').first().waitFor();
    await page.locator('[data-nav="reports"]').click();
    await page.locator('#reportsRows tr').first().waitFor();
    assert.equal(await page.locator('#reportsRows tr').count(), 2);
    for (const [text,button,note] of [[post.title,'Resolve report','Owner contacted about inaccurate listing.'],['Seller','Dismiss report','Reviewed the complaint; no supporting evidence.']]) {
      await page.locator('#reportsRows tr').filter({hasText:text}).getByRole('button', {name:'Review',exact:true}).click();
      await page.locator('#reportResolution').fill(note);
      await page.getByRole('button', {name:button,exact:true}).click();
      await page.waitForFunction(() => /Report (resolved|dismissed)/.test(document.querySelector('#adminDetailStatus').textContent));
      await page.locator('#closeAdminDetail').click();
    }
    await page.locator('#reportsFilter').selectOption('reviewed');
    await page.locator('#reportsRows tr').first().waitFor();
    assert.equal(await page.locator('#reportsRows tr').count(), 2);
    assert.match(await page.locator('#reportsRows').innerText(), /Resolved/);
    assert.match(await page.locator('#reportsRows').innerText(), /Dismissed/);
    assert.deepEqual(errors, []);
    console.log('PASS: public owner profile/statistics, guest gate, post/user reports, duplicate prevention, admin review persistence, and mobile reporting.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
