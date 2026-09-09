# Admin overview and pending verification

Admin accounts use **role_id = 2** and must have `status = 1`. Ordinary signup
continues to create role_id 1 users. Roles are checked against PostgreSQL on each
admin request, not trusted from browser storage. No existing account is promoted
by this implementation.

## Run locally

From the repository root:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
cd backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Serve `frontend` with your usual static server / VS Code Live Server. Sign in
through `login.html` using an existing admin account. Admins are redirected to
`adminDashboard.html`; members cannot access admin data or decisions.

The backend reads `backend/.env`, which must define `DATABASE_URL` and a private
`JWT_SECRET_KEY` of at least 32 characters. A new private signing key was generated
in the ignored local `.env` during integration. Log in again after this change.
For another machine, generate its own key (for example with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`). Never commit it.

The existing startup `create_all` adds `post_moderation` and
`moderation_decisions` tables. Existing user roles and existing active posts are
not migrated. Existing `posts.status = 0` rows enter the pending queue.

## Review workflow

- New posts and edited posts get status `0` (pending).
- The bundled vectorizer transforms title + description + preferred trade.
- The classifier returns `0 = issue`, `1 = clean`. The UI displays confidence in
  that prediction, not a listing quality or authenticity score. It does not check images.
- Both labels require a manual admin decision. Approve sets post status `1` and
  makes it visible in the marketplace; reject sets status `2` and keeps it hidden.
- Rejected posts appear in the member's pending/rejected list and can be edited
  and resubmitted. An edit to an active post takes it off the marketplace until reviewed.
- New Report refreshes real statistics, retries missing/failed model checks, and
  reloads the queue. Search and pagination cover all pending posts. View All clears search.
- Recent Activity records actual admin decisions. Stale or duplicate decisions
  return `409`; failed model checks remain pending and cannot be approved.

The model files in `backend/ml_models` are copied from the supplied training
project. They were serialized with scikit-learn 1.9.0 and are loaded only from
this fixed backend directory. Restart the backend after replacing artifacts.

All sidebar sections now use administrator-only database routes:
- Users: search, status filters, pagination, details, and member suspension/reactivation.
  Admin accounts cannot be suspended from this interface.
- Listings: all post statuses, search, pagination, details, and the existing revision-checked review flow.
- Reports: user-submitted post/account reports, model-flagged pending posts, and moderation history.
  Admins can resolve or dismiss submitted reports with a review note; this does not automatically change a post or account.
- Exchanges: read-only offer details, status filters, search, pagination, and CSV export of matching records.
- Analytics: real user/listing totals, category counts, and six months of offer activity.
  Accepted offers are labeled accepted, because physical exchange completion is not tracked.
- Settings: persistent admin name/email and password updates, requiring the current password.
  Two-factor authentication and email notification services are not implemented.

All admin UI behavior is in `frontend/adminDashboard.js`.

Home page post details fetch the owner's name, email, profile image, and accepted/rejected/pending offer counts.
Counts include offers sent and received. Actual physical exchange completion is not tracked.
Signed-in users can report another user's post or profile using `POST /reports/`.
Reports are stored in `user_reports`, created by the existing startup `create_all` routine.
A partial unique index prevents duplicate pending reports by the same reporter for the same target.
Target snapshots remain available if a reported post or user is deleted. Reports are visible only to admins.

## Validation

```powershell
.\venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\venv\Scripts\python.exe -B -m unittest discover -s backend/tests -v
```

Backend tests use an in-memory SQLite database with foreign keys enabled, temporary
uploads, and the real classifier. They never use your configured PostgreSQL data.

For the browser checks, start `backend/tests/serve_browser_fixture.py` from the
repository root, then run `node frontend/tests/admin-dashboard.cjs` with Playwright
available. The fixture binds only to `127.0.0.1:8011`, uses disposable test accounts,
and is not imported by the application. The browser test redirects API traffic to
that fixture so it cannot approve or reject real posts.
For owner profiles and reporting, run `node frontend/tests/home-reporting.cjs` against a fresh fixture server.
Restart the disposable server between browser suites because each suite changes its synthetic records.
