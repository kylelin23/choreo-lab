from clients import s3_client, videos_table, S3_BUCKET_NAME

# Gets the video from S3


def get_video(video_id, user_id):
    result = videos_table.get_item(Key={"video_id": video_id})
    item = result.get("Item")
    if item is None:
        return None, "not found", 404

    if item["user_id"] != user_id:
        return None, "not authorized to view this video", 403

    if item["status"] != "done":
        return {"status": item["status"]}, None, 425  # Too Early

    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET_NAME, "Key": item["processed_key"]},
        ExpiresIn=3600,
    )

    return {
        "video_id": video_id,
        "video_url": presigned_url,
        "created_at": item["created_at"],
    }, None, 200
