from sqlite3 import IntegrityError as SQLiteIntegrityError

from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wechat_identity import WechatIdentity


def is_identity_unique_conflict(error: IntegrityError) -> bool:
    """只收敛身份唯一约束竞争，不吞掉其它字段/FK/唯一写入错误。"""
    if isinstance(error.orig, UniqueViolation):
        return error.orig.diag.constraint_name == "uq_wechat_identity_app_open"
    # SQLite 是本项目相邻单测的实际方言，生产仍以 PostgreSQL 约束名判断。
    return isinstance(error.orig, SQLiteIntegrityError) and str(error.orig) == (
        "UNIQUE constraint failed: wechat_identities.app_id, wechat_identities.open_id"
    )


class WechatIdentityRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user(self, app_id: str, open_id: str) -> User | None:
        return (
            self.db.query(User)
            .join(WechatIdentity, WechatIdentity.user_id == User.id)
            .filter(WechatIdentity.app_id == app_id, WechatIdentity.open_id == open_id)
            .first()
        )

    def create(self, user_id: int, app_id: str, open_id: str) -> WechatIdentity:
        identity = WechatIdentity(user_id=user_id, app_id=app_id, open_id=open_id)
        self.db.add(identity)
        self.db.flush()
        return identity
