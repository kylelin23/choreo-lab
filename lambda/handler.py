import json
import os
import tempfile
from decimal import Decimal

import boto3

from beat_sync import detect_beats_and_sync

s3_client = boto3.client("s3", region_name=os.environ["AWS_REGION"])
dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
videos_table = dynamodb.Table(os.environ["DYNAMODB_VIDEOS_TABLE"])

S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]


def to_decimal(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [to_decimal(v) for v in value]
    return value


def lambda_handler(event, context):
    for record in event["Records"]:
        body = json.loads(record["body"])
        video_id = body["video_id"]
        user_id = body["user_id"]
        raw_key = body["raw_key"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "input.mp4")
            output_path = os.path.join(tmp_dir, "output.mp4")

            try:
                s3_client.download_file(S3_BUCKET_NAME, raw_key, input_path)

                beat_data = detect_beats_and_sync(input_path, output_path)

                processed_key = f"processed/{user_id}/{video_id}.mp4"
                s3_client.upload_file(
                    output_path, S3_BUCKET_NAME, processed_key)

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
                print(f"[lambda] job {video_id} done")

            except Exception as e:
                print(f"[lambda] job {video_id} failed: {e}")
                videos_table.update_item(
                    Key={"video_id": video_id},
                    UpdateExpression="SET #s = :status, #e = :err",
                    ExpressionAttributeNames={"#s": "status", "#e": "error"},
                    ExpressionAttributeValues={
                        ":status": "failed",
                        ":err": str(e),
                    },
                )
                # Re-raise so SQS knows this message failed and can retry
                # (or route to a dead-letter queue, if one is configured)
                # rather than silently deleting a message whose job failed.
                raise

    return {"statusCode": 200}
