import secrets


class TemporaryPassword:
    """Provisional passwords a Supervisor reads out to the owner of a new account.

    Four groups of five characters, without the ones that look alike (0 O, 1 I L): 20
    characters out of 32 are 100 bits, far more than the 12 characters the API asks for.
    """

    ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    GROUPS = 4
    GROUP_LENGTH = 5

    @classmethod
    def generate(cls) -> str:
        groups = (
            "".join(secrets.choice(cls.ALPHABET) for _ in range(cls.GROUP_LENGTH))
            for _ in range(cls.GROUPS)
        )
        return "-".join(groups)
