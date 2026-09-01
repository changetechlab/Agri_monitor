"""
get_uttarakhand_gp_boundaries.py

Downloads the bharatlas LGD Gram Panchayat (2024) polygon layer, inspects its
schema, filters it down to all of Uttarakhand, and exports:
  - one combined GeoJSON/Shapefile for the whole state
  - one GeoJSON per district (all 13 districts) for CHANGE TechLab's coverage area

Usage (VS Code terminal):
    pip install -r requirements_gp_boundary.txt
    python get_uttarakhand_gp_boundaries.py

Outputs (written into ./output/):
    all_india_columns_preview.txt          - column names + first rows (schema check)
    uttarakhand_gp.geojson                 - ALL Uttarakhand GPs (state-wide)
    uttarakhand_gp.shp (+ .dbf/.shx/.prj)   - same, as Shapefile
    by_district/<district_name>_gp.geojson - one file per district (13 files)
    district_summary.txt                   - GP count per district (sanity check)
    dharkot_search_results.txt             - any GP matching "Dharkot"/"धारकोट"
"""

import re
import sys
from pathlib import Path

import geopandas as gpd

# ---------------------------------------------------------------------------
# Source: bharatlas.com LGD Gram Panchayats (2024) — CC0-1.0, no login
# (~329 MB parquet, all-India, 3,19,287 GP polygons)
# ---------------------------------------------------------------------------
PARQUET_URL = (
    "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/"
    "admin/panchayats/LGD_panchayats.parquet"
)

# If streaming the URL fails, download it manually in a browser from
# https://bharatlas.com/view/lgd_panchayats and point this at the saved file.
LOCAL_PARQUET_PATH = r"LGD_panchayats.parquet"  # e.g. r"C:\Users\you\Downloads\LGD_panchayats.parquet"

# All 13 districts of Uttarakhand — used only for the sanity-check summary,
# not for filtering (filtering is done by state name, then grouped by
# whatever district column/values actually exist in the data).
UTTARAKHAND_DISTRICTS = [
    "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun",
    "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh",
    "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi",
]

OUT_DIR = Path("output")
DISTRICT_DIR = OUT_DIR / "by_district"


def load_source() -> gpd.GeoDataFrame:
    src = LOCAL_PARQUET_PATH or PARQUET_URL
    print(f"[1/6] Loading GP polygons from: {src}")
    print("      (~329 MB file, all-India — first load may take a few minutes)")
    try:
        gdf = gpd.read_parquet(src)
    except Exception as e:
        print(f"\n[ERROR] Could not read parquet directly ({e}).")
        print("Download it manually from https://bharatlas.com/view/lgd_panchayats")
        print("and set LOCAL_PARQUET_PATH at the top of this script.")
        sys.exit(1)
    print(f"      Loaded {len(gdf):,} GP polygons, CRS = {gdf.crs}")
    return gdf


def inspect_schema(gdf: gpd.GeoDataFrame) -> None:
    print("[2/6] Inspecting schema...")
    OUT_DIR.mkdir(exist_ok=True)
    with open(OUT_DIR / "all_india_columns_preview.txt", "w", encoding="utf-8") as f:
        f.write("COLUMNS:\n")
        f.write(", ".join(gdf.columns.tolist()))
        f.write("\n\nDTYPES:\n")
        f.write(str(gdf.dtypes))
        f.write("\n\nFIRST 5 ROWS (non-geometry columns):\n")
        f.write(gdf.drop(columns="geometry").head(5).to_string())
    print("      -> wrote output/all_india_columns_preview.txt (open this first!)")
    print("      Columns found:", list(gdf.columns))


def guess_column(gdf: gpd.GeoDataFrame, candidates: list[str]) -> str | None:
    cols_lower = {c.lower(): c for c in gdf.columns}
    for cand in candidates:
        for lower_name, real_name in cols_lower.items():
            if cand in lower_name:
                return real_name
    return None


