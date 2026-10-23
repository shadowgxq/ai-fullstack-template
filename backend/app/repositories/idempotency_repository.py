from uuid import UUID

from sqlalchemy.orm import Session

from app.models.idempotency_receipt import IdempotencyReceipt


class IdempotencyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, owner_id: int, operation: str, key: str) -> IdempotencyReceipt | None:
        return (
            self.db.query(IdempotencyReceipt)
            .filter_by(owner_id=owner_id, operation=operation, key=key)
            .one_or_none()
        )

    def create(
        self,
        owner_id: int,
        operation: str,
        key: str,
        payload_hash: str,
        resource_id: UUID,
        response: dict[str, str | int],
    ) -> IdempotencyReceipt:
        receipt = IdempotencyReceipt(
            owner_id=owner_id,
            operation=operation,
            key=key,
            payload_hash=payload_hash,
            resource_id=resource_id,
            response_json=response,
        )
        self.db.add(receipt)
        self.db.flush()
        return receipt
