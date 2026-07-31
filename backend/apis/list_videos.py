from clients import videos_table

# Lists the previously uploaded dances

STATUS_ORDER = {"processing": 0, "done": 1, "failed": 2}


def list_videos(user_id):
    result = videos_table.query(
        IndexName="user_id-index",
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )

    videos = [
        {
            "video_id": item["video_id"],
            "status": item["status"],
            "filename": item.get("filename", "Untitled"),
            "created_at": item["created_at"],
        }
        for item in result.get("Items", [])
    ]

    videos.sort(key=lambda v: v["created_at"], reverse=True)
    videos.sort(key=lambda v: STATUS_ORDER.get(v["status"], 99))

    return videos
