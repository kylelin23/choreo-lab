class TestRenameVideo:
    def test_rename_video_success(
        self, mocker, mock_videos_table, sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {"video_id": sample_video_id, "user_id": sample_user_id}
        }
        mocker.patch("apis.rename_video.videos_table", mock_videos_table)

        from apis.rename_video import rename_video

        error, status_code = rename_video(
            sample_video_id, sample_user_id, "  My Cool Routine  ")

        assert error is None
        assert status_code == 200

        update_kwargs = mock_videos_table.update_item.call_args.kwargs
        assert update_kwargs["ExpressionAttributeValues"][":name"] == "My Cool Routine"

    def test_rename_video_rejects_empty_name(self, sample_user_id, sample_video_id):
        from apis.rename_video import rename_video

        error, status_code = rename_video(
            sample_video_id, sample_user_id, "   ")

        assert status_code == 400
        assert "cannot be empty" in error

    def test_rename_video_rejects_too_long_name(self, sample_user_id, sample_video_id):
        from apis.rename_video import rename_video

        error, status_code = rename_video(
            sample_video_id, sample_user_id, "x" * 101)

        assert status_code == 400
        assert "too long" in error

    def test_rename_video_not_found(
        self, mocker, mock_videos_table, sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {}
        mocker.patch("apis.rename_video.videos_table", mock_videos_table)

        from apis.rename_video import rename_video

        error, status_code = rename_video(
            sample_video_id, sample_user_id, "New name")

        assert status_code == 404

    def test_rename_video_wrong_owner(
        self, mocker, mock_videos_table, sample_user_id, other_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {"video_id": sample_video_id, "user_id": other_user_id}
        }
        mocker.patch("apis.rename_video.videos_table", mock_videos_table)

        from apis.rename_video import rename_video

        error, status_code = rename_video(
            sample_video_id, sample_user_id, "New name")

        assert status_code == 403
