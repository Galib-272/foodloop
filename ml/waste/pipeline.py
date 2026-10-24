"""
Preprocessing + feature engineering for the Kaggle food-waste dataset.

Used by 01_waste_model.ipynb (training/evaluation) and by export.py (model export for the app).
The TypeScript app (lib/ml/waste.ts) re-implements build_features() exactly; golden tests check parity.

Prediction time = the MORNING of the day: we only use information known before the day starts.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RAW = "data/raw/food_waste_dataset.csv"

CATEGORIES = ["Bakery", "Dairy", "Fruits", "Meat", "Prepared Food", "Vegetables"]
BUSINESS_TYPES = ["Cafeteria", "Cloud Kitchen", "Restaurant", "Supermarket"]
WEATHER = ["Cloudy", "Hot", "Rainy", "Sunny"]
WASTE_LEVELS = ["Low", "Medium", "High"]

# Columns only known at the END of the day (or derived from the outcome) -> never used as model inputs.
LEAKAGE_COLUMNS = ["Units_Sold", "Remaining_Stock", "Daily_Demand", "Waste_Quantity", "Waste_Reason", "Donation_Made"]
ID_COLUMNS = ["Inventory_ID"]

NUMERIC_BASE = ["Purchase_Quantity", "Shelf_Life_Days", "Storage_Temperature", "Promotion"]
CATEGORICAL = {"Business_Type": BUSINESS_TYPES, "Food_Category": CATEGORIES, "Weather": WEATHER, "Season": ["Winter", "Summer", "Monsoon", "Autumn"]}


# ---------------------------------------------------------------- loading & cleaning

def load_raw(path: str = RAW) -> pd.DataFrame:
    return pd.read_csv(path)


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Type conversion, text normalisation, duplicate removal and rule validation. No statistics are learned here."""
    report: dict = {"rows_in": len(df)}
    df = df.copy()
    # Text normalisation (trim spaces, consistent capitalisation)
    for c in ["Business_Type", "Food_Category", "Weather", "Promotion", "Waste_Reason", "Donation_Made", "Waste_Level"]:
        df[c] = df[c].astype("string").str.strip()
    df["Promotion"] = df["Promotion"].str.title().map({"Yes": 1, "No": 0})
    df["Donation_Made"] = df["Donation_Made"].str.title().map({"Yes": 1, "No": 0})
    # Dates
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    report["invalid_dates"] = int(df["Date"].isna().sum())
    df = df.dropna(subset=["Date"])
    # Duplicates: same ID, or same record apart from the ID
    report["duplicate_ids"] = int(df["Inventory_ID"].duplicated().sum())
    report["duplicate_records"] = int(df.drop(columns=ID_COLUMNS).duplicated().sum())
    df = df.drop_duplicates(subset=["Inventory_ID"]).drop_duplicates(subset=[c for c in df.columns if c not in ID_COLUMNS])
    # Business-rule validation
    bad = (
        (df["Purchase_Quantity"] <= 0)
        | (df["Units_Sold"] < 0)
        | (df["Units_Sold"] > df["Purchase_Quantity"])
        | (df["Remaining_Stock"] != df["Purchase_Quantity"] - df["Units_Sold"])
        | (df["Waste_Quantity"] < 0)
        | (df["Waste_Quantity"] > df["Remaining_Stock"])
        | (df["Shelf_Life_Days"] <= 0)
        | ~df["Business_Type"].isin(BUSINESS_TYPES)
        | ~df["Food_Category"].isin(CATEGORIES)
        | ~df["Waste_Level"].isin(WASTE_LEVELS)
        | (df["Weather"].notna() & ~df["Weather"].isin(WEATHER))
    )
    report["rule_violations_removed"] = int(bad.sum())
    df = df[~bad].drop(columns=ID_COLUMNS).sort_values("Date").reset_index(drop=True)
    report["rows_out"] = len(df)
    return df, report


