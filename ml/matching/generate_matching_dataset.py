"""
SYNTHETIC donation-matching dataset generator for FoodSphere AI (Feature 2: finding the right organization).

WHY SYNTHETIC: no public dataset records which organizations accepted/received surplus-food donations.
This script SIMULATES realistic offers so a matching model can be demonstrated. Every row is labelled
Data_Source = "synthetic", all organization names are invented, and the model can only learn the patterns
written below — it must be re-trained on real platform data before real-world use.

Realism anchors (taken from the Kaggle food-waste dataset):
  * food categories, business types, leftover quantities and shelf lives are sampled from the Kaggle records;
  * locations are real Dhaka areas (approximate centroids), organizations are fictional.

Each row = one donation offered to one candidate organization, plus what happened.
Target: Successful_Match (Yes/No) = the organization accepted the food AND received it before expiry.

The file is deliberately MESSY (missing values, duplicates, inconsistent text, mixed formats, impossible values)
so the preprocessing pipeline can be demonstrated. Run:  python generate_matching_dataset.py
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20251021)
N_ORGS = 60
N_DONATIONS = 2500
KAGGLE = "../waste/data/raw/food_waste_dataset.csv"

AREAS = {  # approximate centroids (lat, lng)
    "Badda": (23.7806, 90.4261), "Banani": (23.7937, 90.4066), "Bashundhara": (23.8193, 90.4526), "Dhanmondi": (23.7461, 90.3742),
    "Farmgate": (23.7586, 90.3897), "Gulshan": (23.7808, 90.4167), "Jatrabari": (23.7104, 90.4348), "Khilgaon": (23.7516, 90.4283),
    "Lalbagh": (23.7189, 90.3882), "Mirpur": (23.8069, 90.3687), "Mohakhali": (23.7778, 90.4057), "Mohammadpur": (23.7662, 90.3589),
    "Motijheel": (23.7330, 90.4172), "Old Dhaka": (23.7104, 90.4074), "Rampura": (23.7612, 90.4209), "Tejgaon": (23.7639, 90.3930), "Uttara": (23.8759, 90.3795),
}
CATEGORIES = ["Bakery", "Dairy", "Fruits", "Meat", "Prepared Food", "Vegetables"]
ORG_TYPES = ["NGO", "Community Kitchen", "Shelter", "Food Bank", "Orphanage"]
DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Fictional name parts — no real organization is represented.
NAME_A = ["Annapurna", "Shopno", "Alo", "Nirapod", "Sabuj", "Notun Din", "Asha", "Bondhu", "Mukti", "Prottasha", "Shanti", "Dipto", "Ujjal", "Bhalobasha", "Shonar"]
NAME_B = {"NGO": "Foundation", "Community Kitchen": "Community Kitchen", "Shelter": "Shelter Home", "Food Bank": "Food Bank", "Orphanage": "Children's Home"}


def haversine(a, b):
    (la1, lo1), (la2, lo2) = np.radians(a), np.radians(b)
    h = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(h))


def jitter(latlng, km=1.2):
    return (latlng[0] + RNG.normal(0, km / 111), latlng[1] + RNG.normal(0, km / 102))


# ------------------------------------------------------------------ organizations
orgs = []
used = set()
for i in range(N_ORGS):
    t = RNG.choice(ORG_TYPES, p=[0.25, 0.25, 0.2, 0.12, 0.18])
    area = RNG.choice(list(AREAS))
    name = f"{RNG.choice(NAME_A)} {NAME_B[t]}"
    if name in used:
        name = f"{name} {area}"
    n_dup = 2
    while name in used:  # guaranteed to terminate: adds a branch number
        name = f"{RNG.choice(NAME_A)} {NAME_B[t]} {area} {n_dup}"; n_dup += 1
    used.add(name)
    pref = {  # which food types each organization type usually accepts
        "Food Bank": CATEGORIES,
        "Community Kitchen": ["Prepared Food", "Vegetables", "Fruits", "Meat", "Bakery", "Dairy"],
        "Shelter": ["Prepared Food", "Bakery", "Fruits", "Dairy", "Vegetables"],
        "Orphanage": ["Prepared Food", "Bakery", "Fruits", "Dairy"],
        "NGO": ["Prepared Food", "Bakery", "Fruits", "Vegetables", "Dairy", "Meat"],
    }[t]
    n_acc = len(pref) if t == "Food Bank" else int(RNG.integers(2, len(pref) + 1))
    accepts = set(RNG.choice(pref, size=n_acc, replace=False))
    has_fridge = RNG.random() < {"Food Bank": 0.95, "Community Kitchen": 0.75, "Shelter": 0.55, "Orphanage": 0.6, "NGO": 0.5}[t]
    has_freezer = has_fridge and RNG.random() < {"Food Bank": 0.8, "Community Kitchen": 0.35, "Shelter": 0.2, "Orphanage": 0.2, "NGO": 0.15}[t]
    cap = int({"Food Bank": RNG.integers(250, 600), "Community Kitchen": RNG.integers(80, 250), "Shelter": RNG.integers(40, 150),
               "Orphanage": RNG.integers(30, 110), "NGO": RNG.integers(50, 200)}[t])
    open_h = int(RNG.choice([7, 8, 9, 10])); close_h = int(RNG.choice([17, 18, 20, 21, 22])) if t != "Food Bank" else int(RNG.choice([17, 18]))
    reliability = float(np.clip(RNG.beta(6, 2), 0.35, 0.98))  # hidden true reliability
    orgs.append(dict(Org_ID=f"ORG{i+1:03d}", Org_Name=name, Org_Type=t, Org_Area=area, latlng=jitter(AREAS[area]), accepts=accepts,
                     fridge=has_fridge, freezer=has_freezer, cap=cap, open_h=open_h, close_h=close_h, rel=reliability,
                     past_rate=float(np.clip(reliability + RNG.normal(0, 0.07), 0.05, 1.0))))

# ------------------------------------------------------------------ donations (anchored on Kaggle records)
k = pd.read_csv(KAGGLE)
k = k[(k["Remaining_Stock"] > 0)].copy()
k["Shelf_Life_Days"] = k["Shelf_Life_Days"].fillna(k.groupby("Food_Category")["Shelf_Life_Days"].transform("median"))
k["Date"] = pd.to_datetime(k["Date"])
src = k.sample(N_DONATIONS, replace=True, random_state=7).reset_index(drop=True)


def storage_for(cat):
    if cat == "Meat":
        return RNG.choice(["Refrigerated", "Frozen"], p=[0.6, 0.4])
    if cat == "Dairy":
        return "Refrigerated"
    if cat == "Prepared Food":
        return RNG.choice(["Refrigerated", "Ambient"], p=[0.55, 0.45])
    if cat in ("Fruits", "Vegetables"):
        return RNG.choice(["Ambient", "Refrigerated"], p=[0.7, 0.3])
    return "Ambient"


rows = []
for d_i, r in src.iterrows():
    cat = r["Food_Category"]
    qty = int(max(1, r["Remaining_Stock"] * RNG.uniform(0.5, 1.0)))  # donor offers part of the leftover
    hours = float(np.clip(r["Shelf_Life_Days"] * 24 * RNG.uniform(0.15, 0.7), 1.5, 24 * 12))
    storage = storage_for(cat)
    donor_area = RNG.choice(list(AREAS))
    donor_ll = jitter(AREAS[donor_area])
    date = r["Date"]
    hour = int(np.clip(RNG.normal(18, 3.5), 6, 23)); minute = int(RNG.choice([0, 15, 30, 45]))
    # candidate organizations: mostly the nearest, plus a few random ones
    dists = np.array([haversine(donor_ll, o["latlng"]) for o in orgs])
    near = list(np.argsort(dists)[:10])
    n_c = int(RNG.integers(4, 7))
    cand = list(RNG.choice(near, size=min(n_c - 1, len(near)), replace=False)) + [int(RNG.integers(0, N_ORGS))]
    for j in dict.fromkeys(cand):
        o = orgs[j]
        dist = float(dists[j])
        rush = 1.35 if hour in (8, 9, 17, 18, 19) else 1.0
        travel = dist / 18 * 60 * rush * RNG.uniform(0.85, 1.25) + 5
        open_now = o["open_h"] <= hour < o["close_h"]
        until_open = 0.0 if open_now else float((o["open_h"] - hour) % 24)
        load = RNG.uniform(0, 0.95)
        cap_rem = int(round(o["cap"] * (1 - load)))
        accepts = cat in o["accepts"]
        has_storage = storage == "Ambient" or (storage == "Refrigerated" and o["fridge"]) or (storage == "Frozen" and o["freezer"])
        arrival_h = until_open + travel / 60
        slack = hours - arrival_h
        # ---- latent decision model (documented, with noise) ----
        z = -0.4
        z += 1.6 * np.tanh(cap_rem / max(qty, 1) - 0.8)                # enough free capacity
        z += -0.16 * dist                                               # farther = less likely
        z += 1.4 * np.tanh(slack / 6) if slack > 0 else -3.5            # enough time before expiry
        z += 2.2 * (o["rel"] - 0.7)                                      # organization reliability
        z += {"Food Bank": 0.35 * np.tanh((qty - 40) / 40), "Orphanage": -0.4 * np.tanh((qty - 40) / 40)}.get(o["Org_Type"], 0)
        z += 0.45 if (cat == "Prepared Food" and o["Org_Type"] in ("Shelter", "Community Kitchen")) else 0
        z += -0.35 if hour >= 21 else 0
        z += -0.25 if date.dayofweek in (4,) else 0                    # Friday (weekend) staffing
        if not accepts:
            z -= 4.0
        if not has_storage:
            z -= 3.2
        p_accept = 1 / (1 + np.exp(-z))
        accepted = RNG.random() < p_accept
        # delivery succeeds if accepted and logistics work out (random breakdowns ~ reliability)
        delivered_ok = accepted and slack > 0 and RNG.random() < (0.72 + 0.25 * o["rel"])
        if not accepted:
            reason = ("Category not accepted" if not accepts else "No suitable storage" if not has_storage else
                      "Insufficient capacity" if cap_rem < qty * 0.5 else "Could not arrive before expiry" if slack <= 0 else
                      RNG.choice(["No response", "Declined: staff unavailable", "Declined: too far"]))
        elif not delivered_ok:
            reason = RNG.choice(["Vehicle unavailable", "Food expired before pickup", "Pickup missed"])
        else:
            reason = ""
        rows.append({
            "Data_Source": "synthetic",
            "Match_ID": None, "Donation_ID": f"DON{d_i+1:05d}", "Org_ID": o["Org_ID"],
            "Date": date.strftime("%Y-%m-%d"), "Time_Posted": f"{hour:02d}:{minute:02d}", "Day_of_Week": DOW[date.dayofweek],
            "Business_Type": r["Business_Type"], "Food_Category": cat, "Quantity_Units": qty, "Hours_To_Expiry": round(hours, 1),
            "Storage_Required": storage, "Donor_Area": donor_area,
            "Org_Name": o["Org_Name"], "Org_Type": o["Org_Type"], "Org_Area": o["Org_Area"],
            "Accepts_Category": "Yes" if accepts else "No", "Has_Required_Storage": "Yes" if has_storage else "No",
            "Daily_Capacity_Units": o["cap"], "Capacity_Remaining_Units": cap_rem, "Past_Acceptance_Rate": round(o["past_rate"], 3),
            "Open_At_Post_Time": "Yes" if open_now else "No", "Hours_Until_Open": round(until_open, 1),
            "Distance_km": round(dist, 2), "Est_Travel_Time_min": round(travel, 1),
            "Accepted": "Yes" if accepted else "No",
            "Delivered_Quantity": int(qty * RNG.uniform(0.9, 1.0)) if delivered_ok else 0,
            "Failure_Reason": reason,
            "Successful_Match": "Yes" if delivered_ok else "No",
        })

df = pd.DataFrame(rows)
# 2% label noise (real-world mistakes in records)
flip = RNG.random(len(df)) < 0.02
df.loc[flip, "Successful_Match"] = df.loc[flip, "Successful_Match"].map({"Yes": "No", "No": "Yes"})
df = df.sort_values(["Date", "Time_Posted", "Donation_ID"]).reset_index(drop=True)
df["Match_ID"] = [f"MAT{i+1:06d}" for i in range(len(df))]
clean_copy = df.copy()

# ------------------------------------------------------------------ make it MESSY (for preprocessing practice)
n = len(df)
def pick(frac):
    return RNG.random(n) < frac

for col, frac in [("Distance_km", 0.03), ("Capacity_Remaining_Units", 0.025), ("Past_Acceptance_Rate", 0.03), ("Storage_Required", 0.02),
                  ("Hours_To_Expiry", 0.02), ("Org_Type", 0.01), ("Est_Travel_Time_min", 0.02)]:
    df.loc[pick(frac), col] = np.nan

df = df.astype({"Distance_km": object, "Past_Acceptance_Rate": object, "Time_Posted": object, "Date": object, "Quantity_Units": object, "Hours_To_Expiry": object, "Capacity_Remaining_Units": object})
m = pick(0.06) & df["Storage_Required"].notna()
df.loc[m, "Storage_Required"] = df.loc[m, "Storage_Required"].map({"Refrigerated": RNG.choice(["refrigerated", "Fridge", "CHILLED"]), "Frozen": RNG.choice(["frozen", "Freezer"]), "Ambient": RNG.choice(["ambient", "Room Temp"])})
for col in ["Accepts_Category", "Has_Required_Storage", "Open_At_Post_Time", "Successful_Match", "Accepted"]:
    m = pick(0.04)
    df.loc[m, col] = df.loc[m, col].map({"Yes": RNG.choice(["yes", "Y", "TRUE"]), "No": RNG.choice(["no", "N", "FALSE"])})
m = pick(0.03) & df["Org_Type"].notna(); df.loc[m, "Org_Type"] = df.loc[m, "Org_Type"].astype(str).str.lower() + " "
m = pick(0.03); df.loc[m, "Food_Category"] = df.loc[m, "Food_Category"].str.upper()
m = pick(0.03) & df["Distance_km"].notna(); df.loc[m, "Distance_km"] = df.loc[m, "Distance_km"].astype(str) + " km"
m = pick(0.04)
df.loc[m, "Date"] = pd.to_datetime(df.loc[m, "Date"]).dt.strftime("%d/%m/%Y")
m = pick(0.03)
df.loc[m, "Time_Posted"] = pd.to_datetime(df.loc[m, "Time_Posted"], format="%H:%M").dt.strftime("%I:%M %p")
# impossible values
m = pick(0.003) & df["Distance_km"].apply(lambda v: isinstance(v, float) and not np.isnan(v)); df.loc[m, "Distance_km"] = -df.loc[m, "Distance_km"].astype(float)
m = pick(0.01) & df["Past_Acceptance_Rate"].notna(); df.loc[m, "Past_Acceptance_Rate"] = (df.loc[m, "Past_Acceptance_Rate"].astype(float) * 100).round(1)  # entered as %
m = pick(0.004) & df["Capacity_Remaining_Units"].notna(); df.loc[m, "Capacity_Remaining_Units"] = df.loc[m, "Daily_Capacity_Units"] * 3
m = pick(0.002); df.loc[m, "Quantity_Units"] = RNG.choice([0, -5], size=m.sum())
m = pick(0.002) & df["Hours_To_Expiry"].notna(); df.loc[m, "Hours_To_Expiry"] = 9999
# exact duplicate rows (~1%)
dups = df.sample(frac=0.01, random_state=3)
df = pd.concat([df, dups]).sort_values(["Match_ID"]).reset_index(drop=True)

df.to_csv("data/synthetic_donation_matching_dataset.csv", index=False)
clean_copy.to_csv("data/_reference_clean_unmessed.csv", index=False)  # for verifying the cleaning, not used in training

dictionary = pd.DataFrame([
    ("Data_Source", "string", "Always 'synthetic' — this dataset is simulated, not real platform records.", "info"),
    ("Match_ID", "string", "Unique id of one donation offered to one organization (e.g. MAT000001).", "id"),
    ("Donation_ID", "string", "Donation identifier; one donation is offered to 4–6 candidate organizations.", "id"),
    ("Org_ID", "string", "Organization identifier (fictional organization).", "id"),
    ("Date", "string (date)", "Date the donation was posted. Mixed formats YYYY-MM-DD and DD/MM/YYYY.", "feature (day of week)"),
    ("Time_Posted", "string (time)", "Time posted. Mixed formats HH:MM and hh:mm AM/PM.", "feature (hour)"),
    ("Day_of_Week", "categorical", "Weekday of the donation.", "feature"),
    ("Business_Type", "categorical", "Donor business type (from the Kaggle dataset): Restaurant, Supermarket, Cafeteria, Cloud Kitchen.", "feature"),
    ("Food_Category", "categorical", "Fruits, Vegetables, Dairy, Bakery, Meat, Prepared Food. Some values in UPPER CASE.", "feature"),
    ("Quantity_Units", "integer", "Units offered (sampled from Kaggle leftover stock). A few impossible values (0 or negative).", "feature"),
    ("Hours_To_Expiry", "float", "Hours until the food's safe-use deadline. ~2% missing, a few impossible 9999 values.", "feature"),
    ("Storage_Required", "categorical", "Ambient, Refrigerated or Frozen. Inconsistent spellings (Fridge, CHILLED, Room Temp...). ~2% missing.", "feature"),
    ("Donor_Area", "categorical", "Dhaka area of the donor.", "dropped (identity/location proxy; distance is used instead)"),
    ("Org_Name", "string", "Fictional organization name.", "dropped (identifier)"),
    ("Org_Type", "categorical", "NGO, Community Kitchen, Shelter, Food Bank, Orphanage. Some lower-case/trailing spaces, ~1% missing.", "feature"),
    ("Org_Area", "categorical", "Dhaka area of the organization.", "dropped (identity/location proxy)"),
    ("Accepts_Category", "Yes/No", "Whether the organization accepts this food category. Mixed Yes/yes/Y/TRUE.", "feature"),
    ("Has_Required_Storage", "Yes/No", "Whether it has the storage the food needs.", "feature"),
    ("Daily_Capacity_Units", "integer", "Units the organization can receive per day.", "feature"),
    ("Capacity_Remaining_Units", "integer", "Free capacity at posting time. ~2.5% missing, a few impossible values above daily capacity.", "feature"),
    ("Past_Acceptance_Rate", "float 0–1", "Share of earlier offers the organization completed. ~3% missing, ~1% entered as percentages (e.g. 85.0).", "feature"),
    ("Open_At_Post_Time", "Yes/No", "Whether the organization was open when the donation was posted.", "feature"),
    ("Hours_Until_Open", "float", "Hours until the organization opens (0 if open).", "feature"),
    ("Distance_km", "float", "Straight-line distance donor → organization. ~3% missing, some as text '3.4 km', a few negative.", "feature"),
    ("Est_Travel_Time_min", "float", "Estimated travel time in Dhaka traffic. ~2% missing.", "feature"),
    ("Accepted", "Yes/No", "Organization said yes. Known only AFTER the offer.", "LEAKAGE — not used as input"),
    ("Delivered_Quantity", "integer", "Units actually received. Known only after delivery.", "LEAKAGE — not used as input"),
    ("Failure_Reason", "string", "Why the match failed. Known only after the outcome.", "LEAKAGE — not used as input"),
    ("Successful_Match", "Yes/No (target)", "TARGET: organization accepted AND received the food before expiry. Includes ~2% label noise.", "target"),
], columns=["Column", "Data_Type", "Description", "Role"])
miss = (df.isna().mean() * 100).round(1)
dictionary["Missing_Pct"] = dictionary["Column"].map(miss).fillna(0)
dictionary.to_csv("data/synthetic_matching_data_dictionary.csv", index=False)

print(df.shape, "rows x cols |", df["Donation_ID"].nunique(), "donations |", N_ORGS, "organizations")
print("Successful_Match (clean copy):", clean_copy["Successful_Match"].value_counts(normalize=True).round(3).to_dict())
print("Accepted (clean copy):", clean_copy["Accepted"].value_counts(normalize=True).round(3).to_dict())
