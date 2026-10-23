"""Compose 空配置可启动，未配置微信在请求边界受控失败。"""

import pytest
from pydantic import SecretStr

from app.api import dependencies
from app.core.config import Settings
from app.services import wechat_service


@pytest.mark.parametrize("blank", ["", " ", "\t\n"])
def test_blank_wechat_environment_is_unconfigured(client, monkeypatch, blank):
    monkeypatch.setenv("WECHAT_APP_ID", blank)
    monkeypatch.setenv("WECHAT_APP_SECRET", blank)
    configured = Settings(_env_file=None)
    assert configured.wechat_app_id is None
    assert configured.wechat_app_secret is None
    monkeypatch.setattr(dependencies, "settings", configured)

    def network_must_not_run(*args, **kwargs):
        pytest.fail("Unconfigured Wechat must not make an external request")

    monkeypatch.setattr(wechat_service, "_open_request", network_must_not_run)
    response = client.post("/api/v1/auth/wechat", json={"code": "one-time-code"})
    assert response.status_code == 503
    assert response.json()["code"] == 50302


def test_nonblank_wechat_credentials_preserve_original_values(monkeypatch):
    monkeypatch.setenv("WECHAT_APP_ID", " wx-real-id ")
    monkeypatch.setenv("WECHAT_APP_SECRET", " real-secret ")
    configured = Settings(_env_file=None)
    assert configured.wechat_app_id == " wx-real-id "
    assert configured.wechat_app_secret.get_secret_value() == " real-secret "
    assert "real-secret" not in repr(configured)
    assert (
        Settings(_env_file=None, wechat_app_secret=SecretStr("  ")).wechat_app_secret
        is None
    )