def recover_demand(df: pd.DataFrame) -> pd.Series:
    """Logical imputation: Units_Sold = min(Purchase, Demand). If stock was left over, demand == units sold exactly."""
    d = df["Daily_Demand"].copy()
    recoverable = d.isna() & (df["Units_Sold"] < df["Purchase_Quantity"])
    d[recoverable] = df.loc[recoverable, "Units_Sold"]
    return d


def chronological_split(df: pd.DataFrame, train=0.70, val=0.15):
    """Split by date so the model is always evaluated on days AFTER the ones it learned from."""
    dates = np.sort(df["Date"].unique())
    c1 = dates[int(len(dates) * train) - 1]
    c2 = dates[int(len(dates) * (train + val)) - 1]
    return df[df["Date"] <= c1].copy(), df[(df["Date"] > c1) & (df["Date"] <= c2)].copy(), df[df["Date"] > c2].copy()


# ---------------------------------------------------------------- statistics learned from TRAINING data only

SHELF_EDGES = [1, 2, 3, 5, 7]       # shelf-life buckets: <=1, <=2, <=3, <=5, <=7, >7 days
TEMP_EDGES = [4, 8, 15, 22]         # storage-temperature buckets (°C): fridge … room temperature
SPOIL_SMOOTHING = 20                # shrink small groups towards the overall average


def bucket(values, edges) -> np.ndarray:
    """Index of the bucket: number of edges strictly below the value."""
    return np.searchsorted(np.asarray(edges, dtype=float), np.asarray(values, dtype=float), side="left")


def _spoilage_tables(train: pd.DataFrame, a: dict) -> dict:
    """How much of the LEFTOVER food typically ends up wasted (spoils), from past (training) days only."""
    t = impute(train, a)
    t = t[t["Remaining_Stock"] > 0].copy()
    t["wf"] = t["Waste_Quantity"] / t["Remaining_Stock"]
    t["sb"] = bucket(t["Shelf_Life_Days"], SHELF_EDGES)
    t["tb"] = bucket(t["Storage_Temperature"], TEMP_EDGES)
    g = float(t["wf"].mean())

    def table(keys):
        s = t.groupby(keys)["wf"].agg(["sum", "count"])
        vals = (s["sum"] + SPOIL_SMOOTHING * g) / (s["count"] + SPOIL_SMOOTHING)
        return {("|".join(map(str, k)) if isinstance(k, tuple) else str(k)): round(float(v), 6) for k, v in vals.items()}

    return {"global": round(g, 6), "category": table("Food_Category"), "temp": table("tb"), "weather": table("Weather"), "category_shelf": table(["Food_Category", "sb"])}


def fit_artifacts(train: pd.DataFrame) -> dict:
    """Everything that depends on data statistics is learned here, from the training split only."""
    demand = recover_demand(train)
    t = train.assign(_d=demand)
    k1 = ["Business_Type", "Food_Category", "Promotion", "Weather"]
    k2 = ["Business_Type", "Food_Category"]
    a = {
        "shelf_life_median": train.groupby("Food_Category")["Shelf_Life_Days"].median().round(3).to_dict(),
        "storage_temp_median": train.groupby("Food_Category")["Storage_Temperature"].median().round(3).to_dict(),
        "weather_mode": str(train["Weather"].mode()[0]),
        # Historical average demand (a "typical day" for this business type and food) — past data, not the target day.
        "exp_demand_k1": {"|".join(map(str, k)): round(float(v), 4) for k, v in t.dropna(subset=["Weather"]).groupby(k1)["_d"].mean().items()},
        "exp_demand_k2": {"|".join(map(str, k)): round(float(v), 4) for k, v in t.groupby(k2)["_d"].mean().items()},
        "exp_demand_global": round(float(t["_d"].mean()), 4),
    }
    a["spoilage"] = _spoilage_tables(train, a)
    return a


def season_of(month: int) -> str:
    # Bangladesh seasons (simplified): Winter Dec–Feb, Summer Mar–May, Monsoon Jun–Sep, Autumn Oct–Nov
    return "Winter" if month in (12, 1, 2) else "Summer" if month in (3, 4, 5) else "Monsoon" if month in (6, 7, 8, 9) else "Autumn"


