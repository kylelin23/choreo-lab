import uuid
import bcrypt
from botocore.exceptions import ClientError
from clients import users_table
from jwt_utils import issue_token


def register(email, password):
    if len(password) < 6:
        return None, None, "password is too weak (needs at least 6 characters)"

    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        users_table.put_item(
            Item={"email": email, "user_id": user_id,
                  "password_hash": password_hash},
            ConditionExpression="attribute_not_exists(email)",
        )
    except ClientError:
        return None, None, "an account with this email already exists"

    token, _ = issue_token(user_id, email)
    return token, {"user_id": user_id, "email": email}, None
