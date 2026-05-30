"""Local development settings."""
from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = env_bool("DEBUG", True)

# Convenient during local dev — allow any localhost origin.
CORS_ALLOW_ALL_ORIGINS = True

# Allow the Vite network URL (for example http://192.168.x.x:5173) to call the
# local API during demos. Production settings remain locked down separately.
ALLOWED_HOSTS = ["*"]
