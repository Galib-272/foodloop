"""
Preprocessing + features for the SYNTHETIC donation-matching dataset (Feature 2).
Mirrored in lib/ml/matching.ts (golden tests check parity).
Prediction time = when the donor publishes a donation and the app ranks candidate organizations.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RAW = "data/synthetic_donation_matching_dataset.csv"
CATEGORIES = ["Bakery", "Dairy", "Fruits", "Meat", "Prepared Food", "Vegetables"]
ORG_TYPES = ["NGO", "Community Kitchen", "Shelter", "Food Bank", "Orphanage"]
STORAGE = ["Ambient", "Refrigerated", "Frozen"]
BUSINESS_TYPES = ["Cafeteria", "Cloud Kitchen", "Restaurant", "Supermarket"]
LEAKAGE_COLUMNS = ["Accepted", "Delivered_Quantity", "Failure_Reason"]
DROP_COLUMNS = ["Data_Source", "Match_ID", "Donation_ID", "Org_Name", "Donor_Area", "Org_Area"]  # ids / names / location proxies
YES = {"yes": 1, "y": 1, "true": 1, "1": 1, "no": 0, "n": 0, "false": 0, "0": 0}
STORAGE_MAP = {"ambient": "Ambient", "room temp": "Ambient", "refrigerated": "Refrigerated", "fridge": "Refrigerated", "chilled": "Refrigerated",
               "frozen": "Frozen", "freezer": "Frozen"}
CATEGORICAL = {"Org_Type": ORG_TYPES, "Food_Category": CATEGORIES, "Storage_Required": STORAGE, "Business_Type": BUSINESS_TYPES}
AVG_SPEED_KMH = 18.0  # used to derive missing distance/travel time from each other


def load_raw(path: str = RAW) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str)


def _canon(series: pd.Series, options: list[str]) -> pd.Series:
    lookup = {o.lower(): o for o in options}
    return series.str.strip().str.lower().map(lookup)


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.astype("string").str.replace("km", "", regex=False).str.strip(), errors="coerce")


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    rep: dict = {"rows_in": len(df)}
    df = df.copy()
    rep["exact_duplicates_removed"] = int(df.duplicated().sum())
    df = df.drop_duplicates()
    rep["duplicate_match_ids_removed"] = int(df["Match_ID"].duplicated().sum())
    df = df.drop_duplicates(subset=["Match_ID"])
    # --- text normalisation
    df["Food_Category"] = _canon(df["Food_Category"], CATEGORIES)
    df["Org_Type"] = _canon(df["Org_Type"], ORG_TYPES)
    df["Business_Type"] = _canon(df["Business_Type"], BUSINESS_TYPES)
    df["Storage_Required"] = df["Storage_Required"].str.strip().str.lower().map(STORAGE_MAP)
    for c in ["Accepts_Category", "Has_Required_Storage", "Open_At_Post_Time", "Accepted", "Successful_Match"]:
        df[c] = df[c].str.strip().str.lower().map(YES)
    # --- dates & times (two formats each)
    iso = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors="coerce")
    dmy = pd.to_datetime(df["Date"], format="%d/%m/%Y", errors="coerce")
    df["Date"] = iso.fillna(dmy)
    t24 = pd.to_datetime(df["Time_Posted"], format="%H:%M", errors="coerce")
    t12 = pd.to_datetime(df["Time_Posted"], format="%I:%M %p", errors="coerce")
    df["Posted_Hour"] = t24.fillna(t12).dt.hour
    rep["mixed_date_formats_fixed"] = int(iso.isna().sum() - df["Date"].isna().sum())
    rep["mixed_time_formats_fixed"] = int(t24.isna().sum() - df["Posted_Hour"].isna().sum())
    # --- numbers (strip units like "3.4 km")
    for c in ["Quantity_Units", "Hours_To_Expiry", "Daily_Capacity_Units", "Capacity_Remaining_Units", "Past_Acceptance_Rate",
              "Hours_Until_Open", "Distance_km", "Est_Travel_Time_min", "Delivered_Quantity"]:
        df[c] = _num(df[c])
    # --- impossible values -> missing (then imputed) or row removed
    rep["negative_distance_to_missing"] = int((df["Distance_km"] < 0).sum())
    df.loc[df["Distance_km"] < 0, "Distance_km"] = np.nan
    pct = df["Past_Acceptance_Rate"] > 1
    rep["acceptance_rate_percent_fixed"] = int(pct.sum())
    df.loc[pct, "Past_Acceptance_Rate"] = df.loc[pct, "Past_Acceptance_Rate"] / 100
    over = df["Capacity_Remaining_Units"] > df["Daily_Capacity_Units"]
    rep["capacity_above_daily_to_missing"] = int(over.sum())
    df.loc[over, "Capacity_Remaining_Units"] = np.nan
    bad_exp = df["Hours_To_Expiry"] > 24 * 30
    rep["impossible_expiry_to_missing"] = int(bad_exp.sum())
    df.loc[bad_exp, "Hours_To_Expiry"] = np.nan
    bad_qty = ~(df["Quantity_Units"] > 0)
    rep["rows_removed_invalid_quantity"] = int(bad_qty.sum())
    df = df[~bad_qty]
    bad = df["Date"].isna() | df["Posted_Hour"].isna() | df["Successful_Match"].isna() | df["Food_Category"].isna() | df["Business_Type"].isna()
    rep["rows_removed_unrecoverable"] = int(bad.sum())
    df = df[~bad].sort_values(["Date", "Posted_Hour", "Donation_ID"]).reset_index(drop=True)
    rep["rows_out"] = len(df)
    return df, rep


def chronological_split(df: pd.DataFrame, train=0.70, val=0.15):
    dates = np.sort(df["Date"].unique())
    c1 = dates[int(len(dates) * train) - 1]
    c2 = dates[int(len(dates) * (train + val)) - 1]
    return df[df["Date"] <= c1].copy(), df[(df["Date"] > c1) & (df["Date"] <= c2)].copy(), df[df["Date"] > c2].copy()


def fit_artifacts(train: pd.DataFrame) -> dict:
    return {
        "org_type_by_org": train.dropna(subset=["Org_Type"]).groupby("Org_ID")["Org_Type"].agg(lambda s: s.mode()[0]).to_dict(),
        "org_type_mode": str(train["Org_Type"].mode()[0]),
        "acceptance_by_org": train.groupby("Org_ID")["Past_Acceptance_Rate"].median().dropna().round(4).to_dict(),
        "acceptance_median": float(train["Past_Acceptance_Rate"].median()),
        "storage_mode_by_category": train.dropna(subset=["Storage_Required"]).groupby("Food_Category")["Storage_Required"].agg(lambda s: s.mode()[0]).to_dict(),
        "expiry_median_by_category": train.groupby("Food_Category")["Hours_To_Expiry"].median().round(3).to_dict(),
        "capacity_ratio_median": float((train["Capacity_Remaining_Units"] / train["Daily_Capacity_Units"]).median()),
        "travel_intercept_min": 5.0,
        "distance_median": float(train["Distance_km"].median()),
    }


def impute(df: pd.DataFrame, a: dict) -> pd.DataFrame:
    df = df.copy()
    # Logical recovery first: the same organization always has the same type / similar acceptance rate.
    if "Org_ID" in df:
        df["Org_Type"] = df["Org_Type"].fillna(df["Org_ID"].map(a["org_type_by_org"]))
        df["Past_Acceptance_Rate"] = df["Past_Acceptance_Rate"].fillna(df["Org_ID"].map(a["acceptance_by_org"]))
    df["Org_Type"] = df["Org_Type"].fillna(a["org_type_mode"])
    df["Past_Acceptance_Rate"] = df["Past_Acceptance_Rate"].fillna(a["acceptance_median"])
    df["Storage_Required"] = df["Storage_Required"].fillna(df["Food_Category"].map(a["storage_mode_by_category"]))
    df["Hours_To_Expiry"] = df["Hours_To_Expiry"].fillna(df["Food_Category"].map(a["expiry_median_by_category"]))
    df["Capacity_Remaining_Units"] = df["Capacity_Remaining_Units"].fillna((df["Daily_Capacity_Units"] * a["capacity_ratio_median"]).round())
    # distance <-> travel time are derived from each other when one is missing
    est_dist = (df["Est_Travel_Time_min"] - a["travel_intercept_min"]).clip(lower=0) / 60 * AVG_SPEED_KMH
    df["Distance_km"] = df["Distance_km"].fillna(est_dist).fillna(a["distance_median"])
    df["Est_Travel_Time_min"] = df["Est_Travel_Time_min"].fillna(df["Distance_km"] / AVG_SPEED_KMH * 60 + a["travel_intercept_min"])
    for c in ["Accepts_Category", "Has_Required_Storage", "Open_At_Post_Time"]:
        df[c] = df[c].fillna(0)
    return df


def build_features(df: pd.DataFrame, a: dict) -> pd.DataFrame:
    """Mirrored exactly in lib/ml/matching.ts."""
    df = impute(df, a)
    out = pd.DataFrame(index=df.index)
    q = df["Quantity_Units"].astype(float)
    out["Quantity_Units"] = q
    out["Quantity_Log"] = np.log1p(q)
    out["Hours_To_Expiry"] = df["Hours_To_Expiry"].astype(float)
    out["Daily_Capacity_Units"] = df["Daily_Capacity_Units"].astype(float)
    out["Capacity_Remaining_Units"] = df["Capacity_Remaining_Units"].astype(float)
    out["Capacity_Ratio"] = (out["Capacity_Remaining_Units"] / q).clip(upper=10)
    out["Past_Acceptance_Rate"] = df["Past_Acceptance_Rate"].astype(float)
    out["Open_Now"] = df["Open_At_Post_Time"].astype(float)
    out["Hours_Until_Open"] = df["Hours_Until_Open"].astype(float)
    out["Distance_km"] = df["Distance_km"].astype(float)
    out["Travel_Time_min"] = df["Est_Travel_Time_min"].astype(float)
    out["Arrival_Hours"] = out["Hours_Until_Open"] + out["Travel_Time_min"] / 60
    out["Time_Slack_Hours"] = out["Hours_To_Expiry"] - out["Arrival_Hours"]
    out["Accepts_Category"] = df["Accepts_Category"].astype(float)
    out["Has_Required_Storage"] = df["Has_Required_Storage"].astype(float)
    out["Posted_Hour"] = df["Posted_Hour"].astype(float)
    out["Is_Late_Evening"] = (df["Posted_Hour"] >= 21).astype(float)
    out["Is_Weekend"] = df["Date"].dt.dayofweek.isin([4, 5]).astype(float)
    for col, cats in CATEGORICAL.items():
        for c in cats:
            out[f"{col}={c}"] = (df[col] == c).astype(float)
    return out