def impute(df: pd.DataFrame, a: dict) -> pd.DataFrame:
    df = df.copy()
    df["Shelf_Life_Days"] = df["Shelf_Life_Days"].fillna(df["Food_Category"].map(a["shelf_life_median"]))
    df["Storage_Temperature"] = df["Storage_Temperature"].fillna(df["Food_Category"].map(a["storage_temp_median"]))
    df["Weather"] = df["Weather"].fillna(a["weather_mode"])
    return df


def build_features(df: pd.DataFrame, a: dict) -> pd.DataFrame:
    """Morning-only features. Mirrored exactly in lib/ml/waste.ts."""
    df = impute(df, a)
    out = pd.DataFrame(index=df.index)
    out["Purchase_Quantity"] = df["Purchase_Quantity"].astype(float)
    out["Purchase_Log"] = np.log1p(out["Purchase_Quantity"])
    out["Shelf_Life_Days"] = df["Shelf_Life_Days"].astype(float)
    out["Storage_Temperature"] = df["Storage_Temperature"].astype(float)
    out["Temp_Deviation"] = out["Storage_Temperature"] - df["Food_Category"].map(a["storage_temp_median"]).astype(float)
    out["Promotion"] = df["Promotion"].astype(float)
    dow = df["Date"].dt.dayofweek  # Monday = 0
    out["Day_Of_Week"] = dow.astype(float)
    out["Is_Weekend"] = dow.isin([4, 5]).astype(float)  # Friday/Saturday weekend in Bangladesh
    out["Month"] = df["Date"].dt.month.astype(float)
    k1 = df["Business_Type"] + "|" + df["Food_Category"] + "|" + df["Promotion"].astype(int).astype(str) + "|" + df["Weather"]
    k2 = df["Business_Type"] + "|" + df["Food_Category"]
    exp = k1.map(a["exp_demand_k1"]).fillna(k2.map(a["exp_demand_k2"])).fillna(a["exp_demand_global"]).astype(float)
    out["Expected_Demand"] = exp
    out["Expected_Leftover"] = (out["Purchase_Quantity"] - exp).clip(lower=0)
    out["Overstock_Ratio"] = out["Purchase_Quantity"] / exp
    # Spoilage features: waste share ≈ (share left over) × (share of leftovers that spoil)
    sp = a["spoilage"]
    g = sp["global"]
    sb = pd.Series(bucket(df["Shelf_Life_Days"], SHELF_EDGES), index=df.index)
    tb = pd.Series(bucket(df["Storage_Temperature"], TEMP_EDGES), index=df.index)
    cat_rate = df["Food_Category"].map(sp["category"]).fillna(g).astype(float)
    cat_shelf = (df["Food_Category"] + "|" + sb.astype(str)).map(sp["category_shelf"]).astype(float).fillna(cat_rate)
    temp_rate = tb.astype(str).map(sp["temp"]).astype(float).fillna(g)
    weather_rate = df["Weather"].map(sp["weather"]).astype(float).fillna(g)
    out["Leftover_Ratio_Exp"] = out["Expected_Leftover"] / out["Purchase_Quantity"]
    out["Spoil_Rate_Est"] = cat_shelf * (temp_rate / g) * (weather_rate / g)
    out["Waste_Ratio_Est"] = out["Leftover_Ratio_Exp"] * out["Spoil_Rate_Est"]
    out["Waste_Units_Est"] = out["Expected_Leftover"] * out["Spoil_Rate_Est"]
    out["Inv_Shelf_Life"] = 1.0 / out["Shelf_Life_Days"]
    seasons = df["Date"].dt.month.map(season_of)
    for col, cats in CATEGORICAL.items():
        src = seasons if col == "Season" else df[col]
        for c in cats:
            out[f"{col}={c}"] = (src == c).astype(float)
    return out


FEATURE_ORDER: list[str] | None = None  # filled after feature selection in the notebook


def demand_target(df: pd.DataFrame) -> pd.Series:
    return recover_demand(df)
