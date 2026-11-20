from pydantic import Field, model_validator

from config.base import CustomBaseSettings
from services.collection.adsbfi_client import MIN_SECONDS_BETWEEN_REQUESTS
from services.collection.profiles import Circle, CollectionProfile, ProfileCode

# The largest radius the open data API accepts, in nautical miles.
MAX_RADIUS_NM = 250


class AdsbFiSettings(CustomBaseSettings):
    """adsb.fi access and collection, read once at start-up.

    adsb.fi needs no account: the only limit is one request per second from an address, so
    the period only has to leave room for it.
    """

    # Off by default, like the OpenSky collection: each instance chooses what it collects.
    COLLECTION_ADSBFI_ENABLED: bool = False
    ADSBFI_API_URL: str = "https://opendata.adsb.fi/api"
    # Centre of the circle, `lat,lon`: the middle of the Île-de-France box of OpenSky.
    ADSBFI_CENTER: str = "48.65,2.5"
    ADSBFI_RADIUS_NM: int = Field(default=MAX_RADIUS_NM, gt=0, le=MAX_RADIUS_NM)
    ADSBFI_PERIOD_SECONDS: int = Field(default=5, ge=2)
    ADSBFI_TIMEOUT_SECONDS: float = Field(default=4.0, gt=0)
    # Days of adsb.fi observations kept; older ones are deleted every hour. 0 keeps everything.
    ADSBFI_RETENTION_DAYS: int = Field(default=7, ge=0)

    @property
    def area(self) -> Circle:
        return Circle.parse(self.ADSBFI_CENTER, self.ADSBFI_RADIUS_NM)

    @property
    def profile(self) -> CollectionProfile:
        return CollectionProfile(ProfileCode.ADSBFI_250NM, self.area, self.ADSBFI_PERIOD_SECONDS)

    @model_validator(mode="after")
    def _check(self) -> "AdsbFiSettings":
        self.area  # noqa: B018 - refuses an unreadable centre at start-up.
        # A request that outlives the period would delay the next cycle, which is skipped.
        if self.ADSBFI_TIMEOUT_SECONDS >= self.ADSBFI_PERIOD_SECONDS:
            raise ValueError("ADSBFI_TIMEOUT_SECONDS must be shorter than ADSBFI_PERIOD_SECONDS")
        if self.ADSBFI_PERIOD_SECONDS < 2 * MIN_SECONDS_BETWEEN_REQUESTS:
            raise ValueError("ADSBFI_PERIOD_SECONDS leaves no room for the rate limit")
        return self


settings = AdsbFiSettings()
