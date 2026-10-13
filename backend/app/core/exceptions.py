# app/core/exceptions.py


class BusinessException(Exception):
    """业务异常基类。"""

    def __init__(
        self,
        code: int,
        message: str,
        status_code: int = 400,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UsernameAlreadyExistsException(BusinessException):
    """用户名已存在。"""

    def __init__(self):
        super().__init__(
            code=40001,
            message="Username already exists",
            status_code=400,
        )


class LoginFailedException(BusinessException):
    """登录失败（用户名或密码错误）。"""

    def __init__(self):
        super().__init__(
            code=40101,
            message="Invalid username or password",
            status_code=401,
        )


class LoginLockedException(BusinessException):
    """登录失败次数过多，账号暂时锁定。"""

    def __init__(self):
        super().__init__(
            code=42901,
            message="Too many login failures, please try again later",
            status_code=429,
        )


class TokenRevokedException(BusinessException):
    """Token 已失效（已退出登录）。"""

    def __init__(self):
        super().__init__(
            code=40102,
            message="Token has been revoked",
            status_code=401,
        )


class AuthDependencyUnavailable(BusinessException):
    """Authentication or revocation could not be checked/persisted."""

    def __init__(self):
        super().__init__(
            code=50301,
            message="Authentication temporarily unavailable",
            status_code=503,
        )


class BookmarkResourceUnavailable(BusinessException):
    def __init__(self):
        super().__init__(40410, "Resource unavailable", 404)


class BookmarkKeyConflict(BusinessException):
    def __init__(self):
        super().__init__(
            40911, "Idempotency key was already used for different content", 409
        )


class BookmarkOperationPrevented(BusinessException):
    def __init__(self):
        super().__init__(40913, "Operation was prevented; submit a new intent", 409)


class BookmarkGroupNameConflict(BusinessException):
    def __init__(self):
        super().__init__(40910, "Group name already exists", 409)


class BookmarkGroupImpactChanged(BusinessException):
    def __init__(self):
        super().__init__(
            40912, "Group bookmark count changed; check the latest impact", 409
        )


class BookmarkMoveUnavailable(BusinessException):
    def __init__(self):
        super().__init__(40914, "Move source or target unavailable", 409)
