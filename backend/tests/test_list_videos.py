class TestListVideos:
    def test_list_videos_sorted_by_status_then_recency(
        self, mocker, mock_videos_table, sample_user_id
    ):
        mock_videos_table.query.return_value = {
            "Items": [
                {
                    "video_id": "v1",
                    "status": "done",
                    "name": "Old done",
                    "created_at": "2026-01-01T00:00:00+00:00",
                },
                {
                    "video_id": "v2",
                    "status": "processing",
                    "name": "New processing",
                    "created_at": "2026-01-03T00:00:00+00:00",
                },
                {
                    "video_id": "v3",
                    "status": "done",
                    "name": "New done",
                    "created_at": "2026-01-02T00:00:00+00:00",
                },
                {
                    "video_id": "v4",
                    "status": "failed",
                    "name": "Failed one",
                    "created_at": "2026-01-04T00:00:00+00:00",
                },
            ]
        }
        mocker.patch("apis.list_videos.videos_table", mock_videos_table)

        from apis.list_videos import list_videos

        videos = list_videos(sample_user_id)

        # processing first, then done (most recent first within group), then failed
        assert [v["video_id"] for v in videos] == ["v2", "v3", "v1", "v4"]

    def test_list_videos_queries_by_user_id_index(
        self, mocker, mock_videos_table, sample_user_id
    ):
        mock_videos_table.query.return_value = {"Items": []}
        mocker.patch("apis.list_videos.videos_table", mock_videos_table)

        from apis.list_videos import list_videos

        list_videos(sample_user_id)

        call_kwargs = mock_videos_table.query.call_args.kwargs
        assert call_kwargs["IndexName"] == "user_id-index"
        assert call_kwargs["ExpressionAttributeValues"][":uid"] == sample_user_id

    def test_list_videos_falls_back_to_filename_when_unnamed(
        self, mocker, mock_videos_table, sample_user_id
    ):
        mock_videos_table.query.return_value = {
            "Items": [
                {
                    "video_id": "v1",
                    "status": "done",
                    "filename": "IMG_1234.mp4",
                    "created_at": "2026-01-01T00:00:00+00:00",
                }
            ]
        }
        mocker.patch("apis.list_videos.videos_table", mock_videos_table)

        from apis.list_videos import list_videos

        videos = list_videos(sample_user_id)

        assert videos[0]["name"] == "IMG_1234.mp4"

    def test_list_videos_empty(self, mocker, mock_videos_table, sample_user_id):
        mock_videos_table.query.return_value = {"Items": []}
        mocker.patch("apis.list_videos.videos_table", mock_videos_table)

        from apis.list_videos import list_videos

        assert list_videos(sample_user_id) == []
