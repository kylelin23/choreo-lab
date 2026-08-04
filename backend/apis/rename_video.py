from clients import videos_table

# Sets a custom display name for a video.


def rename_video(video_id, user_id, name):
    name = (name or "").strip()
    if not name:
        return "name cannot be empty", 400
    if len(name) > 100:
        return "name is too long (100 characters max)", 400

    result = videos_table.get_item(Key={"video_id": video_id})
    item = result.get("Item")
    if item is None:
        return "not found", 404
    if item["user_id"] != user_id:
        return "not authorized to rename this video", 403

    videos_table.update_item(
        Key={"video_id": video_id},
        UpdateExpression="SET #n = :name",
        ExpressionAttributeNames={"#n": "name"},
        ExpressionAttributeValues={":name": name},
    )
    return None, 200