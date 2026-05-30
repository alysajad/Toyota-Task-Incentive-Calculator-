from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import DemoCredentialsView, LoginView, MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("demo-credentials/", DemoCredentialsView.as_view(), name="auth-demo-credentials"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
]
