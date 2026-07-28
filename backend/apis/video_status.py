from clients import redis_client

# Gets the video status from Redis, used for polling
def get_video_status(video_id):
    status = redis_client.get(f"job:{video_id}")
    if status is None:
        return None, "job not found"
    return status, None