from flask import Blueprint, request, jsonify
import jwt as pyjwt
from apis.register import register
from apis.login import login
from apis.me import me
from apis.logout import logout
from jwt_utils import decode_token
from extensions import limiter

auth_bp = Blueprint('auth', __name__)


def get_payload_or_error():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "not logged in"
    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        return None, "session expired"
    except pyjwt.InvalidTokenError:
        return None, "invalid token"
    return payload, None


@auth_bp.route('/api/auth/register', methods=['POST'])
@limiter.limit("5 per hour")
def register_route():
    data = request.json
    token, user, error = register(data["email"], data["password"])
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"token": token, "email": user["email"]})


@auth_bp.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per hour")
def login_route():
    data = request.json
    token, user, error = login(data["email"], data["password"])
    if error:
        return jsonify({"error": error}), 401
    return jsonify({"token": token, "email": user["email"]})


@auth_bp.route('/api/auth/me', methods=['GET'])
def me_route():
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401
    result, error = me(payload)
    if error:
        return jsonify({"error": error}), 401
    return jsonify(result)


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout_route():
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401
    logout(payload)
    return jsonify({"status": "logged out"})
