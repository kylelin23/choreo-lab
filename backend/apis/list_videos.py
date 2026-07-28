from clients import videos_table

# Lists the previously uploaded dances


def list_videos(user_id):
    result = videos_table.query(
        IndexName="user_id-index",
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )

    return [
        {
            "video_id": item["video_id"],
            "status": item["status"],
            "created_at": item["created_at"],
        }
        for item in result.get("Items", [])
    ]
