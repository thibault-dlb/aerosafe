import pytest
from pydantic import ValidationError

from config.opensky import ACCOUNT_DAILY_CREDITS, ANONYMOUS_DAILY_CREDITS, OpenSkySettings
from services.collection.profiles import BoundingBox, CollectionProfile, ProfileCode


def make_settings(**values: object) -> OpenSkySettings:
    return OpenSkySettings(_env_file=None, **values)


@pytest.mark.parametrize(
    ("box", "credits"),
    [
        (BoundingBox(0, 5, 0, 5), 1),  # 25 sq°, upper bound included
        (BoundingBox(0, 5, 0, 5.2), 2),
        (BoundingBox(0, 10, 0, 10), 2),
        (BoundingBox(0, 20, 0, 20), 3),
        (BoundingBox(0, 20, 0, 21), 4),
    ],
)
def test_the_credit_cost_follows_the_opensky_grid(box: BoundingBox, credits: int) -> None:
    assert box.credits_per_request() == credits


def test_a_bounding_box_is_parsed_from_the_environment_format() -> None:
    box = BoundingBox.parse(" 48.0, 49.3,1.4 ,3.6")

    assert box == BoundingBox(48.0, 49.3, 1.4, 3.6)
    assert box.as_query() == {"lamin": 48.0, "lamax": 49.3, "lomin": 1.4, "lomax": 3.6}


@pytest.mark.parametrize("value", ["1,2,3", "49,48,1,2", "1,2,3,200", "a,b,c,d"])
def test_an_invalid_bounding_box_is_refused(value: str) -> None:
    with pytest.raises(ValueError):
        BoundingBox.parse(value)


def test_a_profile_needs_a_positive_period() -> None:
    with pytest.raises(ValueError):
        CollectionProfile(ProfileCode.FRANCE, BoundingBox(0, 1, 0, 1), 0)


def test_the_default_profiles_match_the_architecture() -> None:
    ile_de_france = make_settings().profile
    france = make_settings(COLLECTION_PROFILE="FRANCE").profile

    assert (ile_de_france.period_seconds, ile_de_france.credits_per_day) == (30, 2_880)
    assert (france.period_seconds, france.credits_per_day) == (120, 2_160)


def test_collection_is_off_and_anonymous_by_default() -> None:
    settings = make_settings()

    assert settings.COLLECTION_ENABLED is False
    assert settings.has_credentials is False
    assert settings.daily_quota == ANONYMOUS_DAILY_CREDITS


def test_credentials_give_the_account_quota() -> None:
    settings = make_settings(OPENSKY_CLIENT_ID="group", OPENSKY_CLIENT_SECRET="secret")

    assert settings.daily_quota == ACCOUNT_DAILY_CREDITS
    assert settings.hours_until_quota is None


def test_anonymous_access_runs_out_after_a_few_hours() -> None:
    # 400 requests of 1 credit, one every 30 s.
    assert make_settings().hours_until_quota == pytest.approx(400 * 30 / 3600)


def test_a_profile_over_the_account_quota_is_refused() -> None:
    # 30 sq° costs 2 credits, so 5 760 credits a day every 30 s.
    with pytest.raises(ValidationError, match="credits per day"):
        make_settings(COLLECTION_BBOX_ILE_DE_FRANCE="45,51,0,5")
