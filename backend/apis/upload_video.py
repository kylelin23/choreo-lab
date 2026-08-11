import uuid
import json
from datetime import datetime, timezone

from clients import s3_client, videos_table, sqs_client, S3_BUCKET_NAME, SQS_QUEUE_URL

ALLOWED_EXTENSIONS = {".mp4", ".mov"}


def upload_video(file, user_id):
    if file.filename == "":
        return None, "no file selected"

    ext = "." + \
        file.filename.rsplit(
            ".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return None, f"unsupported file type: {ext}"

    video_id = str(uuid.uuid4())
    raw_key = f"raw/{user_id}/{video_id}{ext}"

    try:
        s3_client.upload_fileobj(file, S3_BUCKET_NAME, raw_key)
    except Exception as e:
        return None, f"upload failed: {str(e)}"

    videos_table.put_item(Item={
        "video_id": video_id,
        "user_id": user_id,
        "status": "processing",
        "raw_key": raw_key,
        "filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    sqs_client.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps({
            "video_id": video_id,
            "user_id": user_id,
            "raw_key": raw_key,
        }),
    )

    return video_id, None
