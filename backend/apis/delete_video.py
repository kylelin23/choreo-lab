from clients import s3_client, videos_table, S3_BUCKET_NAME

# Deletes a video's S3 objects and DynamoDB record


def delete_video(video_id, user_id):
    result = videos_table.get_item(Key={"video_id": video_id})
    item = result.get("Item")
    if item is None:
        return "not found", 404

    if item["user_id"] != user_id:
        return "not authorized to delete this video", 403

    keys_to_delete = []
    if item.get("raw_key"):
        keys_to_delete.append({"Key": item["raw_key"]})
    if item.get("processed_key"):
        keys_to_delete.append({"Key": item["processed_key"]})

    if keys_to_delete:
        s3_client.delete_objects(
            Bucket=S3_BUCKET_NAME,
            Delete={"Objects": keys_to_delete},
        )

    videos_table.delete_item(Key={"video_id": video_id})

    return None, 200
