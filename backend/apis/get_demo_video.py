import os
from clients import s3_client, videos_table, S3_BUCKET_NAME

DEMO_VIDEO_ID = os.environ.get("DEMO_VIDEO_ID")


def get_demo_video():
    if not DEMO_VIDEO_ID:
        return None, "no demo video configured", 404

    result = videos_table.get_item(Key={"video_id": DEMO_VIDEO_ID})
    item = result.get("Item")
    if item is None or item.get("status") != "done":
        return None, "demo video not available", 404

    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET_NAME, "Key": item["processed_key"]},
        ExpiresIn=3600,
    )

    return {
        "video_id": DEMO_VIDEO_ID,
        "video_url": presigned_url,
        "bpm": float(item.get("bpm", 0)),
        "beat_timestamps": [float(t) for t in item.get("beat_timestamps", [])],
        "counts": [int(c) for c in item.get("counts", [])],
    }, None, 200
