from pathlib import Path
import time
import argparse

from numba import jit, njit
import numba
import numpy as np
import pandas as pd
from Velocity_Model.basins import basin_outlines_dict
#from basins import basin_outlines_dict
from qcore import geo, formats
import pygmt

GRID_SPACING = 100
BASIN_VER = "2.07"
basin_outlines = basin_outlines_dict[BASIN_VER]

@jit(nopython=True)
def is_inside_postgis(polygon, point):
    length = len(polygon)
    intersections = 0

    dx2 = point[0] - polygon[0][0]
    dy2 = point[1] - polygon[0][1]
    ii = 0
    jj = 1

    while jj<length:
        dx  = dx2
        dy  = dy2
        dx2 = point[0] - polygon[jj][0]
        dy2 = point[1] - polygon[jj][1]

        F =(dx-dx2)*dy - dx*(dy-dy2);
        if 0.0==F and dx*dx2<=0 and dy*dy2<=0:
            return 2;

        if (dy>=0 and dy2<0) or (dy2>=0 and dy<0):
            if F > 0:
                intersections += 1
            elif F < 0:
                intersections -= 1

        ii = jj
        jj += 1

    #print 'intersections =', intersections
    return intersections != 0


@njit(parallel=True)
def is_inside_postgis_parallel(points, polygon):
    ln = len(points)
    D = np.empty(ln, dtype=numba.boolean)
    for i in numba.prange(ln):
        D[i] = is_inside_postgis(polygon,points[i])
    return D

def get_args():

    parser = argparse.ArgumentParser()
    arg = parser.add_argument
    arg("--outfile", help="Path to the output CSV file", default=Path.cwd()/"sites_in_basin.csv")
    arg("--remove_not_in_basin", help="Remove stations not in basin", action='store_true')
    parser = formats.station_file_argparser(parser=parser)
    return parser.parse_args()


if __name__ == '__main__':
    args = get_args()

    # Load the boundaries
    boundaries = {cur_ffp.stem: np.loadtxt(cur_ffp) for cur_ffp in basin_outlines}

    if args.stat_file is None:
        # remove points in ocean
        maskvalues = [0, 1, 1, 1, 1] # ocean / land / lake / island / pond.
        land_mask = pygmt.grdlandmask(
            region="NZ", spacing=f"{GRID_SPACING}e/{GRID_SPACING}e", maskvalues=maskvalues, resolution="f"
        )
        land_mask_array = land_mask.values # M x N boolean values

        # Create an index array where land_mask_array is equal to 1.0 (land)
        land_indices = np.argwhere(land_mask_array == 1.0) # returns (lat_index, lon_index) pairs
        # Use the land_indices to extract longitude and latitude values for land areas
        land_lon = land_mask.lon.values[land_indices[:, 1]]
        land_lat = land_mask.lat.values[land_indices[:, 0]]
        #OR
        # land_indices = np.where(land_mask_array == 1.0) # returns a tuple of 2 arrays lat_index and lon_index
        # land_lon = land_mask.lon.values[land_indices[1]]
        # land_lat = land_mask.lat.values[land_indices[0]]

        ll_points = np.column_stack((land_lon, land_lat)) #zip them into an array of (lon, lat) pairs
        stat_names = None
    else:
        station_df = formats.load_generic_station_file(args.stat_file, args.stat_name_col, args.lon_col, args.lat_col,
                                               args.other_cols, args.other_names, args.sep, args.skiprows)
        ll_points = station_df[['lon','lat']].values
        stat_names = station_df.index.values


    nztm_points = geo.wgs_nztm2000x(ll_points) # convert to NZGD lon and NZGD lat
    if stat_names is None:
        stat_names = [f'{i:06X}' for i in range(len(nztm_points))] # generate hexadecimal station names

    print(f"Number of points: {ll_points.shape[0]}")
    print(f"Number of basins {len(boundaries)}")


    df = pd.DataFrame({'stat_name':stat_names, 'lon': ll_points[:,0], 'lat': ll_points[:,1], 'NZGD_lon': nztm_points[:,0],'NZGD_lat': nztm_points[:,1]})
    df = df.set_index('stat_name')

    basin_membership = np.full((ll_points.shape[0],), None, dtype=object)
    start_time = time.time()
    for basin_name, basin_outline in boundaries.items():
        is_inside_basin = is_inside_postgis_parallel(ll_points, basin_outline)
        basin_membership[is_inside_basin] = basin_name

    df['basin_name'] = basin_membership

    print(f"Took {time.time() - start_time}")

    # Filter the DataFrame to include only rows where 'basin_name' is not None
    if args.remove_not_in_basin:
        filtered_df = df[df['basin_name'].notna()]

        # Reset the index to have continuous row numbers
        filtered_df.reset_index(drop=True, inplace=True)
        df = filtered_df

    df.to_csv(args.outfile, header=False) # no header line added to the top


    #to_print_csv = f"{ll_points[i][0]}, {ll_points[i][1]}, {nztm_points[i][0]}, {nztm_points[i][1]}, {True}, {outline_fp.name}\n"
    # to_print_ll = f"{ll_points[i][0]} {ll_points[i][1]} {nztm_points[i][0]}_{nztm_points[i][1]}\n"


