-- FoodSphere AI data warehouse (DuckDB)
-- Star schema for waste and food-rescue analytics.
-- Built by ml/warehouse/build_warehouse.py from:
--   1. ml/waste/data/raw/food_waste_dataset.csv            (Kaggle, real data)
--   2. ml/matching/data/synthetic_donation_matching_dataset.csv (synthetic, clearly labelled)
--   3. data/foodsphere-v2.db                                 (the app's own SQLite database, optional)

-- ---------- Dimensions ----------

CREATE TABLE dim_date (
  date_key      INTEGER PRIMARY KEY,   -- yyyymmdd
  full_date     DATE NOT NULL,
  year          INTEGER NOT NULL,
  quarter       INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  month_name    VARCHAR NOT NULL,
  week_of_year  INTEGER NOT NULL,
  day_of_week   INTEGER NOT NULL,      -- 1 = Monday ... 7 = Sunday
  weekday_name  VARCHAR NOT NULL,
  is_weekend    BOOLEAN NOT NULL
);

CREATE TABLE dim_food_category (
  category_key  INTEGER PRIMARY KEY,
  category_name VARCHAR NOT NULL UNIQUE,
  is_perishable BOOLEAN NOT NULL       -- short shelf life: dairy, meat, seafood, prepared food, bakery, produce
);

CREATE TABLE dim_business_type (
  business_type_key  INTEGER PRIMARY KEY,
  business_type_name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE dim_weather (
  weather_key  INTEGER PRIMARY KEY,
  weather_name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE dim_waste_reason (
  waste_reason_key  INTEGER PRIMARY KEY,
  waste_reason_name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE dim_area (
  area_key  INTEGER PRIMARY KEY,
  area_name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE dim_organization (
  organization_key INTEGER PRIMARY KEY,
  source_org_id    VARCHAR NOT NULL,     -- ORG041 (synthetic) or app-<id> (app database)
  org_name         VARCHAR NOT NULL,
  org_type         VARCHAR NOT NULL,
  area_key         INTEGER REFERENCES dim_area(area_key),
  data_source      VARCHAR NOT NULL,     -- 'synthetic' or 'app'
  UNIQUE (source_org_id, data_source)
);

-- ---------- Facts ----------

-- One row per inventory record per day (Kaggle). Grain: inventory item x date.
CREATE TABLE fact_inventory_waste (
  inventory_id       VARCHAR PRIMARY KEY,
  date_key           INTEGER NOT NULL REFERENCES dim_date(date_key),
  category_key       INTEGER NOT NULL REFERENCES dim_food_category(category_key),
  business_type_key  INTEGER NOT NULL REFERENCES dim_business_type(business_type_key),
  weather_key        INTEGER NOT NULL REFERENCES dim_weather(weather_key),
  waste_reason_key   INTEGER NOT NULL REFERENCES dim_waste_reason(waste_reason_key),
  purchase_quantity  DOUBLE NOT NULL,
  units_sold         DOUBLE NOT NULL,
  remaining_stock    DOUBLE NOT NULL,
  waste_quantity     DOUBLE NOT NULL,
  daily_demand       DOUBLE,
  shelf_life_days    DOUBLE,
  storage_temp_c     DOUBLE,
  promotion          BOOLEAN NOT NULL,
  donation_made      BOOLEAN NOT NULL,
  waste_level        VARCHAR NOT NULL    -- Low / Medium / High (target of AI model 1)
);

-- One row per donation offered to one organization (synthetic). Grain: donation x organization.
CREATE TABLE fact_donation_match (
  match_id              VARCHAR PRIMARY KEY,
  donation_id           VARCHAR NOT NULL,
  date_key              INTEGER NOT NULL REFERENCES dim_date(date_key),
  category_key          INTEGER NOT NULL REFERENCES dim_food_category(category_key),
  business_type_key     INTEGER NOT NULL REFERENCES dim_business_type(business_type_key),
  organization_key      INTEGER NOT NULL REFERENCES dim_organization(organization_key),
  donor_area_key        INTEGER NOT NULL REFERENCES dim_area(area_key),
  quantity_units        DOUBLE NOT NULL,
  hours_to_expiry       DOUBLE,
  distance_km           DOUBLE,
  travel_time_min       DOUBLE,
  accepts_category      BOOLEAN,
  has_required_storage  BOOLEAN,
  accepted              BOOLEAN,
  delivered_quantity    DOUBLE NOT NULL,
  failure_reason        VARCHAR,
  successful_match      BOOLEAN NOT NULL,  -- target of AI model 2
  data_source           VARCHAR NOT NULL   -- always 'synthetic' here
);

-- One row per donation listed in the live app (optional; loaded only if data/foodsphere-v2.db exists).
CREATE TABLE fact_app_donation (
  donation_id          INTEGER PRIMARY KEY,
  date_key             INTEGER NOT NULL REFERENCES dim_date(date_key),
  category_key         INTEGER NOT NULL REFERENCES dim_food_category(category_key),
  donor_area_key       INTEGER REFERENCES dim_area(area_key),
  organization_key     INTEGER REFERENCES dim_organization(organization_key),  -- recipient, if collected
  quantity_available   DOUBLE NOT NULL,
  unit                 VARCHAR NOT NULL,
  donation_status      VARCHAR NOT NULL,
  quantity_delivered   DOUBLE,
  collection_status    VARCHAR,
  data_source          VARCHAR NOT NULL    -- always 'app'
);
