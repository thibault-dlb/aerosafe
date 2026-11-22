import { useTranslation } from "@/hooks/useTranslation";

/** The address adsb.fi asks to link to, with its name, wherever its data is shown (open data terms). */
const ADSBFI_HOME = "https://adsb.fi";

/** The credits of the data in the footer: OpenSky, adsb.fi with a link to its home page, and the base map. */
export default function DataCredits() {
  const { t } = useTranslation();
  return (
    <p>
      {t("footer.data")}{" "}
      <a href={ADSBFI_HOME} target="_blank" rel="noreferrer">
        adsb.fi
      </a>
      {t("footer.map")}
    </p>
  );
}
