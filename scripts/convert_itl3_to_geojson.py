#!/usr/bin/env python3
"""
Zero-to-one converter: ONS ITL shapefile .zip -> Mapbox-ready GeoJSON.

- Unzips the downloaded shapefile .zip
- Finds all .shp files inside
- Assigns EPSG:27700 if CRS is missing (ONS default)
- Reprojects to EPSG:4326 (WGS84) for web maps
- Optionally simplifies geometry
- Saves GeoJSON into Next.js /public folder

Usage:
    python scripts/convert_itl3_to_geojson.py
"""

import zipfile
from pathlib import Path

import geopandas as gpd


# === CONFIGURE THESE PATHS ===

# Path to the ZIP you downloaded from ONS / ArcGIS
INPUT_ZIP = Path(
    "data/raw/International_Territorial_Level_3_(January_2025)_Boundaries_UK_BFC_V2.zip"
)

# Where to temporarily extract the shapefile contents
EXTRACT_DIR = Path(
    "data/raw/International_Territorial_Level_3_(January_2025)_Boundaries_UK_BFC_V2"
)

# Where to save the final GeoJSONs in your Next.js app
# (you can change this to whatever structure you like under /public)
OUTPUT_DIR = Path(
    "public/International_Territorial_Level_3_(January_2025)_Boundaries_UK_BFC_V2"
)

# Geometry simplification tolerance (in degrees, after reprojection to WGS84)
# Set to None to disable simplification, or tweak (e.g. 0.0005) if files are large
SIMPLIFY_TOLERANCE = 0.0002  # ~20m-ish at UK latitudes; adjust if needed


def unzip_if_needed(zip_path: Path, extract_dir: Path) -> None:
    """Unzip the shapefile archive if not already extracted."""
    extract_dir.mkdir(parents=True, exist_ok=True)

    # Simple heuristic: if directory is empty, unzip
    if any(extract_dir.iterdir()):
        print(f"[INFO] Extract directory already populated: {extract_dir}")
        return

    print(f"[INFO] Unzipping {zip_path} -> {extract_dir}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)
    print("[INFO] Unzip complete.")


def find_shapefiles(root: Path) -> list[Path]:
    """Return a list of all .shp files under root (recursive)."""
    shp_files = list(root.rglob("*.shp"))
    print(f"[INFO] Found {len(shp_files)} shapefile(s) in {root}")
    for shp in shp_files:
        print(f"       - {shp}")
    return shp_files


def convert_shp_to_geojson(shp_path: Path, output_dir: Path) -> Path:
    """
    Convert a single .shp to WGS84 GeoJSON.

    - Reads .shp with GeoPandas
    - Assigns EPSG:27700 if CRS is missing
    - Reprojects to EPSG:4326
    - Optionally simplifies geometry
    - Writes GeoJSON into output_dir with *_wgs84.geojson suffix
    """
    print(f"[INFO] Converting {shp_path.name}...")

    # Read shapefile
    gdf = gpd.read_file(shp_path)

    # Assign CRS if missing (ONS ITL / LAD are usually EPSG:27700)
    if gdf.crs is None:
        print("       [WARN] Input CRS missing. Assuming EPSG:27700 (British National Grid).")
        gdf = gdf.set_crs(epsg=27700)
    else:
        print(f"       [INFO] Input CRS: {gdf.crs.to_string()}")

    # Reproject to WGS84 (EPSG:4326) for Mapbox/web
    gdf = gdf.to_crs(epsg=4326)
    print("       [INFO] Reprojected to EPSG:4326 (WGS84).")

    # Optional geometry simplification
    if SIMPLIFY_TOLERANCE is not None:
        print(f"       [INFO] Simplifying geometry with tolerance={SIMPLIFY_TOLERANCE}...")
        gdf["geometry"] = gdf.geometry.simplify(
            SIMPLIFY_TOLERANCE, preserve_topology=True
        )

    # Prepare output path
    output_dir.mkdir(parents=True, exist_ok=True)
    out_name = shp_path.stem + "_wgs84.geojson"
    out_path = output_dir / out_name

    # Save as GeoJSON
    gdf.to_file(out_path, driver="GeoJSON")
    print(f"       [INFO] Saved GeoJSON -> {out_path}")

    return out_path


def main() -> None:
    # 1. Unzip the archive if needed
    if not INPUT_ZIP.exists():
        raise FileNotFoundError(f"Input ZIP not found: {INPUT_ZIP}")

    unzip_if_needed(INPUT_ZIP, EXTRACT_DIR)

    # 2. Find all .shp files
    shp_files = find_shapefiles(EXTRACT_DIR)
    if not shp_files:
        raise FileNotFoundError(f"No .shp files found under {EXTRACT_DIR}")

    # 3. Convert each .shp to GeoJSON
    output_paths = []
    for shp in shp_files:
        out = convert_shp_to_geojson(shp, OUTPUT_DIR)
        output_paths.append(out)

    print("\n[SUMMARY] Converted shapefiles:")
    for p in output_paths:
        print(f"  - {p}")
    print("\n[INFO] All done. You can now import these GeoJSON files in your Mapbox component.")


if __name__ == "__main__":
    main()
