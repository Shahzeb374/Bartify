"""Run: python -B -m unittest discover -s backend/tests -v (from repo root).

All records and uploads are isolated from the configured PostgreSQL database.
"""
import os
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
UPLOADS = tempfile.TemporaryDirectory(prefix="bartify-tests-")
os.chdir(UPLOADS.name)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from jose import jwt
from app import models
from app.auth import create_access_token
from app.moderation import classify_text
from app.routes import admin, users, posts, offers
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
        for router, prefix in [(users.router, "/users"), (posts.router, "/posts"), (offers.router, "/offers"), (admin.router, "/admin")]:
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
        })
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


if __name__ == "__main__":
    unittest.main()
