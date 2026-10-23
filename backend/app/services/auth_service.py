from sqlalchemy.exc import IntegrityError
from app.core.session import transaction

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.revision_repository import RevisionRepository
from app.core.exceptions import (
    UsernameAlreadyExistsException,
    LoginFailedException,
    LoginLockedException,
)
from app.services import auth_redis_service


class AuthService:
    """认证业务逻辑层，处理用户注册、登录等认证相关业务。"""

    def __init__(
        self,
        repo: UserRepository,
        profile_repo: ProfileRepository,
        revision_repo: RevisionRepository | None = None,
    ):
        self.repo = repo
        self.profile_repo = profile_repo
        self.revision_repo = (
            revision_repo if revision_repo is not None else RevisionRepository(repo.db)
        )

    def register(self, username: str, password: str) -> User:
        try:
            with transaction(self.repo.db):
                if self.repo.get_by_username(username):
                    raise UsernameAlreadyExistsException()
                user = self.repo.create(
                    username=username, password_hash=hash_password(password)
                )
                self.profile_repo.create(user.id)
                self.revision_repo.create(user.id)
            return user
        except IntegrityError:
            # A competing registration can win after the initial read. The
            # transaction context has rolled back before querying the winner.
            if self.repo.get_by_username(username) is not None:
                raise UsernameAlreadyExistsException() from None
            raise

    def login(self, username: str, password: str) -> str:
        # 1. 已锁定直接拒绝
        if auth_redis_service.is_login_locked(username):
            raise LoginLockedException()

        # 2. 校验用户名与密码
        user = self.repo.get_by_username(username)
        if (
            user is None
            or user.password_hash is None
            or not verify_password(password, user.password_hash)
        ):
            # 失败计数 +1，达到上限则锁定
            count = auth_redis_service.record_login_failure(username)
            if count >= auth_redis_service.MAX_LOGIN_FAILURES:
                raise LoginLockedException()
            raise LoginFailedException()

        # 3. 登录成功，清除失败计数并签发 token
        auth_redis_service.clear_login_failure(username)
        return create_access_token(subject=str(user.id))

    def get_user_by_id(self, user_id: int) -> User | None:
        return self.repo.get_by_id(user_id)
