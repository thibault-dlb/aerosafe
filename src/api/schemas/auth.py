from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field

from schemas.user import UserRead

# Simple shape check only: there is no e-mail verification (team decision).
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

Email = Annotated[
    str,
    Field(max_length=254, pattern=EMAIL_PATTERN),
    BeforeValidator(lambda value: value.strip().lower() if isinstance(value, str) else value),
]
# OWASP: length only, no composition rules.
NewPassword = Annotated[str, Field(min_length=12, max_length=128)]


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
