"""
Base Django settings — shared across all environments.

Environment-specific overrides live in ``dev.py`` and ``prod.py``.
Configuration is driven by environment variables (12-factor); a local
``.env`` file at the backend root is loaded automatically for convenience.
"""
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
import os

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env from the backend root if present (local dev convenience).
load_dotenv(BASE_DIR / ".env")


def env(key: str, default=None):
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def env_int(key: str, default: int) -> int:
    val = os.environ.get(key)
    if val is None or val == "":
        return default
    return int(val)


def env_list(key: str, default=None):
    val = os.environ.get(key)
    if not val:
        return default or []
    return [item.strip() for item in val.split(",") if item.strip()]


SECRET_KEY = env("SECRET_KEY", "django-insecure-dev-only-change-me")
DEBUG = env_bool("DEBUG", False)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

# --- Applications ---------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
]

LOCAL_APPS = [
    "core",
    "accounts",
    "inventory",
    "incentives",
    "sales",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Database -------------------------------------------------------------
# Uses DATABASE_URL when present (e.g. a Supabase / Render Postgres URL),
# otherwise falls back to a zero-setup local SQLite database.
DATABASE_URL = env("DATABASE_URL")
if DATABASE_URL:
    _db = dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        ssl_require=env_bool("DB_SSL_REQUIRE", True),
    )
    # Supabase's transaction pooler (port 6543) runs PgBouncer in transaction
    # mode, which is incompatible with psycopg3's server-side prepared
    # statements and server-side cursors. Set PGBOUNCER=true for that pooler.
    # (Not needed for the session pooler on 5432 or a direct connection.)
    if env_bool("PGBOUNCER", False):
        _db["DISABLE_SERVER_SIDE_CURSORS"] = True
        _db.setdefault("OPTIONS", {})["prepare_threshold"] = None
    DATABASES = {"default": _db}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# --- Cache ---------------------------------------------------------------
# Set CACHE_URL/REDIS_URL to a Redis URL in production. Local development and
# tests fall back to Django's in-process cache so the app still runs zero-setup.
CACHE_URL = env("CACHE_URL") or env("REDIS_URL")
CACHE_DEFAULT_TIMEOUT = env_int("CACHE_DEFAULT_TIMEOUT", 300)
CACHE_ANALYTICS_TIMEOUT = env_int("CACHE_ANALYTICS_TIMEOUT", 60)
CACHE_REFERENCE_TIMEOUT = env_int("CACHE_REFERENCE_TIMEOUT", 300)
CACHE_KEY_PREFIX = env("CACHE_KEY_PREFIX", "nippon-incentive")

if CACHE_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": CACHE_URL,
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
            "KEY_PREFIX": CACHE_KEY_PREFIX,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "nippon-incentive-local",
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
            "KEY_PREFIX": CACHE_KEY_PREFIX,
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- I18N -----------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# --- Static ---------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

# --- SimpleJWT ------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- CORS -----------------------------------------------------------------
# Locked to explicit origins in production via env.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)
CORS_ALLOW_CREDENTIALS = True

# Admin seed defaults (overridable via env / seed command flags).
DEMO_CREDENTIALS_ENABLED = env_bool("DEMO_CREDENTIALS_ENABLED", True)
DEMO_ADMIN_EMAIL = env("DEMO_ADMIN_EMAIL", "admin@nippon.test")
DEMO_ADMIN_PASSWORD = env("DEMO_ADMIN_PASSWORD", "Admin@12345")
DEMO_OFFICER_EMAIL = env("DEMO_OFFICER_EMAIL", "ravi.officer@nippon.test")
DEMO_OFFICER_PASSWORD = env("DEMO_OFFICER_PASSWORD", "Officer@12345")
