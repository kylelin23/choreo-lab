class TestGetVideoStatus:
    def test_status_processing(self, mocker, mock_videos_table, sample_video_id):
        mock_videos_table.get_item.return_value = {
            "Item": {"video_id": sample_video_id, "status": "processing"}
        }
        mocker.patch("apis.video_status.videos_table", mock_videos_table)

        from apis.video_status import get_video_status

        result, error = get_video_status(sample_video_id)

        assert error is None
        assert result == {"status": "processing"}

    def test_status_failed_includes_error_message(self, mocker, mock_videos_table, sample_video_id):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "status": "failed",
                "error": "This video doesn't have an audio track",
            }
        }
        mocker.patch("apis.video_status.videos_table", mock_videos_table)

        from apis.video_status import get_video_status

        result, error = get_video_status(sample_video_id)

        assert result["status"] == "failed"
        assert result["error"] == "This video doesn't have an audio track"

    def test_status_done_has_no_error_key(self, mocker, mock_videos_table, sample_video_id):
        mock_videos_table.get_item.return_value = {
            "Item": {"video_id": sample_video_id, "status": "done"}
        }
        mocker.patch("apis.video_status.videos_table", mock_videos_table)

        from apis.video_status import get_video_status

        result, error = get_video_status(sample_video_id)

        assert "error" not in result

    def test_status_job_not_found(self, mocker, mock_videos_table, sample_video_id):
        mock_videos_table.get_item.return_value = {}
        mocker.patch("apis.video_status.videos_table", mock_videos_table)

        from apis.video_status import get_video_status

        result, error = get_video_status(sample_video_id)

        assert result is None
        assert error == "job not found"
