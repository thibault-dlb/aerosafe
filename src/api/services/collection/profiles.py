from dataclasses import dataclass

SECONDS_PER_DAY = 86_400

# OpenSky credit cost of one /states/all request, by area in square degrees (upper bound, cost).
_CREDIT_GRID: tuple[tuple[float, int], ...] = ((25, 1), (100, 2), (400, 3))
_CREDITS_OVER_GRID = 4


@dataclass(frozen=True)
class BoundingBox:
    """Area requested from OpenSky, in WGS 84 degrees."""

    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float

    def __post_init__(self) -> None:
        if not -90 <= self.lat_min < self.lat_max <= 90:
            raise ValueError(f"Invalid latitude range: {self.lat_min} to {self.lat_max}")
        if not -180 <= self.lon_min < self.lon_max <= 180:
            raise ValueError(f"Invalid longitude range: {self.lon_min} to {self.lon_max}")

    @classmethod
    def parse(cls, value: str) -> "BoundingBox":
        """Read `lat_min,lat_max,lon_min,lon_max`, the format of the environment variables."""
        parts = [part.strip() for part in value.split(",")]
        if len(parts) != 4:
            raise ValueError(f"A bounding box needs 4 numbers, got {value!r}")
        lat_min, lat_max, lon_min, lon_max = (float(part) for part in parts)
        return cls(lat_min, lat_max, lon_min, lon_max)

    @property
    def area(self) -> float:
        """Area in square degrees, as OpenSky counts it."""
        return (self.lat_max - self.lat_min) * (self.lon_max - self.lon_min)

    def credits_per_request(self) -> int:
        for upper_bound, credits in _CREDIT_GRID:
            if self.area <= upper_bound:
                return credits
        return _CREDITS_OVER_GRID

    def as_query(self) -> dict[str, float]:
        """Query parameters of /states/all."""
        return {
            "lamin": self.lat_min,
            "lamax": self.lat_max,
            "lomin": self.lon_min,
            "lomax": self.lon_max,
        }


class ProfileCode:
    """Stable codes of the collection profiles (D-05)."""

    ILE_DE_FRANCE = "ILE_DE_FRANCE"
    FRANCE = "FRANCE"


@dataclass(frozen=True)
class CollectionProfile:
    """One collection profile: an area and the period between two collections."""

    code: str
    bounding_box: BoundingBox
    period_seconds: int

    def __post_init__(self) -> None:
        if self.period_seconds <= 0:
            raise ValueError("The collection period must be positive")

    @property
    def credits_per_request(self) -> int:
        return self.bounding_box.credits_per_request()

    @property
    def requests_per_day(self) -> int:
        return SECONDS_PER_DAY // self.period_seconds

    @property
    def credits_per_day(self) -> int:
        return self.requests_per_day * self.credits_per_request
