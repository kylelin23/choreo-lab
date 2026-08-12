import json

import pytest


class FakeFile:
    def __init__(self, filename):
        self.filename = filename


class TestUploadVideo:
    def test_upload_success(
        self, mocker, mock_s3_client, mock_videos_table, mock_sqs_client, sample_user_id
    ):
        mocker.patch("apis.upload_video.s3_client", mock_s3_client)
        mocker.patch("apis.upload_video.videos_table", mock_videos_table)
        mocker.patch("apis.upload_video.sqs_client", mock_sqs_client)
        mocker.patch("apis.upload_video.SQS_QUEUE_URL",
                     "https://fake-queue-url")
        mocker.patch("apis.upload_video.S3_BUCKET_NAME", "fake-bucket")

        from apis.upload_video import upload_video

        video_id, error = upload_video(FakeFile("dance.mp4"), sample_user_id)

        assert error is None
        assert video_id is not None

        mock_s3_client.upload_fileobj.assert_called_once()
        mock_videos_table.put_item.assert_called_once()
        put_item_args = mock_videos_table.put_item.call_args.kwargs["Item"]
        assert put_item_args["status"] == "processing"
        assert put_item_args["user_id"] == sample_user_id
        assert put_item_args["raw_key"] == f"raw/{sample_user_id}/{video_id}.mp4"

        mock_sqs_client.send_message.assert_called_once()
        sent_body = json.loads(
            mock_sqs_client.send_message.call_args.kwargs["MessageBody"]
        )
        assert sent_body["video_id"] == video_id
        assert sent_body["user_id"] == sample_user_id
        assert sent_body["raw_key"] == put_item_args["raw_key"]

    def test_upload_rejects_bad_extension(self, mocker, mock_s3_client, sample_user_id):
        mocker.patch("apis.upload_video.s3_client", mock_s3_client)

        from apis.upload_video import upload_video

        video_id, error = upload_video(FakeFile("dance.avi"), sample_user_id)

        assert video_id is None
        assert "unsupported file type" in error
        mock_s3_client.upload_fileobj.assert_not_called()

    def test_upload_rejects_empty_filename(self, sample_user_id):
        from apis.upload_video import upload_video

        video_id, error = upload_video(FakeFile(""), sample_user_id)

        assert video_id is None
        assert error == "no file selected"

    def test_upload_handles_s3_failure(self, mocker, mock_s3_client, sample_user_id):
        mock_s3_client.upload_fileobj.side_effect = Exception("network error")
        mocker.patch("apis.upload_video.s3_client", mock_s3_client)
        mocker.patch("apis.upload_video.S3_BUCKET_NAME", "fake-bucket")

        from apis.upload_video import upload_video

        video_id, error = upload_video(FakeFile("dance.mp4"), sample_user_id)

        assert video_id is None
        assert "upload failed" in error
