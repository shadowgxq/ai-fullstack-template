from sqlalchemy.orm import Session

from app.models.account_revision import AccountRevision


class RevisionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, owner_id: int) -> AccountRevision:
        revision = AccountRevision(
            owner_id=owner_id,
            inventory_revision=0,
            history_revision=0,
            preferences_revision=0,
        )
        self.db.add(revision)
        self.db.flush()
        return revision

    def lock(self, owner_id: int) -> AccountRevision:
        """所有写入先锁账户，后锁 UUID 资源；事务由调用 service 管理。"""
        revision = (
            self.db.query(AccountRevision)
            .filter(AccountRevision.owner_id == owner_id)
            .with_for_update()
            .populate_existing()
            .one_or_none()
        )
        if revision is None:
            raise RuntimeError("Account revision row is missing")
        return revision

    def increment_inventory(self, revision: AccountRevision) -> None:
        revision.inventory_revision += 1
        self.db.flush()

    def increment_history(self, revision: AccountRevision) -> None:
        revision.history_revision += 1
        self.db.flush()

    def increment_preferences(self, revision: AccountRevision) -> None:
        revision.preferences_revision += 1
        self.db.flush()
