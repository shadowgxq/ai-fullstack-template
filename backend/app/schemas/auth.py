from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


class Credentials(BaseModel):
    username: Annotated[str, StringConstraints(min_length=1, max_length=50)]
    password: str = Field(min_length=1, max_length=72)
    model_config = ConfigDict(extra="forbid")

    @field_validator("username")
    @classmethod
    def nonblank_username(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Username cannot be blank")
        return (
            value  # Preserve existing account identity, including significant spaces.
        )

    @field_validator("password")
    @classmethod
    def bcrypt_byte_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes")
        return value


class RegisterRequest(Credentials):
    pass


class LoginRequest(Credentials):
    pass


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUserResponse(BaseModel):
    id: int
    username: str
