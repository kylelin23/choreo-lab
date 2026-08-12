import time

import bcrypt
import pytest
from botocore.exceptions import ClientError

# Checks that the user has registered
class TestRegister:
    def test_register_success(self, mocker, mock_users_table):
        mocker.patch("apis.register.users_table", mock_users_table)

        from apis.register import register

        token, user, error = register("new@example.com", "password123")

        assert error is None
        assert token is not None
        assert user["email"] == "new@example.com"
        mock_users_table.put_item.assert_called_once()

    def test_register_weak_password(self, mocker, mock_users_table):
        mocker.patch("apis.register.users_table", mock_users_table)

        from apis.register import register

        token, user, error = register("new@example.com", "abc")

        assert token is None
        assert "too weak" in error
        mock_users_table.put_item.assert_not_called()

    def test_register_duplicate_email(self, mocker, mock_users_table):
        mock_users_table.put_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "x"}},
            "PutItem",
        )
        mocker.patch("apis.register.users_table", mock_users_table)

        from apis.register import register

        token, user, error = register("dupe@example.com", "password123")

        assert token is None
        assert "already exists" in error


class TestLogin:
    def test_login_success(self, mocker, mock_users_table):
        password_hash = bcrypt.hashpw(
            b"correct-password", bcrypt.gensalt()).decode()
        mock_users_table.get_item.return_value = {
            "Item": {
                "email": "user@example.com",
                "user_id": "user-1234",
                "password_hash": password_hash,
            }
        }
        mocker.patch("apis.login.users_table", mock_users_table)

        from apis.login import login

        token, user, error = login("user@example.com", "correct-password")

        assert error is None
        assert token is not None
        assert user["user_id"] == "user-1234"

    def test_login_wrong_password(self, mocker, mock_users_table):
        password_hash = bcrypt.hashpw(
            b"correct-password", bcrypt.gensalt()).decode()
        mock_users_table.get_item.return_value = {
            "Item": {
                "email": "user@example.com",
                "user_id": "user-1234",
                "password_hash": password_hash,
            }
        }
        mocker.patch("apis.login.users_table", mock_users_table)

        from apis.login import login

        token, user, error = login("user@example.com", "wrong-password")

        assert token is None
        assert error == "invalid credentials"

    def test_login_unknown_email(self, mocker, mock_users_table):
        mock_users_table.get_item.return_value = {}
        mocker.patch("apis.login.users_table", mock_users_table)

        from apis.login import login

        token, user, error = login("nobody@example.com", "whatever")

        assert token is None
        assert error == "invalid credentials"


class TestLogout:
    def test_logout_writes_blocklist_with_correct_ttl(self, mocker, mock_redis_client):
        mocker.patch("apis.logout.redis_client", mock_redis_client)

        from apis.logout import logout

        payload = {"jti": "some-jti", "exp": int(time.time()) + 300}
        logout(payload)

        mock_redis_client.setex.assert_called_once()
        args, _ = mock_redis_client.setex.call_args
        key, ttl, value = args
        assert key == "blocklist:some-jti"
        assert 295 <= ttl <= 300

    def test_logout_skips_write_for_already_expired_token(self, mocker, mock_redis_client):
        mocker.patch("apis.logout.redis_client", mock_redis_client)

        from apis.logout import logout

        payload = {"jti": "some-jti", "exp": int(time.time()) - 10}
        logout(payload)

        mock_redis_client.setex.assert_not_called()


class TestMe:
    def test_me_returns_user_info_when_not_blocklisted(self, mocker, mock_redis_client):
        mock_redis_client.exists.return_value = False
        mocker.patch("apis.me.redis_client", mock_redis_client)

        from apis.me import me

        result, error = me(
            {"sub": "user-1234", "email": "user@example.com", "jti": "jti-1"})

        assert error is None
        assert result["user_id"] == "user-1234"

    def test_me_rejects_blocklisted_token(self, mocker, mock_redis_client):
        mock_redis_client.exists.return_value = True
        mocker.patch("apis.me.redis_client", mock_redis_client)

        from apis.me import me

        result, error = me(
            {"sub": "user-1234", "email": "user@example.com", "jti": "jti-1"})

        assert result is None
        assert error == "not logged in"
