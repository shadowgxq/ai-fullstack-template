"""
最小测试：验证 TestClient 真能把请求打进 FastAPI 应用。
这个不碰数据库，是确认"测试地基搭好了"的第一步。

pytest 怎么发现测试：文件名 test_*.py、函数名 test_*，自动收集运行。
断言就用 Python 原生 assert，pytest 会在失败时打印出两边的值。
"""


def test_health_check(client):
    # client 是 conftest.py 里的 fixture，pytest 看到这个参数名就自动注入。
    resp = client.get("/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
