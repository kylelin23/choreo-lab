class TestDeleteVideo:
    def test_delete_video_success(
        self,
        mocker,
        mock_s3_client,
        mock_videos_table,
        sample_user_id,
        sample_video_id,
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "user_id": sample_user_id,
                "raw_key": f"raw/{sample_user_id}/{sample_video_id}.mp4",
                "processed_key": f"processed/{sample_user_id}/{sample_video_id}.mp4",
            }
        }
        mocker.patch("apis.delete_video.videos_table", mock_videos_table)
        mocker.patch("apis.delete_video.s3_client", mock_s3_client)
        mocker.patch("apis.delete_video.S3_BUCKET_NAME", "fake-bucket")

        from apis.delete_video import delete_video

        error, status_code = delete_video(sample_video_id, sample_user_id)

        assert error is None
        assert status_code == 200

        s3_call = mock_s3_client.delete_objects.call_args.kwargs
        deleted_keys = {obj["Key"] for obj in s3_call["Delete"]["Objects"]}
        assert deleted_keys == {
            f"raw/{sample_user_id}/{sample_video_id}.mp4",
            f"processed/{sample_user_id}/{sample_video_id}.mp4",
        }

        mock_videos_table.delete_item.assert_called_once_with(
            Key={"video_id": sample_video_id}
        )

    def test_delete_video_still_processing_has_no_processed_key(
        self, mocker, mock_s3_client, mock_videos_table,
        sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {
                "video_id": sample_video_id,
                "user_id": sample_user_id,
                "raw_key": f"raw/{sample_user_id}/{sample_video_id}.mp4",
                # no processed_key yet — still processing
            }
        }
        mocker.patch("apis.delete_video.videos_table", mock_videos_table)
        mocker.patch("apis.delete_video.s3_client", mock_s3_client)
        mocker.patch("apis.delete_video.S3_BUCKET_NAME", "fake-bucket")

        from apis.delete_video import delete_video

        error, status_code = delete_video(sample_video_id, sample_user_id)

        assert status_code == 200
        s3_call = mock_s3_client.delete_objects.call_args.kwargs
        deleted_keys = {obj["Key"] for obj in s3_call["Delete"]["Objects"]}
        assert deleted_keys == {f"raw/{sample_user_id}/{sample_video_id}.mp4"}

    def test_delete_video_not_found(
        self, mocker, mock_videos_table, sample_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {}
        mocker.patch("apis.delete_video.videos_table", mock_videos_table)

        from apis.delete_video import delete_video

        error, status_code = delete_video(sample_video_id, sample_user_id)

        assert status_code == 404

    def test_delete_video_wrong_owner(
        self, mocker, mock_videos_table, sample_user_id, other_user_id, sample_video_id
    ):
        mock_videos_table.get_item.return_value = {
            "Item": {"video_id": sample_video_id, "user_id": other_user_id}
        }
        mocker.patch("apis.delete_video.videos_table", mock_videos_table)

        from apis.delete_video import delete_video

        error, status_code = delete_video(sample_video_id, sample_user_id)

        assert status_code == 403
        assert "not authorized" in error
