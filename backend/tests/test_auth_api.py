"""Authentication API integration against isolated SQLite and a Redis command fake."""

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"


def test_register_creates_user(client):
    resp = client.post(REGISTER, json={"username": "alice", "password": "pw-123456"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["username"] == "alice"
    assert body["data"]["id"] > 0  # 数据库真的分配了自增 id


def test_register_duplicate_username_rejected(client):
    client.post(REGISTER, json={"username": "bob", "password": "pw-123456"})
    # 同名再注册一次
    resp = client.post(REGISTER, json={"username": "bob", "password": "other"})

    assert resp.status_code == 400  # UsernameAlreadyExistsException
    assert resp.json()["code"] == 40001


def test_login_then_access_me(client):
    client.post(REGISTER, json={"username": "carol", "password": "pw-123456"})

    # 登录拿 token
    resp = client.post(LOGIN, json={"username": "carol", "password": "pw-123456"})
    assert resp.status_code == 200
    token = resp.json()["data"]["access_token"]
    assert token

    # 带 token 访问受保护接口
    resp = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["username"] == "carol"


def test_login_wrong_password_returns_401(client):
    client.post(REGISTER, json={"username": "dave", "password": "right-pw"})

    resp = client.post(LOGIN, json={"username": "dave", "password": "WRONG-pw"})

    assert resp.status_code == 401  # LoginFailedException
    assert resp.json()["code"] == 40101


def test_me_without_token_rejected(client):
    # 没带 Authorization 头，应被 OAuth2 依赖拦下
    resp = client.get(ME)
    assert resp.status_code == 401
