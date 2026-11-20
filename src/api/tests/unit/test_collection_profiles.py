import pytest

from services.collection.profiles import (
    KM_PER_DEGREE,
    BoundingBox,
    Circle,
    CollectionProfile,
    ProfileCode,
    distance_km,
)

ILE_DE_FRANCE = BoundingBox(48.0, 49.3, 1.4, 3.6)
PARIS = Circle(48.65, 2.5, 250)


def test_the_distance_between_paris_and_london_is_about_344_km() -> None:
    assert distance_km(48.8566, 2.3522, 51.5074, -0.1278) == pytest.approx(344, abs=2)


def test_a_point_is_at_no_distance_from_itself() -> None:
    assert distance_km(48.65, 2.5, 48.65, 2.5) == 0


class TestBoundingBox:
    def test_a_box_contains_its_inside_and_its_sides(self) -> None:
        assert ILE_DE_FRANCE.contains(48.65, 2.5)
        assert ILE_DE_FRANCE.contains(48.0, 1.4)
        assert not ILE_DE_FRANCE.contains(47.99, 2.5)
        assert not ILE_DE_FRANCE.contains(48.65, 3.61)

    def test_the_distance_to_the_edge_is_the_one_to_the_nearest_side(self) -> None:
        # 0.1 degree north of the southern side, far from the others.
        assert ILE_DE_FRANCE.distance_to_edge_km(48.1, 2.5) == pytest.approx(0.1 * KM_PER_DEGREE)

    def test_a_degree_of_longitude_is_shorter_than_a_degree_of_latitude(self) -> None:
        # 0.1 degree east of the western side, at the middle latitude.
        distance = ILE_DE_FRANCE.distance_to_edge_km(48.65, 1.5)

        assert distance == pytest.approx(0.1 * KM_PER_DEGREE * 0.6607, rel=1e-3)

    def test_a_point_outside_the_box_is_on_its_edge(self) -> None:
        assert ILE_DE_FRANCE.distance_to_edge_km(50.0, 2.5) == 0

    def test_a_box_is_its_own_bounds(self) -> None:
        assert ILE_DE_FRANCE.bounds() is ILE_DE_FRANCE


class TestCircle:
    def test_a_circle_is_read_from_its_centre_and_radius(self) -> None:
        assert Circle.parse(" 48.65 , 2.5 ", 250) == PARIS

    @pytest.mark.parametrize("centre", ["48.65", "48.65,2.5,1", "north,east"])
    def test_an_invalid_centre_is_refused(self, centre: str) -> None:
        with pytest.raises(ValueError):
            Circle.parse(centre, 250)

    @pytest.mark.parametrize(
        ("latitude", "longitude", "radius"), [(91, 0, 10), (0, 181, 10), (0, 0, 0), (0, 0, -1)]
    )
    def test_a_circle_out_of_range_is_refused(
        self, latitude: float, longitude: float, radius: float
    ) -> None:
        with pytest.raises(ValueError):
            Circle(latitude, longitude, radius)

    def test_the_radius_is_converted_from_nautical_miles(self) -> None:
        assert PARIS.radius_km == pytest.approx(463)

    def test_a_circle_contains_the_points_within_its_radius(self) -> None:
        assert PARIS.contains(48.8566, 2.3522)  # Paris
        assert PARIS.contains(51.5074, -0.1278)  # London, 344 km from the centre
        assert not PARIS.contains(43.6047, 1.4442)  # Toulouse, about 570 km

    def test_the_distance_to_the_edge_is_the_radius_left(self) -> None:
        assert PARIS.distance_to_edge_km(48.65, 2.5) == pytest.approx(463)
        assert PARIS.distance_to_edge_km(43.6047, 1.4442) == 0

    def test_the_bounds_hold_the_whole_circle(self) -> None:
        bounds = PARIS.bounds()

        assert bounds.lat_min == pytest.approx(48.65 - 463 / KM_PER_DEGREE)
        assert bounds.lat_max == pytest.approx(48.65 + 463 / KM_PER_DEGREE)
        # The four points of the circle on its axes are inside the bounds.
        for latitude, longitude in [(52.81, 2.5), (44.49, 2.5), (48.65, 8.8), (48.65, -3.8)]:
            assert bounds.contains(latitude, longitude)

    def test_the_bounds_stop_at_the_pole_and_the_antimeridian(self) -> None:
        bounds = Circle(89.0, 179.0, 250).bounds()

        assert bounds.lat_max == 90
        assert (bounds.lon_min, bounds.lon_max) == (-1.0, 180)

    def test_a_circle_around_a_pole_spans_every_longitude(self) -> None:
        bounds = Circle(90.0, 0.0, 10).bounds()

        assert (bounds.lon_min, bounds.lon_max) == (-180, 180)


class TestProfile:
    def test_an_opensky_profile_costs_credits(self) -> None:
        profile = CollectionProfile(ProfileCode.ILE_DE_FRANCE, ILE_DE_FRANCE, 30)

        assert profile.credits_per_request == 1
        assert profile.credits_per_day == 2_880
        assert profile.bounding_box is ILE_DE_FRANCE

    def test_an_adsbfi_profile_costs_no_credit(self) -> None:
        profile = CollectionProfile(ProfileCode.ADSBFI_250NM, PARIS, 5)

        assert profile.credits_per_request == 0
        assert profile.credits_per_day == 0
        assert profile.requests_per_day == 17_280
        assert profile.bounding_box == PARIS.bounds()
