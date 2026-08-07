from flask_limiter import Limiter
from flask import request


def get_rate_limit_key():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from jwt_utils import decode_token
            payload = decode_token(auth_header.split(" ", 1)[1])
            return payload["sub"]
        except Exception:
            pass
    return request.remote_addr


limiter = Limiter(key_func=get_rate_limit_key, default_limits=["200 per hour"])
