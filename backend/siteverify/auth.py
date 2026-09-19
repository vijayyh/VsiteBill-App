import secrets
import string
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from .models import User

_PASSWORD_ALPHABET = string.ascii_uppercase + string.ascii_lowercase + string.digits


def generate_password(length: int = 10) -> str:
    """A random password an admin can read aloud/type over phone or WhatsApp."""
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _decode_token(token: str):
    return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token"}), 401

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = _decode_token(token)
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid or expired token"}), 401

        user = User.query.get(int(payload["sub"]))
        if user is None:
            return jsonify({"error": "User no longer exists"}), 401

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def require_role(role: str):
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            if g.current_user.role != role:
                return jsonify({"error": "Forbidden for this role"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
