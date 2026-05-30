"""Cache helpers for API read paths.

The app uses versioned cache keys instead of backend-specific pattern deletes.
That keeps invalidation portable across Redis in production and LocMem locally.
"""
from hashlib import blake2s

from django.conf import settings
from django.core.cache import cache
from django.db import transaction

SCOPE_ACCOUNTS = "accounts"
SCOPE_REFERENCE = "reference"
SCOPE_SALES = "sales"
SCOPE_SETUP = "setup"

DEFAULT_TIMEOUT = getattr(settings, "CACHE_DEFAULT_TIMEOUT", 300)
ANALYTICS_TIMEOUT = getattr(settings, "CACHE_ANALYTICS_TIMEOUT", 60)
REFERENCE_TIMEOUT = getattr(settings, "CACHE_REFERENCE_TIMEOUT", 300)


def officer_sales_scope(officer_id) -> str:
    return f"sales.officer.{officer_id}"


def _version_key(scope: str) -> str:
    return f"cache-version:{scope}"


def cache_version(scope: str) -> int:
    key = _version_key(scope)
    version = cache.get(key)
    if version is None:
        cache.add(key, 1, timeout=None)
        version = cache.get(key, 1)
    return int(version)


def bump_cache_versions(*scopes: str) -> None:
    for scope in scopes:
        key = _version_key(scope)
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 2, timeout=None)


def bump_cache_versions_on_commit(*scopes: str) -> None:
    transaction.on_commit(lambda: bump_cache_versions(*scopes))


def invalidate_accounts_cache_on_commit() -> None:
    bump_cache_versions_on_commit(SCOPE_ACCOUNTS)


def invalidate_setup_cache_on_commit() -> None:
    bump_cache_versions_on_commit(SCOPE_REFERENCE, SCOPE_SETUP)


def invalidate_sales_cache_on_commit(officer_id=None) -> None:
    scopes = [SCOPE_SALES]
    if officer_id is not None:
        scopes.append(officer_sales_scope(officer_id))
    bump_cache_versions_on_commit(*scopes)


def make_cache_key(namespace: str, *parts, scopes=()) -> str:
    scope_versions = [f"{scope}.{cache_version(scope)}" for scope in scopes]
    raw = "|".join([namespace, *scope_versions, *(str(part) for part in parts)])
    digest = blake2s(raw.encode("utf-8"), digest_size=16).hexdigest()
    return f"api:{namespace}:{digest}"


def cache_get_or_set(key: str, factory, timeout: int | None = None):
    sentinel = object()
    cached = cache.get(key, sentinel)
    if cached is not sentinel:
        return cached

    value = factory()
    cache.set(key, value, DEFAULT_TIMEOUT if timeout is None else timeout)
    return value
