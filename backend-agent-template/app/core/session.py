# app/db/session.py

from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def transaction(db: Session):
    """事务边界：with 块正常结束则 commit，抛异常则 rollback 并向外抛。

    用法：
        with transaction(self.db):
            ...写操作...
    把分散在各处的 try/commit/rollback 收敛成一处。
    """
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise
