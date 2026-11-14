import type { TranslationKey } from "@/i18n/fr";
import type { User } from "@/models/User";
import type { IconName } from "@/components/ui/IconSet";

export interface NavItem {
  to: string;
  label: TranslationKey;
  icon: IconName;
  /** Only a Supervisor sees it. */
  supervisor: boolean;
}

/** The pages of the application, who can see them, and which one a given address belongs to. */
export class AppNavigation {
  static readonly ITEMS: readonly NavItem[] = [
    { to: "/dashboard", label: "nav.dashboard", icon: "dashboard", supervisor: false },
    { to: "/aircraft", label: "nav.aircraft", icon: "aircraft", supervisor: false },
    { to: "/alerts", label: "nav.alerts", icon: "alert", supervisor: true },
    { to: "/rules", label: "nav.rules", icon: "rules", supervisor: true },
    { to: "/admin/accounts", label: "nav.accounts", icon: "accounts", supervisor: true },
  ];

  /** The pages every logged in user can open. */
  static common(): NavItem[] {
    return AppNavigation.ITEMS.filter((item) => !item.supervisor);
  }

  /** The supervision pages, for a Supervisor only. */
  static supervision(user: User | null): NavItem[] {
    return user?.isSupervisor ? AppNavigation.ITEMS.filter((item) => item.supervisor) : [];
  }

  /**
   * The entry of the menu that an address belongs to: an aircraft record and a flight both
   * belong to "Aircraft". Null when no entry does.
   */
  static sectionOf(pathname: string): NavItem | null {
    const path = pathname.startsWith("/flights") ? "/aircraft" : pathname;
    return (
      AppNavigation.ITEMS.find((item) => path === item.to || path.startsWith(`${item.to}/`)) ?? null
    );
  }
}
