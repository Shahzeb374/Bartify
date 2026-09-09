"""Local-only browser test server; uses temporary uploads and an in-memory DB.

Run from the repository root: python -B backend/tests/serve_browser_fixture.py
"""
from test_admin_workflow import AdminWorkflowTests, ROOT, tearDownModule
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from pathlib import Path

if __name__ == "__main__":
    AdminWorkflowTests.setUpClass()
    fixture = AdminWorkflowTests()
    fixture.setUp()
    try:
        app = fixture.client.app
        app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
        for number in range(22):
            fixture.submit(f"Browser test laptop {number + 1:02}")
        app.mount("/uploads", StaticFiles(directory=Path.cwd() / "uploads"), name="uploads")
        app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
        uvicorn.run(app, host="127.0.0.1", port=8011, log_level="warning")
    finally:
        fixture.tearDown()
        tearDownModule()
