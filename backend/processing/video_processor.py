import os
import tempfile
from decimal import Decimal


from clients import s3_client, videos_table, redis_client, S3_BUCKET_NAME
from processing.beat_sync import detect_beats_and_sync


# 1. Downloads raw video from S3
# 2. Calls beat detection file
# 3. Uploads result back to S3 and updates state in DynamoDB and Redis

def to_decimal(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [to_decimal(v) for v in value]
    return value


def process_video(video_id, user_id, raw_key):
    redis_client.set(f"job:{video_id}", "processing")

    with tempfile.TemporaryDirectory() as tmp_dir:
        input_path = os.path.join(tmp_dir, "input.mp4")
        output_path = os.path.join(tmp_dir, "output.mp4")

        try:
            s3_client.download_file(S3_BUCKET_NAME, raw_key, input_path)

            beat_data = detect_beats_and_sync(input_path, output_path)

            processed_key = f"processed/{user_id}/{video_id}.mp4"
            s3_client.upload_file(output_path, S3_BUCKET_NAME, processed_key)

            videos_table.update_item(
                Key={"video_id": video_id},
                UpdateExpression=(
                    "SET #s = :status, processed_key = :pk, "
                    "bpm = :bpm, beat_timestamps = :ts, counts = :counts"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":status": "done",
                    ":pk": processed_key,
                    ":bpm": to_decimal(beat_data["bpm"]),
                    ":ts": to_decimal(beat_data["beat_timestamps"]),
                    ":counts": beat_data["counts"],
                },
            )
            redis_client.set(f"job:{video_id}", "done")

        except Exception as e:
            print(f"[video_processor] job {video_id} failed: {e}")
            videos_table.update_item(
                Key={"video_id": video_id},
                UpdateExpression="SET #s = :status, #e = :err",
                ExpressionAttributeNames={"#s": "status", "#e": "error"},
                ExpressionAttributeValues={
                    ":status": "failed", ":err": str(e)},
            )
            redis_client.set(f"job:{video_id}", "failed")
