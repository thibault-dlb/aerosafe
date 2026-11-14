from typing import Annotated, Literal

from pydantic import BaseModel, Field

from schemas.user import Email, NewPassword, UserRead


class SignUpRequest(BaseModel):
    email: Email
    password: NewPassword


class LoginRequest(BaseModel):
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=128)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Lifetime of the access token, in seconds")
    user: UserRead
