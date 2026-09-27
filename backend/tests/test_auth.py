import os
import pytest
from fastapi.testclient import TestClient

from app.services.artifact_loader import load_artifacts_once
from app.services.auth_token import create_access_token
from main import app

@pytest.fixture(scope="session", autouse=True)
def setup_artifacts():
    load_artifacts_once()

def test_auth_register_login_roundtrip(tmp_path, monkeypatch):
    """
    Tests complete registration, login, and /auth/me retrieval workflow.
    """
    test_db = tmp_path / "test_users.db"
    import app.services.user_store as user_store
    monkeypatch.setattr(user_store, "USERS_DB_PATH", test_db)

    client = TestClient(app)

    # 1. Register new user
    reg_payload = {
        "full_name": "Ramesh Gowda",
        "phone_number": "9845012345",
        "password": "SecretPassword123!",
        "preferred_language": "kn",
        "role": "farmer",
        "default_taluk": "Sirsi",
        "default_district": "Uttara Kannada"
    }
    reg_resp = client.post("/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["status"] == "success"
    assert "token" in reg_data
    assert "user" in reg_data
    assert reg_data["user"]["full_name"] == "Ramesh Gowda"
    assert reg_data["user"]["phone_number"] == "9845012345"
    assert reg_data["user"]["preferred_language"] == "kn"
    assert reg_data["user"]["default_taluk"] == "Sirsi"
    # Never return password hash
    assert "password_hash" not in reg_data["user"]
    assert "password" not in reg_data["user"]

    token = reg_data["token"]

    # 2. Login with registered credentials
    login_payload = {
        "phone_number": "9845012345",
        "password": "SecretPassword123!"
    }
    login_resp = client.post("/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["status"] == "success"
    assert "token" in login_data
    assert login_data["user"]["full_name"] == "Ramesh Gowda"
    assert "password_hash" not in login_data["user"]

    # Also test with +91 country code prefix (normalization)
    login_prefix_resp = client.post("/auth/login", json={
        "phone_number": "+91 98450 12345",
        "password": "SecretPassword123!"
    })
    assert login_prefix_resp.status_code == 200

    # 3. GET /auth/me with valid Bearer token
    me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["status"] == "success"
    assert me_data["user"]["phone_number"] == "9845012345"
    assert "password_hash" not in me_data["user"]

    # 4. PATCH /auth/me to update preferences
    patch_resp = client.patch(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "preferred_language": "hi",
            "default_taluk": "Belagavi",
            "default_district": "Belagavi"
        }
    )
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert patch_data["user"]["preferred_language"] == "hi"
    assert patch_data["user"]["default_taluk"] == "Belagavi"

def test_duplicate_phone_rejected(tmp_path, monkeypatch):
    """
    Confirms duplicate phone registration is rejected cleanly.
    """
    test_db = tmp_path / "test_users_dup.db"
    import app.services.user_store as user_store
    monkeypatch.setattr(user_store, "USERS_DB_PATH", test_db)

    client = TestClient(app)

    reg_payload = {
        "full_name": "Basavaraj Patil",
        "phone_number": "9448011223",
        "password": "Password123!",
        "preferred_language": "en"
    }
    resp1 = client.post("/auth/register", json=reg_payload)
    assert resp1.status_code == 201

    # Attempt second registration with same phone
    resp2 = client.post("/auth/register", json=reg_payload)
    assert resp2.status_code == 400
    assert "already registered" in resp2.json()["detail"].lower()

def test_wrong_credentials_rejected_with_generic_message(tmp_path, monkeypatch):
    """
    Confirms wrong password or non-existent phone returns 401 with generic message.
    Never leaks whether the phone exists or password was wrong.
    """
    test_db = tmp_path / "test_users_auth_fail.db"
    import app.services.user_store as user_store
    monkeypatch.setattr(user_store, "USERS_DB_PATH", test_db)

    client = TestClient(app)

    client.post("/auth/register", json={
        "full_name": "Suresh Kumar",
        "phone_number": "9123456789",
        "password": "CorrectPassword123!",
        "preferred_language": "en"
    })

    # Wrong password
    resp_wrong_pw = client.post("/auth/login", json={
        "phone_number": "9123456789",
        "password": "WrongPassword999!"
    })
    assert resp_wrong_pw.status_code == 401
    assert resp_wrong_pw.json()["detail"] == "Invalid phone number or password."

    # Non-existent phone number
    resp_no_user = client.post("/auth/login", json={
        "phone_number": "9999999999",
        "password": "AnyPassword123!"
    })
    assert resp_no_user.status_code == 401
    assert resp_no_user.json()["detail"] == "Invalid phone number or password."

def test_token_validation_and_clean_rejection():
    """
    Confirms /auth/me requires valid token; malformed and missing tokens return 401.
    """
    client = TestClient(app)

    # Missing header
    no_auth = client.get("/auth/me")
    assert no_auth.status_code == 401
    assert "Missing Authorization" in no_auth.json()["detail"]

    # Malformed Bearer header
    bad_header = client.get("/auth/me", headers={"Authorization": "Token abcdef123"})
    assert bad_header.status_code == 401

    # Malformed JWT string
    bad_jwt = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"})
    assert bad_jwt.status_code == 401
    assert "Invalid authentication token" in bad_jwt.json()["detail"]