def filter_uttarakhand(gdf: gpd.GeoDataFrame):
    print("[3/6] Filtering to Uttarakhand (all districts)...")

    state_col = guess_column(gdf, ["state_name", "stname", "state"])
    district_col = guess_column(gdf, ["district_name", "dtname", "district"])
    name_col = guess_column(gdf, ["gp_name", "panchayat_name", "name"])

    if not state_col or not district_col:
        print("      Could not auto-detect state/district columns.")
        print("      Open output/all_india_columns_preview.txt, find the right")
        print("      column names, and set STATE_COL / DISTRICT_COL manually.")
        sys.exit(1)

    print(f"      state column: '{state_col}' | district column: '{district_col}' "
          f"| name column: '{name_col}'")

    uk = gdf[gdf[state_col].astype(str).str.contains("uttarakhand", case=False, na=False)].copy()
    print(f"      Uttarakhand GPs total: {len(uk):,}")

    if len(uk) == 0:
        print("      [WARN] 0 matches — check the actual state value in the schema preview.")
        sys.exit(1)

    return uk, district_col, name_col


def export_statewide(uk: gpd.GeoDataFrame) -> None:
    print("[4/6] Exporting state-wide files...")
    uk.to_file(OUT_DIR / "uttarakhand_gp.geojson", driver="GeoJSON")
    uk.to_file(OUT_DIR / "uttarakhand_gp.shp")
    print("      -> output/uttarakhand_gp.geojson")
    print("      -> output/uttarakhand_gp.shp (+ .dbf/.shx/.prj)")


def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    return name.strip("_")


def export_by_district(uk: gpd.GeoDataFrame, district_col: str) -> None:
    print("[5/6] Splitting into per-district files (13 districts)...")
    DISTRICT_DIR.mkdir(parents=True, exist_ok=True)

    summary_lines = []
    found_districts = sorted(uk[district_col].astype(str).unique())
    print(f"      Distinct district values found in data: {found_districts}")

    for dist_value in found_districts:
        subset = uk[uk[district_col].astype(str) == dist_value]
        fname = f"{slugify(dist_value)}_gp.geojson"
        subset.to_file(DISTRICT_DIR / fname, driver="GeoJSON")
        summary_lines.append(f"{dist_value}: {len(subset):,} GPs -> by_district/{fname}")
        print(f"      {dist_value}: {len(subset):,} GPs")

    # Sanity check against the expected 13 districts
    matched = {d for d in UTTARAKHAND_DISTRICTS
               if any(d.lower() in fd.lower() or fd.lower() in d.lower() for fd in found_districts)}
    missing = set(UTTARAKHAND_DISTRICTS) - matched
    summary_lines.append("")
    summary_lines.append(f"Districts found: {len(found_districts)} (expected 13)")
    if missing:
        summary_lines.append(f"Possibly missing / name-mismatch: {sorted(missing)}")
        summary_lines.append("(check spelling/diacritics in the data vs. UTTARAKHAND_DISTRICTS list)")

    with open(OUT_DIR / "district_summary.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(summary_lines))
    print("      -> output/district_summary.txt")


def search_dharkot(uk: gpd.GeoDataFrame, name_col: str | None) -> None:
    print("[6/6] Searching for Dharkot GP by name...")
    results = []
    if name_col:
        matches = uk[uk[name_col].astype(str).str.contains("dharkot", case=False, na=False)]
        results.append(f"Matches on column '{name_col}': {len(matches)}")
        if len(matches):
            results.append(matches.drop(columns="geometry").to_string())
    else:
        results.append("Could not auto-detect a GP-name column — check schema preview.")

    with open(OUT_DIR / "dharkot_search_results.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(results))
    print("      -> output/dharkot_search_results.txt")


def main() -> None:
    gdf = load_source()
    inspect_schema(gdf)
    uk, district_col, name_col = filter_uttarakhand(gdf)
    export_statewide(uk)
    export_by_district(uk, district_col)
    search_dharkot(uk, name_col)
    print("\nDone. All 13 Uttarakhand districts (as found in the data) are in "
          "output/by_district/. Load rudraprayag_gp.geojson (or the matching "
          "file) into QGIS or your Agri Monitor js/layers.js as the real GP layer.")


if __name__ == "__main__":
    main()