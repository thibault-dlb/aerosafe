import Icon from "./Icon";
import type { IconName } from "./IconSet";

export interface RuleIconProps {
  /** The code of the rule, `R1` to `R5`. A rule added later gets the generic rules icon. */
  code: string;
  size?: number | string;
  className?: string;
}

const ICONS: Record<string, IconName> = {
  R1: "ruleR1",
  R2: "ruleR2",
  R3: "ruleR3",
  R4: "ruleR4",
  R5: "ruleR5",
};

/** The pictogram of a business rule: the engine can hold more rules than the interface draws (NF-06). */
export default function RuleIcon({ code, size, className }: RuleIconProps) {
  return <Icon name={ICONS[code] ?? "rules"} size={size} className={className} />;
}
