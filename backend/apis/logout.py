import time
from clients import redis_client

def logout(payload):
    ttl = payload["exp"] - int(time.time())
    if ttl > 0:
        redis_client.setex(f"blocklist:{payload['jti']}", ttl, "1")
