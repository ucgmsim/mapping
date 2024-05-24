"""
This script generates a CSV file of stations that are within a basin.

The script takes a station file as input and generates a CSV file containing station names, longitudes, latitudes, NZGD longitudes, NZGD latitudes, and basin names.
If no station file is given, the script generates stations at every GRID_SPACING in the land mask and assigns random station names.
"""

from pathlib import Path
import time
import argparse

import numpy as np
import pandas as pd
from Velocity_Model.basins import basin_outlines_dict
from qcore import formats, point_in_polygon, coordinates, geo
import pygmt

GRID_SPACING = 100
BASIN_VER = "2.07"


def get_args():

    parser = argparse.ArgumentParser()
    arg = parser.add_argument
    arg(
        "--outfile",
        help="Path to the output CSV file",
        default=Path.cwd() / "sites_in_basin.csv",
    )
    arg(
        "--keep_outer_basin",
        help="Keep stations outside basins",
        action="store_true",
    )
    arg("--grid_spacing", help="Grid spacing in meters", default=GRID_SPACING)
    arg("--version", help=f"NZVM version. Default is {BASIN_VER}", default=BASIN_VER)

    parser = formats.station_file_argparser(parser=parser)  # add station file arguments
    return parser.parse_args()


if __name__ == "__main__":

    args = get_args()
    try:
        basin_outlines = basin_outlines_dict[args.version]
    except KeyError:
        raise ValueError(f"Basin outlines for version {args.version} not found")

    # Load the boundaries
    boundaries = {cur_ffp.stem: np.loadtxt(cur_ffp) for cur_ffp in basin_outlines}

    if (
        args.stat_file is None
    ):  # if no station file is given, use the land mask to generate stations at every GRID_SPACING
        # remove points in ocean
        maskvalues = [0, 1, 1, 1, 1]  # ocean / land / lake / island / pond.
        land_mask = pygmt.grdlandmask(
            region="NZ",
            spacing=f"{GRID_SPACING}e/{GRID_SPACING}e",
            maskvalues=maskvalues,
            resolution="f",
        )
        land_mask_array = land_mask.values  # M x N boolean values

        # Create an index array where land_mask_array is equal to 1.0 (land)
        land_indices = np.argwhere(
            land_mask_array == 1.0
        )  # returns (lat_index, lon_index) pairs
        # Use the land_indices to extract longitude and latitude values for land areas
        land_lat = land_mask.lat.values[land_indices[:, 0]]
        land_lon = land_mask.lon.values[land_indices[:, 1]]

        ll_points = np.column_stack(
            (land_lat, land_lon)
        )  # zip them into an array of (lat, lon) pairs
        stat_names = None
    else:
        station_df = formats.load_generic_station_file(
            args.stat_file,
            args.stat_name_col,
            args.lon_col,
            args.lat_col,
            args.other_cols,
            args.other_names,
            args.sep,
            args.skiprows,
        )
        ll_points = station_df[["lat", "lon"]].values
        stat_names = station_df.index.values

    zero_depths = np.zeros((ll_points.shape[0], 1))
    nztm_points = coordinates.wgs_depth_to_nztm(
        np.hstack((ll_points, zero_depths))
    )  # convert to NZGD lat and lon

    if stat_names is None:
        stat_names = [
            f"{i:06X}" for i in range(len(nztm_points))
        ]  # generate hexadecimal station names

    print(f"Number of points: {ll_points.shape[0]}")
    print(f"Number of basins {len(boundaries)}")

    df = pd.DataFrame(
        {
            "stat_name": stat_names,
            "lon": ll_points[:, 1],
            "lat": ll_points[:, 0],
            "NZGD_lon": nztm_points[:, 1],
            "NZGD_lat": nztm_points[:, 0],
        }
    )
    df = df.set_index("stat_name")

    basin_membership = np.full((ll_points.shape[0],), None, dtype=object)
    start_time = time.time()
    for basin_name, basin_outline in boundaries.items():
        is_inside_basin = point_in_polygon.is_inside_postgis_parallel(
            np.flip(ll_points, axis=1), basin_outline
        )  # flip the coordinates to (lon, lat) format
        basin_membership[is_inside_basin] = basin_name

    df["basin_name"] = basin_membership

    print(f"Took {time.time() - start_time}")

    # Filter the DataFrame to include only rows where 'basin_name' is not None
    if not args.keep_outer_basin:
        filtered_df = df[df["basin_name"].notna()]

        # Reset the index to have continuous row numbers
        filtered_df.reset_index(drop=True, inplace=True)
        df = filtered_df

    df.to_csv(args.outfile, header=False)  # no header line added to the top
    # CSV file will have the following columns: stat_name, lon, lat, NZGD_lon, NZGD_lat, basin_name
