import math
from dataclasses import dataclass

SECONDS_PER_DAY = 86_400

# Mean radius of the Earth (IUGG), and the length of a degree of latitude on it.
EARTH_RADIUS_KM = 6_371.0088
KM_PER_DEGREE = math.pi * EARTH_RADIUS_KM / 180
KM_PER_NAUTICAL_MILE = 1.852

# OpenSky credit cost of one /states/all request, by area in square degrees (upper bound, cost).
_CREDIT_GRID: tuple[tuple[float, int], ...] = ((25, 1), (100, 2), (400, 3))
_CREDITS_OVER_GRID = 4


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points (haversine), in kilometres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


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

    def bounds(self) -> "BoundingBox":
        """The rectangle that holds the area: the box itself."""
        return self

    def contains(self, latitude: float, longitude: float) -> bool:
        return (
            self.lat_min <= latitude <= self.lat_max and self.lon_min <= longitude <= self.lon_max
        )

    def distance_to_edge_km(self, latitude: float, longitude: float) -> float:
        """Distance from a point to the nearest side of the box, 0 on or outside it.

        The sides run along a meridian or a parallel, so a degree of longitude is shortened by
        the cosine of the latitude; the error is negligible at the size of a collection area.
        """
        if not self.contains(latitude, longitude):
            return 0.0
        km_per_degree_of_longitude = KM_PER_DEGREE * math.cos(math.radians(latitude))
        return min(
            (latitude - self.lat_min) * KM_PER_DEGREE,
            (self.lat_max - latitude) * KM_PER_DEGREE,
            (longitude - self.lon_min) * km_per_degree_of_longitude,
            (self.lon_max - longitude) * km_per_degree_of_longitude,
        )


@dataclass(frozen=True)
class Circle:
    """Area requested from adsb.fi: a centre in WGS 84 degrees and a radius in nautical miles."""

    latitude: float
    longitude: float
    radius_nm: float

    def __post_init__(self) -> None:
        if not -90 <= self.latitude <= 90 or not -180 <= self.longitude <= 180:
            raise ValueError(f"Invalid centre: {self.latitude}, {self.longitude}")
        if not self.radius_nm > 0:
            raise ValueError(f"The radius must be positive, got {self.radius_nm}")

    @classmethod
    def parse(cls, centre: str, radius_nm: float) -> "Circle":
        """Read the centre as `lat,lon`, the format of the environment variable."""
        parts = [part.strip() for part in centre.split(",")]
        if len(parts) != 2:
            raise ValueError(f"A centre needs 2 numbers, got {centre!r}")
        latitude, longitude = (float(part) for part in parts)
        return cls(latitude, longitude, radius_nm)

    @property
    def radius_km(self) -> float:
        return self.radius_nm * KM_PER_NAUTICAL_MILE

    def bounds(self) -> BoundingBox:
        """The rectangle that holds the circle, cut at the poles and at the antimeridian."""
        lat_span = self.radius_km / KM_PER_DEGREE
        lat_min = max(-90.0, self.latitude - lat_span)
        lat_max = min(90.0, self.latitude + lat_span)
        # The circle is widest along the parallel nearest a pole that it reaches.
        widest = max(abs(lat_min), abs(lat_max))
        cosine = math.cos(math.radians(widest))
        lon_span = 180.0 if cosine < 1e-9 else min(180.0, self.radius_km / (KM_PER_DEGREE * cosine))
        return BoundingBox(
            lat_min,
            lat_max,
            max(-180.0, self.longitude - lon_span),
            min(180.0, self.longitude + lon_span),
        )

    def contains(self, latitude: float, longitude: float) -> bool:
        return distance_km(self.latitude, self.longitude, latitude, longitude) <= self.radius_km

    def distance_to_edge_km(self, latitude: float, longitude: float) -> float:
        """Distance from a point to the circle, 0 on or outside it."""
        from_centre = distance_km(self.latitude, self.longitude, latitude, longitude)
        return max(0.0, self.radius_km - from_centre)


# The area a live source covers: a box for OpenSky, a circle for adsb.fi.
CoverageArea = BoundingBox | Circle


class ProfileCode:
    """Stable codes of the collection profiles (D-05)."""

    ILE_DE_FRANCE = "ILE_DE_FRANCE"
    FRANCE = "FRANCE"
    ADSBFI_250NM = "ADSBFI_250NM"


@dataclass(frozen=True)
class CollectionProfile:
    """One collection profile: an area and the period between two collections."""

    code: str
    area: CoverageArea
    period_seconds: int

    def __post_init__(self) -> None:
        if self.period_seconds <= 0:
            raise ValueError("The collection period must be positive")

    @property
    def bounding_box(self) -> BoundingBox:
        """The rectangle that holds the area, the one the map shows."""
        return self.area.bounds()

    @property
    def credits_per_request(self) -> int:
        """OpenSky credits of one request; adsb.fi has no credits."""
        if isinstance(self.area, BoundingBox):
            return self.area.credits_per_request()
        return 0

    @property
    def requests_per_day(self) -> int:
        return SECONDS_PER_DAY // self.period_seconds

    @property
    def credits_per_day(self) -> int:
        return self.requests_per_day * self.credits_per_request
