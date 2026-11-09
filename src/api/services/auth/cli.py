"""Create the first Supervisor, or promote an existing account.

Usage, from `src/api` (or `docker compose exec api python -m services.auth.cli <email>`):
    python -m services.auth.cli chief@example.com
"""

import argparse
import asyncio
import getpass
from collections.abc import Callable

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from core.database import database
from core.security import RoleCode
from schemas.auth import SignUpRequest
from services.auth.service import hasher
from services.auth.store import UserStore


class SupervisorCommand:
    """Sign-up only creates Users (UC-09), so the first Supervisor comes from here."""

    def __init__(self, store: UserStore) -> None:
        self._store = store

    async def run(self, email: str, ask_password: Callable[[], str]) -> str:
        supervisor = await self._store.get_role(RoleCode.SUPERVISOR)
        user = await self._store.get_by_email(email.strip().lower())
        if user is None:
            request = SignUpRequest(email=email, password=ask_password())
            try:
                user = await self._store.add_user(
                    request.email, hasher.hash(request.password), supervisor
                )
            except IntegrityError:
                return "This e-mail belongs to a deleted account; use another one."
        elif not UserStore.can_log_in(user):
            return (
                f"{user.email} is deactivated or anonymised; it could not log in as a Supervisor."
            )
        else:
            user.role_id, user.role = supervisor.id, supervisor
        await self._store.commit()
        return f"{user.email} is now a Supervisor."


def ask_password() -> str:  # pragma: no cover - interactive
    password = getpass.getpass("Password (12 to 128 characters): ")
    if password != getpass.getpass("Repeat the password: "):
        raise SystemExit("The passwords differ.")
    return password


async def main(email: str) -> None:  # pragma: no cover - needs the database
    try:
        async for session in database.get_session():
            print(await SupervisorCommand(UserStore(session)).run(email, ask_password))
    except ValidationError as error:
        raise SystemExit(f"Invalid e-mail or password: {error.errors()[0]['msg']}") from error
    finally:
        await database.close()


if __name__ == "__main__":  # pragma: no cover
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email")
    asyncio.run(main(parser.parse_args().email))
