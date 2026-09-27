import datetime
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import Dict, Any, Optional

import bcrypt

from app.config import ARTIFACTS_DIR

logger = logging.getLogger("varsha_setu.user_store")

USERS_DB_PATH = Path(ARTIFACTS_DIR) / "users.db"

INDIAN_PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")

def normalize_phone_number(phone: str) -> str:
    """
    Strips country code (+91 / 91 / 0), spaces, dashes and non-numeric characters.
    Returns cleaned 10-digit phone string.
    """
    cleaned = re.sub(r"[^\d]", "", phone.strip())
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned

def validate_indian_phone(phone: str) -> bool:
    """Validates that a normalized phone number is a plausible 10-digit Indian mobile number."""
    cleaned = normalize_phone_number(phone)
    return bool(INDIAN_PHONE_REGEX.match(cleaned))

def hash_password(password: str) -> str:
    """Hashes password with bcrypt."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def init_user_db(db_path: Optional[Path] = None):
    """Initializes SQLite user storage schema."""
    target_db = db_path or USERS_DB_PATH
    target_db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(target_db)) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                phone_number TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'farmer',
                preferred_language TEXT NOT NULL DEFAULT 'en',
                default_taluk TEXT,
                default_district TEXT,
                notification_prefs TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
            ON users (phone_number)
            """
        )
        conn.commit()

def user_row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Converts a SQLite user row to a safe dictionary without password_hash."""
    d = dict(row)
    d.pop("password_hash", None)
    if d.get("notification_prefs"):
        try:
            d["notification_prefs"] = json.loads(d["notification_prefs"])
        except Exception:
            pass
    else:
        d["notification_prefs"] = {}
    return d

def get_user_by_phone(phone: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieves full user record including password_hash by normalized phone number."""
    target_db = db_path or USERS_DB_PATH
    init_user_db(target_db)
    clean_phone = normalize_phone_number(phone)
    with sqlite3.connect(str(target_db)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE phone_number = ?", (clean_phone,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_by_id(user_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieves public user profile by user_id."""
    target_db = db_path or USERS_DB_PATH
    init_user_db(target_db)
    with sqlite3.connect(str(target_db)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return user_row_to_dict(row) if row else None

def create_user(
    full_name: str,
    phone_number: str,
    password_plain: str,
    preferred_language: str = "en",
    role: str = "farmer",
    default_taluk: Optional[str] = None,
    default_district: Optional[str] = None,
    notification_prefs: Optional[Dict[str, Any]] = None,
    db_path: Optional[Path] = None
) -> Dict[str, Any]:
    """
    Creates a new user record.
    Enforces phone uniqueness and hashes the password before insertion.
    """
    target_db = db_path or USERS_DB_PATH
    init_user_db(target_db)
    clean_phone = normalize_phone_number(phone_number)
    pwd_hash = hash_password(password_plain)
    now_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    prefs_json = json.dumps(notification_prefs) if notification_prefs else None

    # Normalize role
    clean_role = role.lower().strip() if role else "farmer"
    if clean_role not in ("farmer", "officer", "admin"):
        clean_role = "farmer"

    # Normalize language
    clean_lang = preferred_language.lower().strip() if preferred_language else "en"
    if clean_lang not in ("en", "kn", "hi"):
        clean_lang = "en"

    with sqlite3.connect(str(target_db)) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (
                full_name, phone_number, password_hash, role,
                preferred_language, default_taluk, default_district,
                notification_prefs, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_name.strip(),
                clean_phone,
                pwd_hash,
                clean_role,
                clean_lang,
                default_taluk.strip() if default_taluk else None,
                default_district.strip() if default_district else None,
                prefs_json,
                now_ts
            )
        )
        conn.commit()
        user_id = cursor.lastrowid

    user = get_user_by_id(user_id, db_path=target_db)
    if not user:
        raise RuntimeError("User creation failed to return persisted record.")
    return user

def update_user_profile(
    user_id: int,
    updates: Dict[str, Any],
    db_path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Updates allowed user profile fields (preferred_language, default_taluk, default_district, notification_prefs)."""
    target_db = db_path or USERS_DB_PATH
    init_user_db(target_db)
    allowed_keys = {"preferred_language", "default_taluk", "default_district", "notification_prefs"}
    fields = []
    values = []

    for k, v in updates.items():
        if k not in allowed_keys:
            continue
        if k == "preferred_language":
            v_lang = str(v).lower().strip()
            if v_lang in ("en", "kn", "hi"):
                fields.append(f"{k} = ?")
                values.append(v_lang)
        elif k == "notification_prefs":
            fields.append(f"{k} = ?")
            values.append(json.dumps(v) if isinstance(v, dict) else str(v))
        else:
            fields.append(f"{k} = ?")
            values.append(str(v).strip() if v is not None else None)

    if not fields:
        return get_user_by_id(user_id, db_path=target_db)

    values.append(user_id)
    query = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"

    with sqlite3.connect(str(target_db)) as conn:
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()

    return get_user_by_id(user_id, db_path=target_db)
