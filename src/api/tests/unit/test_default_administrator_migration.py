import importlib.util
import re
from pathlib import Path
from types import ModuleType

import pytest

from services.auth.service import hasher

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "database"
    / "migrations"
    / "versions"
    / "0046_insert_default_administrator.py"
)


def load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("migration_0046", MIGRATION)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def statements(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """The SQL the migration sends, captured instead of executed."""
    module = load_migration()
    sent: list[str] = []
    monkeypatch.setattr(module.op, "execute", lambda statement: sent.append(str(statement)))
    module.upgrade()
    return sent


def test_the_stored_hash_is_the_argon2id_hash_of_the_password_admin(statements: list[str]) -> None:
    (statement,) = statements
    stored = re.search(r"'(\$argon2id\$[^']+)'", statement)

    assert stored is not None
    assert hasher.verify(stored.group(1), "admin")


def test_the_account_is_a_supervisor_with_a_valid_public_identifier(
    statements: list[str],
) -> None:
    (statement,) = statements
    identifier = re.search(r"'([0-9A-HJKMNP-TV-Z]{26})'", statement)

    assert "'admin@aerosafe.com'" in statement
    assert "\"CD_ROLE\" = 'SUPERVISOR'" in statement
    assert identifier is not None


def test_an_existing_account_with_the_address_is_left_alone(statements: list[str]) -> None:
    assert 'ON CONFLICT ("LN_EMAIL") DO NOTHING' in statements[0]


def test_the_downgrade_removes_the_sessions_before_the_account(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_migration()
    sent: list[str] = []
    monkeypatch.setattr(module.op, "execute", lambda statement: sent.append(str(statement)))

    module.downgrade()

    assert '"JETON_RAFRAICHISSEMENT"' in sent[0]
    assert sent[1].startswith('DELETE FROM "UTILISATEUR"')
