import { useLocation } from "react-router-dom";

import { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./NotFound.module.css";

/** Longest address shown as the callsign of the lost aircraft. */
const MAX_ADDRESS = 60;

/**
 * An address that leads nowhere, told as an alert of rule R1: an aircraft whose contact was
 * lost. The track stops at the last known position and the rest of the route blinks.
 */
export default function NotFound() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { pathname } = useLocation();
  const address = pathname.length > MAX_ADDRESS ? `${pathname.slice(0, MAX_ADDRESS)}…` : pathname;
  const loggedIn = status === "authenticated";

  return (
    <main className={styles.page}>
      <div className={`${styles.lost} darkScope`}>
        <svg className={styles.scope} viewBox="0 0 400 400" role="img" aria-label={t("notFound.label")}>
          <circle className={styles.rim} cx={200} cy={200} r={190} />
          <circle className={styles.ring} cx={200} cy={200} r={47} />
          <circle className={styles.ring} cx={200} cy={200} r={95} />
          <circle className={styles.ring} cx={200} cy={200} r={142} />
          <path className={styles.cross} d="M200 10v380M10 200h380" />
          <text className={styles.big} x={200} y={232} textAnchor="middle">
            404
          </text>
          <g className={styles.beam}>
            <path d="M200 200L200 10A190 190 0 0 0 90 45Z" opacity={0.08} />
            <path d="M200 200L200 10A190 190 0 0 0 150 17Z" opacity={0.12} />
            <line x1={200} y1={200} x2={200} y2={10} />
          </g>
          <path className={styles.track} d="M62 300Q130 262 196 196" />
          <path className={styles.ghost} d="M196 196Q250 142 322 96" />
          <circle className={styles.lastPulse} cx={196} cy={196} r={9} />
          <path className={styles.last} d="M196 185l11 11-11 11-11-11z" />
          <text className={styles.tag} x={214} y={190}>
            {t("notFound.lost").toUpperCase()}
          </text>
          <text className={styles.mark} x={214} y={204}>
            {t("notFound.lastPosition").toUpperCase()}
          </text>
          <text className={styles.question} x={330} y={96}>
            ?
          </text>
        </svg>

        <div className={styles.body}>
          <span className={styles.badge}>
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 0l5 5-5 5-5-5z" />
            </svg>
            {t("notFound.badge")}
          </span>
          <p className={styles.code}>404</p>
          <h1>{t("notFound.title")}</h1>
          <p className={styles.text}>{t("notFound.text")}</p>
          <dl className={styles.facts}>
            <dt>{t("notFound.address")}</dt>
            <dd>{address}</dd>
            <dt>{t("notFound.status")}</dt>
            <dd>{t("notFound.statusValue")}</dd>
          </dl>
          <div className={styles.actions}>
            <ButtonLink to={loggedIn ? "/dashboard" : "/"}>
              <Icon name="dashboard" size={18} />
              {t(loggedIn ? "auth.forbidden.back" : "notFound.home")}
            </ButtonLink>
            <ButtonLink to="/aircraft" variant="secondary">
              <Icon name="search" size={18} />
              {t("notFound.search")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </main>
  );
}
