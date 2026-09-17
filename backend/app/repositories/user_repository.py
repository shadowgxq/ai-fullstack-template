from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    """用户数据访问层，封装所有 User 相关的数据库操作。"""

    def __init__(self, db: Session):
        self.db = db

    def create(self, username: str, password_hash: str) -> User:
        user = User(username=username, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> User | None:
        return self.db.query(User).filter(User.username == username).first()
