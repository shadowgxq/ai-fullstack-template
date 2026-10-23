"""微信 code 交换与账户归一；远端交换不进入业务事务。"""

import json
from dataclasses import dataclass
from typing import Protocol
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import (
    WechatDependencyUnavailable,
    WechatLoginFailedException,
)
from app.core.security import create_access_token
from app.core.session import transaction
from app.models.user import User
from app.repositories.profile_repository import ProfileRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.wechat_identity_repository import (
    WechatIdentityRepository,
    is_identity_unique_conflict,
)
from app.services import auth_redis_service

MAX_EXCHANGE_RESPONSE_BYTES = 16_384


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # code/AppSecret 只发送至固定微信端点，不跟随重定向。
        return None


def _open_request(request: Request, timeout: float):
    return build_opener(_NoRedirect()).open(request, timeout=timeout)


@dataclass(frozen=True)
class WechatAccountIdentity:
    app_id: str
    open_id: str


class WechatCodeExchange(Protocol):
    def exchange(self, code: str) -> WechatAccountIdentity: ...


class _WechatSessionResponse(BaseModel):
    # session_key/unionid 和提供方错误原文不进入内部账户契约。
    openid: str | None = Field(default=None, min_length=1, max_length=128)
    errcode: int = Field(default=0, strict=True)


class HttpWechatCodeExchange:
    def __init__(
        self, app_id: str | None, app_secret: str | None, timeout_seconds: float
    ) -> None:
        self.app_id = app_id
        self.app_secret = app_secret
        self.timeout_seconds = timeout_seconds

    def exchange(self, code: str) -> WechatAccountIdentity:
        if not self.app_id or not self.app_secret:
            raise WechatDependencyUnavailable()
        query = urlencode(
            {
                "appid": self.app_id,
                "secret": self.app_secret,
                "js_code": code,
                "grant_type": "authorization_code",
            }
        )
        request = Request(
            f"https://api.weixin.qq.com/sns/jscode2session?{query}",
            headers={"Accept": "application/json"},
        )
        try:
            with _open_request(request, timeout=self.timeout_seconds) as response:
                raw = response.read(MAX_EXCHANGE_RESPONSE_BYTES + 1)
            if len(raw) > MAX_EXCHANGE_RESPONSE_BYTES:
                raise WechatDependencyUnavailable()
            payload = _WechatSessionResponse.model_validate(json.loads(raw))
        except (URLError, TimeoutError, OSError, ValueError, ValidationError):
            # URL、code 和供应商响应可能含凭据，不能复用原始异常消息。
            raise WechatDependencyUnavailable() from None
        if payload.errcode in (40029, 40163):
            raise WechatLoginFailedException()
        if payload.errcode or not payload.openid or not payload.openid.strip():
            raise WechatDependencyUnavailable()
        return WechatAccountIdentity(self.app_id, payload.openid)


class WechatAuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        identity_repo: WechatIdentityRepository,
        profile_repo: ProfileRepository,
        code_exchange: WechatCodeExchange,
        revision_repo: RevisionRepository | None = None,
    ) -> None:
        self.user_repo = user_repo
        self.identity_repo = identity_repo
        self.profile_repo = profile_repo
        self.code_exchange = code_exchange
        self.revision_repo = (
            revision_repo
            if revision_repo is not None
            else RevisionRepository(user_repo.db)
        )

    def login(self, code: str) -> tuple[str, User]:
        auth_redis_service.ensure_auth_available()
        identity = self.code_exchange.exchange(code)
        try:
            with transaction(self.user_repo.db):
                user = self.identity_repo.get_user(identity.app_id, identity.open_id)
                if user is None:
                    user = self.user_repo.create(f"wx_{uuid4().hex}", None)
                    self.identity_repo.create(
                        user.id, identity.app_id, identity.open_id
                    )
                    self.profile_repo.create(user.id)
                    self.revision_repo.create(user.id)
        except IntegrityError as error:
            if not is_identity_unique_conflict(error):
                raise
            # 竞争失败的 User/profile 随事务回滚；只读取确已存在的同一身份。
            user = self.identity_repo.get_user(identity.app_id, identity.open_id)
            if user is None:
                raise
        return create_access_token(str(user.id)), user
