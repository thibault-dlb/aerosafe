from services.rules.base import BusinessRule
from services.rules.delay import LastContactRule, StalePositionRule
from services.rules.rates import AltitudeRateRule, HeadingRateRule, SpeedRateRule


class RuleRegistry:
    """Maps the code of a rule stored in `REGLE` to the class that evaluates it.

    Adding a rule means writing its class and registering it here: no existing rule changes
    (NF-06). A stored code without a class is skipped by the engine.
    """

    def __init__(self, rules: list[BusinessRule] | None = None) -> None:
        defaults = [
            LastContactRule(),
            StalePositionRule(),
            AltitudeRateRule(),
            SpeedRateRule(),
            HeadingRateRule(),
        ]
        self._rules = {rule.code: rule for rule in (rules if rules is not None else defaults)}

    def get(self, code: str) -> BusinessRule | None:
        return self._rules.get(code)

    @property
    def codes(self) -> list[str]:
        return sorted(self._rules)
