from clients import videos_table


def get_video_status(video_id):
    result = videos_table.get_item(Key={"video_id": video_id})
    item = result.get("Item")
    if item is None:
        return None, "job not found"

    status = item.get("status")
    response = {"status": status}
    if status == "failed" and item.get("error"):
        response["error"] = item["error"]

    return response, None
