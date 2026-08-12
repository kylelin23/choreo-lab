from decimal import Decimal


class TestGetVideo:
    def test_get_video_success(
        self, mocker, mock_s3_client, mock_videos_table, sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "user_id": sample_user_id,
                "status": "done",
                "processed_key": f"processed/{sample_user_id}/{sample_video_id}.mp4",
                "created_at": "2026-01-01T00:00:00+00:00",
                "bpm": Decimal("128.35"),
                "beat_timestamps": [Decimal("0.5"), Decimal("0.97")],
                "counts": [1, 2],
            }
        }
        mock_s3_client.generate_presigned_url.return_value = "https://s3.example/presigned"
        mocker.patch("apis.get_video.videos_table", mock_videos_table)
        mocker.patch("apis.get_video.s3_client", mock_s3_client)
        mocker.patch("apis.get_video.S3_BUCKET_NAME", "fake-bucket")

        from apis.get_video import get_video

        result, error, status_code = get_video(sample_video_id, sample_user_id)

        assert error is None
        assert status_code == 200
        assert result["video_url"] == "https://s3.example/presigned"
        assert isinstance(result["bpm"], float)
        assert result["bpm"] == 128.35
        assert result["beat_timestamps"] == [0.5, 0.97]
        assert result["counts"] == [1, 2]

    def test_get_video_not_found(self, mocker, mock_videos_table, sample_user_id, sample_video_id):
        mock_videos_table.get_item.return_value = {}
        mocker.patch("apis.get_video.videos_table", mock_videos_table)

        from apis.get_video import get_video

        result, error, status_code = get_video(sample_video_id, sample_user_id)

        assert result is None
        assert status_code == 404

    def test_get_video_wrong_owner(
        self, mocker, mock_videos_table, sample_user_id, other_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "user_id": other_user_id,
                "status": "done",
            }
        }
        mocker.patch("apis.get_video.videos_table", mock_videos_table)

        from apis.get_video import get_video

        result, error, status_code = get_video(sample_video_id, sample_user_id)

        assert result is None
        assert status_code == 403
        assert "not authorized" in error

    def test_get_video_not_yet_done(
        self, mocker, mock_videos_table, sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "user_id": sample_user_id,
                "status": "processing",
            }
        }
        mocker.patch("apis.get_video.videos_table", mock_videos_table)

        from apis.get_video import get_video

        result, error, status_code = get_video(sample_video_id, sample_user_id)

        assert status_code == 425
        assert result["status"] == "processing"
