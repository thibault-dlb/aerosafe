import type { ReactNode } from "react";

import styles from "./AircraftBanner.module.css";

export interface AircraftBannerProps {
  /** The name of the aircraft or of the flight, large, in the data font. It is the heading of the page. */
  title: string;
  subtitle?: ReactNode;
  /** The states of the item: in the air, an alert in progress. */
  badges?: ReactNode;
  /** A line under the title, such as the route of a flight. */
  route?: ReactNode;
  /** The figures, as `StatTile`s. */
  children?: ReactNode;
}

/** The identity of an aircraft or a flight at the top of its page, with its main figures. */
export default function AircraftBanner({ title, subtitle, badges, route, children }: AircraftBannerProps) {
  return (
    <header className={styles.banner}>
      <div className={styles.id}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {badges && <div className={styles.badges}>{badges}</div>}
      {route && <div className={styles.route}>{route}</div>}
      {children && <div className={styles.tiles}>{children}</div>}
    </header>
  );
}
