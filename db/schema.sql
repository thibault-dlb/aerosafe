-- AeroSafe database schema (PostgreSQL 17 + PostGIS)
-- Draft for team review. See docs/data-model.md.
-- Follows docs/database-conventions.md and the team decisions of 2026-11-03 (docs/team-decisions).
-- Once validated it becomes Alembic migrations: one change per migration, each with its down,
-- and the reference data in a separate migration.

-- Needs a superuser: src/api/docker/init-db.sh creates it first, so this line changes nothing there.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Keeps updated_at current on every business table (conventions §8).
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

CREATE TABLE R_ROLE (
    ID        SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CD_ROLE   TEXT     NOT NULL UNIQUE,
    LB_ROLE   TEXT     NOT NULL,
    is_active BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE TABLE R_CRITICITE (
    ID           SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CD_CRITICITE TEXT     NOT NULL UNIQUE,
    LB_CRITICITE TEXT     NOT NULL,
    is_active    BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE TABLE R_UNITE (
    ID        SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CD_UNITE  TEXT     NOT NULL UNIQUE,
    LB_UNITE  TEXT     NOT NULL,
    is_active BOOLEAN  NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Business tables
-- ---------------------------------------------------------------------------

CREATE TABLE AERONEF (
    ID                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CD_ICAO24          TEXT        NOT NULL UNIQUE CHECK (CD_ICAO24 ~ '^[0-9a-f]{6}$'),
    LB_IMMATRICULATION TEXT        NULL,
    LB_MODELE          TEXT        NULL,
    LB_COMPAGNIE       TEXT        NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ NULL
);

CREATE TABLE VOL (
    ID             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ID_AERONEF     BIGINT      NOT NULL REFERENCES AERONEF (ID) ON DELETE RESTRICT,
    LB_INDICATIF   TEXT        NULL,
    DT_DEBUT       TIMESTAMPTZ NOT NULL,
    DT_FIN         TIMESTAMPTZ NULL,
    CD_ORIGINE     TEXT        NULL,
    CD_DESTINATION TEXT        NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ NULL,
    CHECK (DT_FIN IS NULL OR DT_FIN > DT_DEBUT)
);

CREATE TABLE OBSERVATION (
    ID                 BIGINT                GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ID_AERONEF         BIGINT                NOT NULL REFERENCES AERONEF (ID) ON DELETE RESTRICT,
    ID_VOL             BIGINT                NULL     REFERENCES VOL (ID) ON DELETE RESTRICT,
    DT_DERNIER_CONTACT TIMESTAMPTZ           NOT NULL,
    DT_POSITION        TIMESTAMPTZ           NULL,
    GEO_POSITION       geometry(Point, 4326) NULL,
    NB_ALTITUDE        NUMERIC(7, 1)         NULL,
    NB_VITESSE         NUMERIC(6, 2)         NULL CHECK (NB_VITESSE >= 0),
    NB_CAP             NUMERIC(5, 2)         NULL CHECK (NB_CAP >= 0 AND NB_CAP < 360),
    BL_AU_SOL          BOOLEAN               NOT NULL,
    created_at         TIMESTAMPTZ           NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ           NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ           NULL,
    -- The same OpenSky state vector is never stored twice.
    UNIQUE (ID_AERONEF, DT_DERNIER_CONTACT),
    CHECK (DT_POSITION IS NULL OR DT_POSITION <= DT_DERNIER_CONTACT)
);

CREATE TABLE REGLE (
    ID             BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CD_REGLE       TEXT           NOT NULL UNIQUE,
    LB_DESCRIPTION TEXT           NOT NULL,
    NB_SEUIL       NUMERIC(10, 3) NOT NULL CHECK (NB_SEUIL >= 0),
    ID_UNITE       SMALLINT       NOT NULL REFERENCES R_UNITE (ID) ON DELETE RESTRICT,
    ID_CRITICITE   SMALLINT       NULL     REFERENCES R_CRITICITE (ID) ON DELETE RESTRICT,
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ    NULL
);

CREATE TABLE UTILISATEUR (
    ID                   BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    LN_EMAIL             TEXT        NOT NULL UNIQUE,
    LB_HASH_MOT_DE_PASSE TEXT        NULL,
    ID_ROLE              SMALLINT    NOT NULL REFERENCES R_ROLE (ID) ON DELETE RESTRICT,
    DT_ANONYMISATION     TIMESTAMPTZ NULL,
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ NULL,
    -- Only an anonymised account may lose its password hash.
    CHECK (LB_HASH_MOT_DE_PASSE IS NOT NULL OR DT_ANONYMISATION IS NOT NULL)
);

CREATE TABLE ALERTE (
    ID                        BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ID_AERONEF                BIGINT         NOT NULL REFERENCES AERONEF (ID) ON DELETE RESTRICT,
    ID_REGLE                  BIGINT         NOT NULL REFERENCES REGLE (ID) ON DELETE RESTRICT,
    DT_DECLENCHEMENT          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    NB_VALEUR_OBSERVEE        NUMERIC(12, 3) NULL,
    NB_SEUIL                  NUMERIC(10, 3) NULL,
    LB_MESSAGE                TEXT           NOT NULL,
    ID_CRITICITE              SMALLINT       NULL REFERENCES R_CRITICITE (ID) ON DELETE RESTRICT,
    DT_TRAITEMENT             TIMESTAMPTZ    NULL,
    ID_UTILISATEUR_TRAITEMENT BIGINT         NULL REFERENCES UTILISATEUR (ID) ON DELETE RESTRICT,
    created_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ    NULL,
    -- A processed alert always records who processed it, and only then.
    CHECK ((DT_TRAITEMENT IS NULL) = (ID_UTILISATEUR_TRAITEMENT IS NULL))
);

CREATE TABLE JETON_RAFRAICHISSEMENT (
    ID             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ID_UTILISATEUR BIGINT      NOT NULL REFERENCES UTILISATEUR (ID) ON DELETE RESTRICT,
    CD_HASH_JETON  TEXT        NOT NULL UNIQUE,
    DT_EXPIRATION  TIMESTAMPTZ NOT NULL,
    DT_REVOCATION  TIMESTAMPTZ NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_aeronef_updated_at     BEFORE UPDATE ON AERONEF     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vol_updated_at         BEFORE UPDATE ON VOL         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_observation_updated_at BEFORE UPDATE ON OBSERVATION FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_regle_updated_at       BEFORE UPDATE ON REGLE       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_utilisateur_updated_at BEFORE UPDATE ON UTILISATEUR FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_alerte_updated_at      BEFORE UPDATE ON ALERTE      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jeton_updated_at       BEFORE UPDATE ON JETON_RAFRAICHISSEMENT FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes. Every foreign key is indexed, except where a UNIQUE or composite
-- index already starts with it (leftmost column rule).
-- ---------------------------------------------------------------------------

CREATE INDEX idx_vol_aeronef            ON VOL (ID_AERONEF, DT_DEBUT);
CREATE INDEX idx_observation_vol        ON OBSERVATION (ID_VOL, DT_POSITION);   -- trajectory of a flight
CREATE INDEX idx_observation_contact    ON OBSERVATION (DT_DERNIER_CONTACT);    -- latest observations for the engine
CREATE INDEX idx_observation_position   ON OBSERVATION USING GIST (GEO_POSITION); -- area search (UC-01)
CREATE INDEX idx_aeronef_immatriculation ON AERONEF (LB_IMMATRICULATION);
CREATE INDEX idx_aeronef_compagnie      ON AERONEF (LB_COMPAGNIE);
CREATE INDEX idx_regle_unite            ON REGLE (ID_UNITE);
CREATE INDEX idx_regle_criticite        ON REGLE (ID_CRITICITE);
CREATE INDEX idx_utilisateur_role       ON UTILISATEUR (ID_ROLE);
CREATE INDEX idx_alerte_aeronef         ON ALERTE (ID_AERONEF);
CREATE INDEX idx_alerte_regle           ON ALERTE (ID_REGLE);
CREATE INDEX idx_alerte_criticite       ON ALERTE (ID_CRITICITE);
CREATE INDEX idx_alerte_utilisateur     ON ALERTE (ID_UTILISATEUR_TRAITEMENT);
CREATE INDEX idx_alerte_declenchement   ON ALERTE (DT_DECLENCHEMENT);
CREATE INDEX idx_jeton_utilisateur      ON JETON_RAFRAICHISSEMENT (ID_UTILISATEUR);

-- ---------------------------------------------------------------------------
-- Comments (French, every table and column, conventions §13)
-- ---------------------------------------------------------------------------

COMMENT ON TABLE R_ROLE IS 'Référentiel des rôles applicatifs (Utilisateur, Superviseur).';
COMMENT ON COLUMN R_ROLE.ID IS 'Identifiant technique du rôle.';
COMMENT ON COLUMN R_ROLE.CD_ROLE IS 'Code stable du rôle, utilisé par l''API pour les contrôles d''accès.';
COMMENT ON COLUMN R_ROLE.LB_ROLE IS 'Libellé du rôle affiché à l''écran.';
COMMENT ON COLUMN R_ROLE.is_active IS 'Indique si le rôle peut encore être attribué.';

COMMENT ON TABLE R_CRITICITE IS 'Référentiel des niveaux de criticité des alertes (basse, moyenne, haute).';
COMMENT ON COLUMN R_CRITICITE.ID IS 'Identifiant technique du niveau de criticité.';
COMMENT ON COLUMN R_CRITICITE.CD_CRITICITE IS 'Code stable du niveau de criticité.';
COMMENT ON COLUMN R_CRITICITE.LB_CRITICITE IS 'Libellé du niveau de criticité affiché à l''écran.';
COMMENT ON COLUMN R_CRITICITE.is_active IS 'Indique si le niveau peut encore être utilisé.';

COMMENT ON TABLE R_UNITE IS 'Référentiel des unités dans lesquelles sont exprimés les seuils des règles.';
COMMENT ON COLUMN R_UNITE.ID IS 'Identifiant technique de l''unité.';
COMMENT ON COLUMN R_UNITE.CD_UNITE IS 'Symbole de l''unité (s, m/s, m/s², °/s).';
COMMENT ON COLUMN R_UNITE.LB_UNITE IS 'Libellé complet de l''unité.';
COMMENT ON COLUMN R_UNITE.is_active IS 'Indique si l''unité peut encore être utilisée.';

COMMENT ON TABLE AERONEF IS 'Aéronef suivi, créé par le collecteur OpenSky à la première observation de son code ICAO24.';
COMMENT ON COLUMN AERONEF.ID IS 'Identifiant technique de l''aéronef.';
COMMENT ON COLUMN AERONEF.CD_ICAO24 IS 'Adresse ICAO24 du transpondeur, 6 caractères hexadécimaux en minuscules (clé métier).';
COMMENT ON COLUMN AERONEF.LB_IMMATRICULATION IS 'Immatriculation de l''aéronef, si connue.';
COMMENT ON COLUMN AERONEF.LB_MODELE IS 'Modèle de l''aéronef, si connu.';
COMMENT ON COLUMN AERONEF.LB_COMPAGNIE IS 'Compagnie exploitant l''aéronef, si connue.';
COMMENT ON COLUMN AERONEF.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN AERONEF.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN AERONEF.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE VOL IS 'Vol d''un aéronef : observations successives séparées d''au plus N minutes (D-06).';
COMMENT ON COLUMN VOL.ID IS 'Identifiant technique du vol.';
COMMENT ON COLUMN VOL.ID_AERONEF IS 'Aéronef qui effectue le vol.';
COMMENT ON COLUMN VOL.LB_INDICATIF IS 'Indicatif d''appel radio du vol (callsign OpenSky), si connu.';
COMMENT ON COLUMN VOL.DT_DEBUT IS 'Date et heure de la première observation du vol.';
COMMENT ON COLUMN VOL.DT_FIN IS 'Date et heure de la dernière observation du vol ; NULL tant que le vol est en cours.';
COMMENT ON COLUMN VOL.CD_ORIGINE IS 'Code de l''aéroport de départ, si connu.';
COMMENT ON COLUMN VOL.CD_DESTINATION IS 'Code de l''aéroport d''arrivée, si connu.';
COMMENT ON COLUMN VOL.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN VOL.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN VOL.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE OBSERVATION IS 'Vecteur d''état d''un aéronef reçu d''OpenSky, nettoyé puis stocké par le collecteur.';
COMMENT ON COLUMN OBSERVATION.ID IS 'Identifiant technique de l''observation.';
COMMENT ON COLUMN OBSERVATION.ID_AERONEF IS 'Aéronef observé.';
COMMENT ON COLUMN OBSERVATION.ID_VOL IS 'Vol auquel l''observation est rattachée ; NULL si elle n''appartient à aucun vol.';
COMMENT ON COLUMN OBSERVATION.DT_DERNIER_CONTACT IS 'Date du dernier message reçu de l''aéronef (last_contact OpenSky), utilisée par R1.';
COMMENT ON COLUMN OBSERVATION.DT_POSITION IS 'Date de la dernière position connue (time_position OpenSky), utilisée par R2 ; NULL sans position.';
COMMENT ON COLUMN OBSERVATION.GEO_POSITION IS 'Position géographique (point PostGIS, WGS 84) ; NULL sans position.';
COMMENT ON COLUMN OBSERVATION.NB_ALTITUDE IS 'Altitude en mètres.';
COMMENT ON COLUMN OBSERVATION.NB_VITESSE IS 'Vitesse sol en mètres par seconde.';
COMMENT ON COLUMN OBSERVATION.NB_CAP IS 'Cap vrai en degrés, de 0 inclus à 360 exclu.';
COMMENT ON COLUMN OBSERVATION.BL_AU_SOL IS 'Vrai si l''aéronef est au sol (on_ground OpenSky) ; les règles ne portent que sur les aéronefs en vol.';
COMMENT ON COLUMN OBSERVATION.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN OBSERVATION.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN OBSERVATION.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE REGLE IS 'Règle métier évaluée par le moteur ; le Superviseur peut modifier son seuil (UC-05).';
COMMENT ON COLUMN REGLE.ID IS 'Identifiant technique de la règle.';
COMMENT ON COLUMN REGLE.CD_REGLE IS 'Code de la règle (R1, R2, ...), libre pour permettre d''en ajouter (NF-06).';
COMMENT ON COLUMN REGLE.LB_DESCRIPTION IS 'Description de la situation inhabituelle détectée.';
COMMENT ON COLUMN REGLE.NB_SEUIL IS 'Seuil de déclenchement, exprimé dans l''unité de la règle.';
COMMENT ON COLUMN REGLE.ID_UNITE IS 'Unité du seuil.';
COMMENT ON COLUMN REGLE.ID_CRITICITE IS 'Criticité par défaut recopiée dans les alertes de la règle ; NULL si aucune.';
COMMENT ON COLUMN REGLE.is_active IS 'Indique si la règle est évaluée par le moteur.';
COMMENT ON COLUMN REGLE.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN REGLE.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN REGLE.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE UTILISATEUR IS 'Compte applicatif, créé à l''inscription ; anonymisé sur demande, jamais supprimé.';
COMMENT ON COLUMN UTILISATEUR.ID IS 'Identifiant technique de l''utilisateur.';
COMMENT ON COLUMN UTILISATEUR.LN_EMAIL IS 'Adresse e-mail de connexion, unique ; remplacée par une valeur neutre à l''anonymisation.';
COMMENT ON COLUMN UTILISATEUR.LB_HASH_MOT_DE_PASSE IS 'Empreinte argon2id du mot de passe ; NULL seulement après anonymisation.';
COMMENT ON COLUMN UTILISATEUR.ID_ROLE IS 'Rôle de l''utilisateur.';
COMMENT ON COLUMN UTILISATEUR.DT_ANONYMISATION IS 'Date d''anonymisation du compte ; NULL si le compte n''est pas anonymisé.';
COMMENT ON COLUMN UTILISATEUR.is_active IS 'Indique si le compte peut se connecter.';
COMMENT ON COLUMN UTILISATEUR.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN UTILISATEUR.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN UTILISATEUR.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE ALERTE IS 'Alerte générée par le moteur quand une règle se déclenche pour un aéronef.';
COMMENT ON COLUMN ALERTE.ID IS 'Identifiant technique de l''alerte.';
COMMENT ON COLUMN ALERTE.ID_AERONEF IS 'Aéronef concerné.';
COMMENT ON COLUMN ALERTE.ID_REGLE IS 'Règle déclenchée.';
COMMENT ON COLUMN ALERTE.DT_DECLENCHEMENT IS 'Date et heure du déclenchement.';
COMMENT ON COLUMN ALERTE.NB_VALEUR_OBSERVEE IS 'Valeur mesurée qui a dépassé le seuil, dans l''unité de la règle.';
COMMENT ON COLUMN ALERTE.NB_SEUIL IS 'Seuil en vigueur au déclenchement, recopié pour que l''alerte reste explicable.';
COMMENT ON COLUMN ALERTE.LB_MESSAGE IS 'Message explicatif de l''alerte.';
COMMENT ON COLUMN ALERTE.ID_CRITICITE IS 'Criticité de l''alerte ; NULL si aucune.';
COMMENT ON COLUMN ALERTE.DT_TRAITEMENT IS 'Date à laquelle l''alerte a été marquée comme traitée ; NULL si non traitée.';
COMMENT ON COLUMN ALERTE.ID_UTILISATEUR_TRAITEMENT IS 'Superviseur qui a traité l''alerte ; NULL si non traitée.';
COMMENT ON COLUMN ALERTE.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN ALERTE.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN ALERTE.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

COMMENT ON TABLE JETON_RAFRAICHISSEMENT IS 'Jeton de rafraîchissement émis à la connexion ; seule son empreinte est stockée.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.ID IS 'Identifiant technique du jeton.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.ID_UTILISATEUR IS 'Utilisateur propriétaire du jeton.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.CD_HASH_JETON IS 'Empreinte du jeton ; le jeton lui-même reste dans un cookie HttpOnly.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.DT_EXPIRATION IS 'Date d''expiration du jeton.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.DT_REVOCATION IS 'Date de révocation (déconnexion, désactivation, anonymisation) ; NULL si le jeton est valide.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.created_at IS 'Date de création de la ligne.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.updated_at IS 'Date de dernière modification de la ligne.';
COMMENT ON COLUMN JETON_RAFRAICHISSEMENT.deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.';

-- ---------------------------------------------------------------------------
-- Reference data and initial rules (thresholds are a proposal, D-04)
-- ---------------------------------------------------------------------------

INSERT INTO R_ROLE (CD_ROLE, LB_ROLE) VALUES
    ('USER',       'Utilisateur'),
    ('SUPERVISOR', 'Superviseur');

INSERT INTO R_CRITICITE (CD_CRITICITE, LB_CRITICITE) VALUES
    ('LOW',    'Basse'),
    ('MEDIUM', 'Moyenne'),
    ('HIGH',   'Haute');

INSERT INTO R_UNITE (CD_UNITE, LB_UNITE) VALUES
    ('s',    'seconde'),
    ('m/s',  'mètre par seconde'),
    ('m/s²', 'mètre par seconde carrée'),
    ('°/s',  'degré par seconde');

INSERT INTO REGLE (CD_REGLE, LB_DESCRIPTION, NB_SEUIL, ID_UNITE, ID_CRITICITE)
SELECT v.code, v.description, v.seuil, u.ID, c.ID
FROM (VALUES
    ('R1', 'Délai trop long depuis le dernier contact', 300, 's',    'MEDIUM'),
    ('R2', 'Position devenue trop ancienne',            600, 's',    'LOW'),
    ('R3', 'Variation importante d''altitude',            30, 'm/s',  'HIGH'),
    ('R4', 'Variation importante de vitesse',             2, 'm/s²', 'MEDIUM'),
    ('R5', 'Variation importante de cap',                 5, '°/s',  'MEDIUM')
) AS v (code, description, seuil, unite, criticite)
JOIN R_UNITE u     ON u.CD_UNITE = v.unite
JOIN R_CRITICITE c ON c.CD_CRITICITE = v.criticite;
