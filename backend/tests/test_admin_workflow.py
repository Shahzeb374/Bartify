"""Run: python -B -m unittest discover -s backend/tests -v (from repo root).

All records and uploads are isolated from the configured PostgreSQL database.
"""
import os
import base64
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "isolated-test-signing-key-with-at-least-32-characters"
ORIGINAL_CWD = Path.cwd()
IMAGE_BYTES = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5p8AAAAASUVORK5CYII=')
UPLOADS = tempfile.TemporaryDirectory(prefix="bartify-tests-")
os.chdir(UPLOADS.name)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from jose import jwt
from app import models
from app.bootstrap import ensure_default_roles
from app.auth import create_access_token
from app.moderation import classify_text
from app.routes import admin, users, posts, offers, reports
from app.utils.dependencies import get_db
from app.utils.security import hash_password


def tearDownModule():
    os.chdir(ORIGINAL_CWD)
    UPLOADS.cleanup()


class AdminWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = hash_password("Testing123!")

    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(self.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        models.Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        with self.sessions() as db:
            db.add_all([models.Role(r_id=2, role="Admin"), models.Role(r_id=1, role="Member")])
            db.flush()
            db.add_all([
                models.User(u_id=1, name="Admin", email="admin@example.com", password=self.password_hash, role_id=2),
                models.User(u_id=2, name="Seller", email="seller@example.com", password=self.password_hash, role_id=1),
                models.User(u_id=3, name="Buyer", email="buyer@example.com", password=self.password_hash, role_id=1),
            ])
            db.commit()
        app = FastAPI()
        for router, prefix in [(users.router, "/users"), (posts.router, "/posts"), (offers.router, "/offers"), (admin.router, "/admin"), (reports.router, "/reports")]:
            app.include_router(router, prefix=prefix)
        def test_db():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = test_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def headers(self, user_id=1):
        return {"Authorization": "Bearer " + create_access_token({"user_id": user_id})}

    def submit(self, title="Laptop for trade"):
        response = self.client.post("/posts/", headers=self.headers(2), data={
            "title": title,
            "description": "Selling my laptop in good condition with charger and original box for a fair barter exchange with another item.",
            "in_exchange_for": "Guitar", "category": "Electronics",
            "price_from": "500", "price_to": "1000", "condition_score": "8",
        }, files=[('images', ('listing.png', IMAGE_BYTES, 'image/png'))])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["post"]["status"], "pending")
        return response.json()["post"]["id"]

    def queued(self):
        response = self.client.get("/admin/pending", headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["posts"]

    def decide(self, post, decision="approve", user=1):
        return self.client.post(f'/admin/posts/{post["id"]}/decision', headers=self.headers(user),
                                json={"decision": decision, "revision": post["revision"]})

    def test_fresh_database_bootstrap_allows_member_signup(self):
        with self.sessions() as db:
            db.query(models.User).delete()
            db.query(models.Role).delete()
            db.commit()
        ensure_default_roles(self.engine)
        ensure_default_roles(self.engine)
        response = self.client.post('/users/signup', data={
            'name': 'New Member', 'email': 'new@example.com',
            'password': 'Testing123!', 'role_id': '2', 'contact': '+92 300 1234567',
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['user']['role_id'], 1)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Role).count(), 2)
        me = self.client.get('/users/me', headers={
            'Authorization': 'Bearer ' + response.json()['access_token'],
        })
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['role_id'], 1)

    def test_signup_requires_contact_and_persists_trimmed_value(self):
        data = {'name': 'New Member', 'email': 'contact@example.com', 'password': 'Testing123!'}
        for value in (None, '', '   ', '1' * 21):
            with self.subTest(contact=value):
                fields = dict(data)
                if value is not None:
                    fields['contact'] = value
                response = self.client.post('/users/signup', data=fields)
                self.assertIn(response.status_code, (400, 422), response.text)
                with self.sessions() as db:
                    self.assertEqual(db.query(models.User).filter_by(email=data['email']).count(), 0)
        response = self.client.post('/users/signup', data={**data, 'contact': '  +92 300 1234567  '})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['user']['contact'], '+92 300 1234567')
        login = self.client.post('/users/login', json={'email': data['email'], 'password': data['password']})
        self.assertEqual(login.json()['user']['contact'], '+92 300 1234567')

    def test_profile_requires_contact_without_changing_account_on_failure(self):
        with self.sessions() as db:
            db.get(models.User, 2).contact = '+92 300 1234567'
            db.commit()
        for value in (None, '', '   ', '1' * 21):
            with self.subTest(contact=value):
                fields = {'name': 'Should not be saved'}
                if value is not None:
                    fields['contact'] = value
                response = self.client.put('/users/profile', headers=self.headers(2), data=fields)
                self.assertIn(response.status_code, (400, 422), response.text)
                me = self.client.get('/users/me', headers=self.headers(2)).json()
                self.assertEqual(me['name'], 'Seller')
                self.assertEqual(me['contact'], '+92 300 1234567')
        response = self.client.put('/users/profile', headers=self.headers(2), data={'contact': '  +92 301 1234567  '})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['user']['contact'], '+92 301 1234567')

    def test_post_requires_nonempty_image_without_creating_records(self):
        fields = {
            'title': 'Missing photo', 'description': 'A good laptop with charger and original box ready for exchange.',
            'in_exchange_for': 'Guitar', 'category': 'Electronics',
            'price_from': '500', 'price_to': '1000', 'condition_score': '8',
        }
        before = set(Path('uploads/posts').rglob('*'))
        for files in (None, [('images', ('empty.png', b'', 'image/png'))]):
            response = self.client.post('/posts/', headers=self.headers(2), data=fields, files=files)
            self.assertIn(response.status_code, (400, 422), response.text)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Post).count(), 0)
            self.assertEqual(db.query(models.ProductImage).count(), 0)
        self.assertEqual(set(Path('uploads/posts').rglob('*')), before)
        post_id = self.submit()
        post = self.client.get('/posts/my', headers=self.headers(2)).json()['posts'][0]
        self.assertEqual(post['id'], post_id)
        self.assertEqual(len(post['images']), 1)
        self.assertEqual(Path(post['images'][0].lstrip('/')).read_bytes(), IMAGE_BYTES)

    def test_post_edit_keeps_photo_and_rejects_empty_replacement(self):
        post_id = self.submit()
        self.decide(self.queued()[0])
        original = self.client.get('/posts/my', headers=self.headers(2)).json()['posts'][0]
        response = self.client.put(f'/posts/{post_id}', headers=self.headers(2), data={'title': 'Do not save this'},
                                   files=[('images', ('empty.png', b'', 'image/png'))])
        self.assertEqual(response.status_code, 400, response.text)
        unchanged = self.client.get('/posts/my', headers=self.headers(2)).json()['posts'][0]
        self.assertEqual(unchanged['title'], original['title'])
        self.assertEqual(unchanged['status'], 'active')
        self.assertEqual(unchanged['images'], original['images'])
        self.assertEqual(Path(original['images'][0].lstrip('/')).read_bytes(), IMAGE_BYTES)
        response = self.client.put(f'/posts/{post_id}', headers=self.headers(2), data={'title': 'Keep original image'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['post']['images'], original['images'])
        with self.sessions() as db:
            db.query(models.ProductImage).filter_by(product_id=post_id).delete()
            db.commit()
        response = self.client.put(f'/posts/{post_id}', headers=self.headers(2), data={'title': 'Still no image'})
        self.assertEqual(response.status_code, 400, response.text)
        response = self.client.put(f'/posts/{post_id}', headers=self.headers(2), data={'title': 'Photo supplied'},
                                   files=[('images', ('replacement.png', IMAGE_BYTES, 'image/png'))])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()['post']['images']), 1)

    def test_bootstrap_preserves_existing_roles_and_users(self):
        with self.sessions() as db:
            db.get(models.Role, 1).role = 'User'
            db.commit()
        ensure_default_roles(self.engine)
        with self.sessions() as db:
            self.assertEqual(db.get(models.Role, 1).role, 'User')
            self.assertEqual(db.query(models.Role).count(), 2)
            self.assertEqual(db.get(models.User, 1).role_id, 2)
            self.assertEqual(db.get(models.User, 2).role_id, 1)

    def test_real_model_label_mapping(self):
        self.assertEqual(classify_text("Selling my laptop, good condition, barter available")["label"], "clean")
        result = classify_text("weed available cheap rate, contact now")
        self.assertEqual(result["label"], "issue")
        self.assertTrue(0 <= result["confidence"] <= 1)

    def test_admin_role_is_enforced_on_every_route(self):
        post_id = self.submit()
        paths = [("GET", "/admin/overview", None), ("GET", "/admin/pending", None),
                 ("POST", "/admin/refresh", None),
                 ("POST", f"/admin/posts/{post_id}/decision", {"decision": "approve", "revision": "a" * 64})]
        for method, path, body in paths:
            self.assertEqual(self.client.request(method, path, json=body).status_code, 401)
            self.assertEqual(self.client.request(method, path, json=body, headers=self.headers(2)).status_code, 403)
        with self.sessions() as db:
            db.get(models.User, 1).role_id = 1
            db.commit()
        self.assertEqual(self.client.get("/admin/overview", headers=self.headers()).status_code, 403)

    def test_login_and_me_return_database_role(self):
        for email, expected in [("admin@example.com", 2), ("seller@example.com", 1)]:
            response = self.client.post("/users/login", json={"email": email, "password": "Testing123!"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["user"]["role_id"], expected)
        self.assertEqual(self.client.get("/users/me", headers=self.headers()).json()["role_id"], 2)
        forged = jwt.encode({"user_id": 1}, "secret123", algorithm="HS256")
        self.assertEqual(self.client.get("/admin/overview", headers={"Authorization": "Bearer " + forged}).status_code, 401)

    def test_inactive_admin_cannot_login_or_review(self):
        with self.sessions() as db:
            db.get(models.User, 1).status = 0
            db.commit()
        self.assertEqual(self.client.get("/admin/overview", headers=self.headers()).status_code, 403)
        self.assertEqual(self.client.post("/users/login", json={"email": "admin@example.com", "password": "Testing123!"}).status_code, 403)

    def test_approve_publishes_once_and_records_activity(self):
        post_id = self.submit()
        self.assertEqual(self.client.get("/posts/").json()["total"], 0)
        self.assertEqual(self.client.get(f"/posts/{post_id}").status_code, 404)
        post = self.queued()[0]
        self.assertIn(post["model_label"], ["clean", "issue"])
        self.assertEqual(self.decide(post).status_code, 200)
        self.assertEqual(self.client.get("/posts/").json()["total"], 1)
        self.assertEqual(self.client.get(f"/posts/{post_id}").status_code, 200)
        self.assertEqual(self.decide(post, "reject").status_code, 409)
        stats = self.client.get("/admin/overview", headers=self.headers()).json()
        self.assertEqual(stats["pending_count"], 0)
        self.assertEqual(stats["recent_activity"][0]["decision"], "approved")

    def test_reject_is_hidden_and_seller_can_resubmit(self):
        post_id = self.submit()
        self.assertEqual(self.decide(self.queued()[0], "reject").status_code, 200)
        mine = self.client.get("/posts/my", headers=self.headers(2)).json()["posts"][0]
        self.assertEqual(mine["status"], "rejected")
        self.assertEqual(self.client.get("/posts/").json()["total"], 0)
        response = self.client.put(f"/posts/{post_id}", headers=self.headers(2), data={"title": "Updated laptop"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["post"]["status"], "pending")
        self.assertEqual(len(self.queued()), 1)

    def test_edits_require_new_review_and_stale_decisions_fail(self):
        post_id = self.submit()
        original = self.queued()[0]
        self.client.put(f"/posts/{post_id}", headers=self.headers(2), data={"title": "Different laptop"})
        self.assertEqual(self.decide(original).status_code, 409)
        self.assertEqual(self.decide(self.queued()[0]).status_code, 200)
        self.client.put(f"/posts/{post_id}", headers=self.headers(2), data={"title": "Edited after approval"})
        self.assertEqual(self.client.get("/posts/").json()["total"], 0)
        self.assertEqual(len(self.queued()), 1)

    def test_model_failure_stays_pending_and_refresh_retries(self):
        with patch("app.moderation.load_classifier", side_effect=RuntimeError("test failure")):
            post_id = self.submit()
        queued = self.queued()[0]
        self.assertEqual(queued["model_label"], "unavailable")
        self.assertEqual(self.decide(queued).status_code, 409)
        self.assertEqual(self.client.get("/posts/").json()["total"], 0)
        response = self.client.post("/admin/refresh", headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["unavailable_count"], 0)
        self.assertEqual(self.queued()[0]["id"], post_id)
        self.assertIn(self.queued()[0]["model_label"], ["clean", "issue"])

    def test_pending_listing_cannot_receive_offers(self):
        post_id = self.submit()
        response = self.client.post("/offers/", headers=self.headers(3), data={
            "post_id": post_id, "title": "Guitar", "category": "Music"})
        self.assertEqual(response.status_code, 404)

    def test_search_pagination_and_delete_reviewed_listing(self):
        self.submit("Laptop Alpha")
        second = self.submit("Laptop Beta")
        result = self.client.get("/admin/pending?search=Beta&page_size=1", headers=self.headers()).json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["posts"][0]["id"], second)
        self.assertEqual(self.decide(result["posts"][0]).status_code, 200)
        response = self.client.delete(f"/posts/{second}", headers=self.headers(2))
        self.assertEqual(response.status_code, 200, response.text)
        with self.sessions() as db:
            self.assertIsNone(db.get(models.PostModeration, second))
            self.assertEqual(db.query(models.ModerationDecision).one().post_title, "Laptop Beta")


    def test_sidebar_routes_require_active_admin(self):
        for route in ('users', 'listings', 'reports', 'exchanges', 'analytics'):
            self.assertEqual(self.client.get('/admin/' + route).status_code, 401)
            self.assertEqual(self.client.get('/admin/' + route, headers=self.headers(2)).status_code, 403)
        for method, route, data in [
            ('patch', '/admin/users/3/status', {'status': 'suspended'}),
            ('put', '/admin/profile', {'name': 'Changed', 'email': 'changed@example.com', 'current_password': 'Testing123!'}),
            ('put', '/admin/password', {'current_password': 'Testing123!', 'new_password': 'Updated123!'})]:
            self.assertEqual(getattr(self.client, method)(route, json=data, headers=self.headers(2)).status_code, 403)
        with self.sessions() as db:
            db.get(models.User, 1).status = 0
            db.commit()
        self.assertEqual(self.client.get('/admin/users', headers=self.headers()).status_code, 403)

    def test_user_management_filters_and_suspension(self):
        result = self.client.get('/admin/users?search=Buyer&page_size=1', headers=self.headers()).json()
        self.assertEqual(result['total'], 1)
        self.assertNotIn('password', result['items'][0])
        response = self.client.patch('/admin/users/3/status', headers=self.headers(), json={'status': 'suspended'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/users/me', headers=self.headers(3)).status_code, 403)
        self.assertEqual(self.client.get('/admin/users?status=suspended', headers=self.headers()).json()['total'], 1)
        response = self.client.patch('/admin/users/1/status', headers=self.headers(), json={'status': 'suspended'})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.patch('/admin/users/999/status', headers=self.headers(), json={'status': 'active'}).status_code, 404)
        self.client.patch('/admin/users/3/status', headers=self.headers(), json={'status': 'active'})
        self.assertEqual(self.client.get('/users/me', headers=self.headers(3)).status_code, 200)

    def test_sidebar_listings_reports_and_analytics(self):
        post_id = self.submit()
        listing = self.client.get(f'/admin/posts/{post_id}', headers=self.headers()).json()
        self.assertEqual(listing['status'], 'pending')
        with self.sessions() as db:
            db.get(models.PostModeration, post_id).label = 'issue'
            db.commit()
        flagged = self.client.get('/admin/reports', headers=self.headers()).json()
        self.assertEqual(flagged['items'][0]['id'], post_id)
        self.assertEqual(self.decide(listing, 'reject').status_code, 200)
        self.assertEqual(self.client.get('/admin/reports', headers=self.headers()).json()['total'], 0)
        history = self.client.get('/admin/reports?status=resolved', headers=self.headers()).json()
        self.assertEqual(history['items'][0]['decision'], 'rejected')
        rejected = self.client.get('/admin/listings?status=rejected&search=Laptop', headers=self.headers()).json()
        self.assertEqual(rejected['total'], 1)
        self.assertEqual(rejected['items'][0]['status'], 'rejected')
        self.assertEqual(self.client.get('/admin/listings?page=0', headers=self.headers()).status_code, 422)
        self.assertEqual(self.client.get('/admin/posts/999', headers=self.headers()).status_code, 404)
        stats = self.client.get('/admin/analytics', headers=self.headers())
        self.assertEqual(stats.status_code, 200, stats.text)
        self.assertEqual(stats.json()['total_users'], 3)
        self.assertEqual(stats.json()['total_listings'], 1)
        self.assertEqual(len(stats.json()['months']), 6)
        self.assertEqual(sum(c['count'] for c in stats.json()['categories']), 1)

    def test_exchange_management_actual_status_and_search(self):
        post_id = self.submit()
        self.decide(self.client.get('/admin/pending', headers=self.headers()).json()['posts'][0])
        response = self.client.post('/offers/', headers=self.headers(3), data={
            'post_id': post_id, 'title': 'Guitar', 'category': 'Music'})
        self.assertEqual(response.status_code, 200, response.text)
        result = self.client.get('/admin/exchanges?search=Buyer&status=pending', headers=self.headers()).json()
        self.assertEqual(result['total'], 1)
        offer = result['items'][0]
        self.assertEqual(offer['owner'], 'Seller')
        response = self.client.put(f"/offers/{offer['id']}/accept", headers=self.headers(2))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/admin/exchanges?status=accepted', headers=self.headers()).json()['total'], 1)
        stats = self.client.get('/admin/analytics', headers=self.headers()).json()
        self.assertEqual(stats['accepted_exchanges'], 1)
        self.assertEqual(sum(m['accepted'] for m in stats['months']), 1)

    def test_admin_profile_and_password_persist(self):
        data = {'name': 'Updated Admin', 'email': 'updated@example.com', 'current_password': 'wrong'}
        self.assertEqual(self.client.put('/admin/profile', headers=self.headers(), json=data).status_code, 400)
        data['current_password'] = 'Testing123!'
        data['email'] = 'seller@example.com'
        self.assertEqual(self.client.put('/admin/profile', headers=self.headers(), json=data).status_code, 409)
        data['email'] = 'updated@example.com'
        self.assertEqual(self.client.put('/admin/profile', headers=self.headers(), json=data).status_code, 200)
        me = self.client.get('/users/me', headers=self.headers()).json()
        self.assertEqual(me['name'], 'Updated Admin')
        self.assertEqual(me['email'], 'updated@example.com')
        self.assertEqual(me['role_id'], 2)
        self.assertIsNone(me['contact'])
        self.assertIsNone(me['picture'])
        response = self.client.put('/admin/password', headers=self.headers(), json={'current_password': 'wrong', 'new_password': 'Updated123!'})
        self.assertEqual(response.status_code, 400)
        response = self.client.put('/admin/password', headers=self.headers(), json={'current_password': 'Testing123!', 'new_password': 'Updated123!'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.post('/users/login', json={'email':'updated@example.com','password':'Testing123!'}).status_code, 401)
        self.assertEqual(self.client.post('/users/login', json={'email':'updated@example.com','password':'Updated123!'}).status_code, 200)


    def test_public_owner_profile_counts_both_sides(self):
        post_id = self.submit()
        self.decide(self.queued()[0])
        with self.sessions() as db:
            db.add(models.Post(p_id=99, user_id=3, title='Buyer item', description='Another item', in_exchange_for='Laptop', price_from=1, price_to=2, condition_score=8, status=1))
            db.flush()
            db.add_all([
                models.Offer(post_id=post_id, offering_user_id=3, title='Accepted incoming', status=2),
                models.Offer(post_id=99, offering_user_id=2, title='Accepted outgoing', status=2),
                models.Offer(post_id=post_id, offering_user_id=3, title='Rejected incoming', status=0),
                models.Offer(post_id=99, offering_user_id=2, title='Pending outgoing', status=1),
            ])
            db.commit()
        response = self.client.get(f'/posts/{post_id}')
        self.assertEqual(response.status_code, 200)
        seller = response.json()['seller']
        self.assertEqual(seller['email'], 'seller@example.com')
        self.assertEqual(seller['name'], 'Seller')
        self.assertIsNone(seller['avatar'])
        self.assertEqual(seller['barter_stats'], {'accepted':2, 'rejected':1, 'pending':1, 'total':4})
        self.assertNotIn('password', seller)
        self.assertNotIn('reports', seller)

    def test_reporting_auth_targets_duplicates_and_admin_resolution(self):
        post_id = self.submit()
        data = {'target_type':'post', 'target_id':post_id, 'reason':'misleading', 'details':'The item description seems inaccurate.'}
        self.assertEqual(self.client.post('/reports/', json=data).status_code, 401)
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(3)).status_code, 404)
        self.decide(self.queued()[0])
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(2)).status_code, 400)
        response = self.client.post('/reports/', json=data, headers=self.headers(3))
        self.assertEqual(response.status_code, 201, response.text)
        report_id = response.json()['id']
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(3)).status_code, 409)
        report = self.client.get('/admin/reports?status=submitted', headers=self.headers()).json()['items'][0]
        self.assertEqual(report['target_name'], 'Laptop for trade')
        self.assertEqual(report['reporter_name'], 'Buyer')
        self.assertEqual(self.client.get('/admin/reports?status=submitted', headers=self.headers(3)).status_code, 403)
        resolution = {'decision':'resolved', 'resolution':'Reviewed listing and contacted owner.'}
        self.assertEqual(self.client.post(f'/admin/reports/{report_id}/decision', json=resolution, headers=self.headers(3)).status_code, 403)
        response = self.client.post(f'/admin/reports/{report_id}/decision', json=resolution, headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.post(f'/admin/reports/{report_id}/decision', json=resolution, headers=self.headers()).status_code, 409)
        self.assertEqual(self.client.get('/admin/reports?status=submitted', headers=self.headers()).json()['total'], 0)
        reviewed = self.client.get('/admin/reports?status=reviewed', headers=self.headers()).json()['items'][0]
        self.assertEqual(reviewed['resolution'], resolution['resolution'])
        self.assertIsNotNone(reviewed['reviewed_at'])
        self.assertEqual(self.client.get(f'/posts/{post_id}').status_code, 200)

    def test_user_reporting_validation_and_deleted_target_snapshot(self):
        post_id = self.submit()
        self.decide(self.queued()[0])
        data = {'target_type':'user', 'target_id':2, 'reason':'spam', 'details':'This user sent repeated spam messages.'}
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(2)).status_code, 400)
        self.assertEqual(self.client.post('/reports/', json={**data, 'target_id':999}, headers=self.headers(3)).status_code, 404)
        self.assertEqual(self.client.post('/reports/', json={**data, 'details':'          '}, headers=self.headers(3)).status_code, 400)
        self.assertEqual(self.client.post('/reports/', json={**data, 'reason':'invalid'}, headers=self.headers(3)).status_code, 422)
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(3)).status_code, 201)
        report = self.client.get('/admin/reports?status=submitted&search=spam&page_size=1', headers=self.headers()).json()
        self.assertEqual(report['total'], 1)
        self.assertEqual(report['items'][0]['target_type'], 'user')
        data.update(target_type='post', target_id=post_id)
        self.assertEqual(self.client.post('/reports/', json=data, headers=self.headers(3)).status_code, 201)
        self.assertEqual(self.client.delete(f'/posts/{post_id}', headers=self.headers(2)).status_code, 200)
        report = self.client.get('/admin/reports?status=submitted', headers=self.headers()).json()['items'][0]
        self.assertIsNone(report['post_id'])
        self.assertEqual(report['target_name'], 'Laptop for trade')
        self.assertTrue(report['post_description'])
        self.assertEqual(self.client.post(f"/admin/reports/{report['id']}/decision", headers=self.headers(), json={'decision':'dismissed','resolution':'Post removed by the owner.'}).status_code, 200)
        self.assertEqual(self.client.get('/admin/users/2', headers=self.headers(3)).status_code, 403)
        self.assertEqual(self.client.get('/admin/users/2', headers=self.headers()).status_code, 200)


if __name__ == "__main__":
    unittest.main()
