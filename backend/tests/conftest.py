import os
import sys

import pytest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("JWT_EXPIRATION_SECONDS", "3600")


@pytest.fixture
def mock_users_table(mocker):
    return mocker.MagicMock()


@pytest.fixture
def mock_videos_table(mocker):
    return mocker.MagicMock()


@pytest.fixture
def mock_s3_client(mocker):
    return mocker.MagicMock()


@pytest.fixture
def mock_redis_client(mocker):
    return mocker.MagicMock()


@pytest.fixture
def mock_sqs_client(mocker):
    return mocker.MagicMock()


@pytest.fixture
def sample_user_id():
    return "user-1234"


@pytest.fixture
def other_user_id():
    return "user-5678"


@pytest.fixture
def sample_video_id():
    return "video-abcd"


@pytest.fixture
def issue_test_token(sample_user_id):
    """Returns a real, valid JWT for sample_user_id using the actual
    signing logic — useful for tests that exercise decode_token()."""
    from jwt_utils import issue_token

    def _issue(user_id=sample_user_id, email="test@example.com"):
        return issue_token(user_id, email)

    return _issue
