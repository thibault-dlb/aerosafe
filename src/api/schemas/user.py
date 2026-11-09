from pydantic import BaseModel, Field


class UserRead(BaseModel):
    """An account as the API shows it. `id` is the public ULID, never the internal key."""

    id: str = Field(description="Public identifier (ULID)")
    email: str
    role: str = Field(description="Role code: USER or SUPERVISOR")
    is_active: bool
