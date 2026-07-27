import bcrypt
from clients import users_table
from jwt_utils import issue_token


def login(email, password):
    result = users_table.get_item(Key={"email": email})
    item = result.get("Item")
    if item is None or not bcrypt.checkpw(password.encode(), item["password_hash"].encode()):
        return None, None, "invalid credentials"

    token, _ = issue_token(item["user_id"], email)
    return token, {"user_id": item["user_id"], "email": email}, None
