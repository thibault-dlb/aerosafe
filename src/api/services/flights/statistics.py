from collections.abc import Iterable, Sequence
from math import asin, cos, radians, sin, sqrt

from schemas.aircraft import ObservationPoint
from schemas.flight import FlightStatistics, TrajectoryGap

EARTH_RADIUS_KM = 6371.0088

# Two positions further apart than this are not joined: the segment is reported as missing.
# Same upper bound as the window of rules R3 to R5 (docs/business-rules.md).
MAX_GAP_SECONDS = 300.0


def great_circle_km(a: ObservationPoint, b: ObservationPoint) -> float:
    """Haversine distance between two positions, in kilometres."""
    lat1, lon1, lat2, lon2 = map(radians, (a.latitude, a.longitude, b.latitude, b.longitude))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


def mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


def maximum(values: Sequence[float]) -> float | None:
    return max(values) if values else None


class TrajectoryAnalyser:
    """Computes the statistics and missing segments of a flight from its observations."""

    def __init__(
        self, points: Iterable[ObservationPoint], max_gap_seconds: float = MAX_GAP_SECONDS
    ):
        self._points = sorted(points, key=lambda point: point.last_contact_at)
        self._max_gap = max_gap_seconds

    @property
    def positions(self) -> list[ObservationPoint]:
        """Observations that have a position, in time order."""
        return [p for p in self._points if p.latitude is not None and p.longitude is not None]

    def segments(self) -> list[tuple[ObservationPoint, ObservationPoint, float]]:
        """Consecutive pairs of positions, with the seconds between them."""
        positions = self.positions
        return [
            (a, b, (b.last_contact_at - a.last_contact_at).total_seconds())
            for a, b in zip(positions, positions[1:], strict=False)
        ]

    def gaps(self) -> list[TrajectoryGap]:
        """Segments longer than the maximum gap: the trajectory is partial there (UC-02, 2a)."""
        return [
            TrajectoryGap(start=a.last_contact_at, end=b.last_contact_at, duration_seconds=seconds)
            for a, b, seconds in self.segments()
            if seconds > self._max_gap
        ]

    def distance_km(self) -> float:
        """Length of the trajectory, without the missing segments."""
        return sum(
            great_circle_km(a, b) for a, b, seconds in self.segments() if seconds <= self._max_gap
        )

    def statistics(self) -> FlightStatistics:
        points = self._points
        duration = (
            (points[-1].last_contact_at - points[0].last_contact_at).total_seconds()
            if points
            else 0.0
        )
        altitudes = [p.altitude for p in points if p.altitude is not None]
        speeds = [p.speed for p in points if p.speed is not None]
        return FlightStatistics(
            observation_count=len(points),
            duration_seconds=duration,
            distance_km=round(self.distance_km(), 3),
            mean_altitude=mean(altitudes),
            max_altitude=maximum(altitudes),
            mean_speed=mean(speeds),
            max_speed=maximum(speeds),
        )
