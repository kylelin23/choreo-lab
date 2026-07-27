import os
import uuid
import jwt
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# This file creates/verifies JWT Tokens

load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = "HS256"
JWT_EXP_SECONDS = int(os.environ.get("JWT_EXPIRATION_SECONDS", 3600))


def issue_token(user_id, email):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(seconds=JWT_EXP_SECONDS),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, payload


def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
