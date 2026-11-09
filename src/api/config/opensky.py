from typing import Literal

from pydantic import Field, SecretStr, model_validator

from config.base import CustomBaseSettings
from services.collection.profiles import BoundingBox, CollectionProfile, ProfileCode

# Daily OpenSky credits (REST API documentation, checked on 2026-11-06).
ANONYMOUS_DAILY_CREDITS = 400
ACCOUNT_DAILY_CREDITS = 4_000

_PERIODS = {ProfileCode.ILE_DE_FRANCE: 30, ProfileCode.FRANCE: 120}


class OpenSkySettings(CustomBaseSettings):
    """OpenSky access and collection profile, read once at start-up.

    The application refuses to start when the active profile would use more credits per day
    than the access type allows.
    """

    # Off by default: only one instance may collect with the group account at a time.
    COLLECTION_ENABLED: bool = False
    COLLECTION_PROFILE: Literal["ILE_DE_FRANCE", "FRANCE"] = "ILE_DE_FRANCE"
    # Maximum gap between two observations of the same flight (D-06).
    COLLECTION_FLIGHT_GAP_MINUTES: int = Field(default=30, gt=0)
    # lat_min,lat_max,lon_min,lon_max
    COLLECTION_BBOX_ILE_DE_FRANCE: str = "48.0,49.3,1.4,3.6"
    COLLECTION_BBOX_FRANCE: str = "41.3,51.1,-5.2,9.6"

    # Empty client ID: anonymous access.
    OPENSKY_CLIENT_ID: str = ""
    OPENSKY_CLIENT_SECRET: SecretStr = SecretStr("")
    OPENSKY_API_URL: str = "https://opensky-network.org/api"
    OPENSKY_TOKEN_URL: str = (
        "https://auth.opensky-network.org/auth/realms/opensky-network"
        "/protocol/openid-connect/token"
    )
    OPENSKY_TIMEOUT_SECONDS: float = Field(default=10.0, gt=0)

    @property
    def has_credentials(self) -> bool:
        return bool(self.OPENSKY_CLIENT_ID and self.OPENSKY_CLIENT_SECRET.get_secret_value())

    @property
    def daily_quota(self) -> int:
        return ACCOUNT_DAILY_CREDITS if self.has_credentials else ANONYMOUS_DAILY_CREDITS

    @property
    def profile(self) -> CollectionProfile:
        boxes = {
            ProfileCode.ILE_DE_FRANCE: self.COLLECTION_BBOX_ILE_DE_FRANCE,
            ProfileCode.FRANCE: self.COLLECTION_BBOX_FRANCE,
        }
        code = self.COLLECTION_PROFILE
        return CollectionProfile(code, BoundingBox.parse(boxes[code]), _PERIODS[code])

    @property
    def hours_until_quota(self) -> float | None:
        """Hours of collection before the daily credits run out; None when they never do.

        Anonymous access is meant for local development only: it runs out after a few hours,
        then OpenSky answers 429 and the scheduler waits.
        """
        profile = self.profile
        if profile.credits_per_day <= self.daily_quota:
            return None
        requests = self.daily_quota // profile.credits_per_request
        return requests * profile.period_seconds / 3600

    @model_validator(mode="after")
    def _check_quota(self) -> "OpenSkySettings":
        # The guard protects the group account: a profile must always fit its daily credits.
        profile = self.profile
        if profile.credits_per_day > ACCOUNT_DAILY_CREDITS:
            raise ValueError(
                f"Collection profile {profile.code} needs {profile.credits_per_day} OpenSky "
                f"credits per day, more than the {ACCOUNT_DAILY_CREDITS} of an account"
            )
        return self


settings = OpenSkySettings()
