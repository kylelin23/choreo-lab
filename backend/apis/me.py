from clients import redis_client

def me(payload):
    if redis_client.exists(f"blocklist:{payload['jti']}"):
        return None, "not logged in"
    return {"user_id": payload["sub"], "email": payload["email"]}, None
