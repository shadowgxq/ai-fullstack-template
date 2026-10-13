from typing import Generic, TypeVar

from pydantic import BaseModel


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "success"
    data: T | None = None


class Paginated(BaseModel, Generic[T]):
    list: list[T]
    total: int
    page: int
    page_size: int


def success_response(data: T | None = None, message: str = "success") -> dict:
    return {
        "code": 0,
        "message": message,
        "data": data,
    }


class ValidationIssue(BaseModel):
    loc: list[str | int]
    type: str
    msg: str
