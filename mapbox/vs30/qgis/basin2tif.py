#!/usr/bin/env python
"""
Script to simplify one-off conversion of basin csv data to tif.
Modify as needed, process not set.
"""

import numpy as np
from osgeo import gdal, osr
import pandas as pd

from vs30 import model, model_geology, params

# input params must be correct
X_SPACE = 500
Y_SPACE = 500
CSV_PATH = "/Users/sungbae/mapping/out_raster_100m.csv"
# output params
OUT_PATH = "basins.tif"
# misc
NODATA = 0
LAND_PATH = "tmp_mask.tif"
# basin config, update as needed
BASINS = {
    "BPVBoundary.txt": 1,
    "Cheviot_Polygon_WGS84.txt": 2,
    "CollingwoodBasinOutline_1_WGS84_v1.txt": 3,
    "CollingwoodBasinOutline_2_WGS84_v1.txt": 3,
    "CollingwoodBasinOutline_3_WGS84_v1.txt": 3,
    "Hanmer_Polygon_WGS84.txt": 4,
    "Kaikoura_Polygon_WGS84.txt": 5,
    "Karamea_basin_outline_v1_WGS84.txt": 6,
    "Marlborough_Polygon_WGS84_v0p1.txt": 7,
    "Murchison_Basin_Outline_v1_WGS84.txt": 8,
    "NE_otago_A_outline.txt": 9,
    "NE_otago_B_outline.txt": 9,
    "NE_otago_C_outline.txt": 9,
    "NE_otago_D_outline.txt": 9,
    "NE_otago_E_outline.txt": 9,
    "Nelson_Polygon_WGS84.txt": 10,
    "NewCanterburyBasinBoundary_WGS84_1m.txt": 11,
    "NorthCanterbury_Polygon_WGS84.txt": 12,
    "SpringsJ_basin_outline_v1_WGS84.txt": 13,
    "WaikatoHaurakiBasinEdge_WGS84.txt": 14,
    "WakatipuBasinOutlineWGS84.txt": 15,
    "WanakaOutlineWGS84.txt": 16,
    "Wellington_Polygon_Wainuiomata_WGS84.txt": 17,
    "alexandra_outline.txt": 18,
    "bal_outline_WGS84.txt": 19,
    "dun_outline_WGS84.txt": 20,
    "hakataramea_outline_WGS84.txt": 21,
    "mos_outline_WGS84.txt": 22,
    "ranfurly_outline.txt": 23,
    "waitaki_outline_WGS84.txt": 24,
    "HawkesBay1_Outline_WGS84_delim.dat": 25,
    "HawkesBay2_Outline_WGS84_delim.dat": 26,
    "HawkesBay3_Outline_WGS84_delim.dat": 27,
    "HawkesBay4_Outline_WGS84_delim.dat": 28,
    "Napier1_Outline_WGS84_delim.dat" : 29,
    "Napier2_Outline_WGS84_delim.dat" : 30,
    "Napier3_Outline_WGS84_delim.dat" : 31,
    "Napier4_Outline_WGS84_delim.dat" : 32,
    "Napier5_Outline_WGS84_delim.dat" : 33,
    "Napier6_Outline_WGS84_delim.dat" : 34,
    "mackenzie_basin_outline_nzmg.txt" : 35,
}


def load_input():
    # detect grid range given data spacing
    csv = pd.read_csv(CSV_PATH)
    xmin = csv["NZGD_lon"].min() - round(X_SPACE / 2)
    xmax = csv["NZGD_lon"].max() + round(X_SPACE / 2)
    ymin = csv["NZGD_lat"].min() - round(Y_SPACE / 2)
    ymax = csv["NZGD_lat"].max() + round(Y_SPACE / 2)
    grid = params.GridParams(
        xmin=xmin,
        xmax=xmax,
        dx=X_SPACE,
        ymin=ymin,
        ymax=ymax,
        dy=Y_SPACE,
    )
    return csv, grid


def create_landmask(grid):
    """
    Create a land masking tif sizing set by grid spec.
    outside land: nan, inside land: 1
    """
    # land mask algorithm requires full land coverage
    landgrid, gridmod = model_geology._full_land_grid(grid)
    ds = gdal.Rasterize(
        LAND_PATH,
        model_geology.COAST,
        creationOptions=["COMPRESS=DEFLATE", "BIGTIFF=YES"],
        outputBounds=[landgrid.xmin, landgrid.ymin, landgrid.xmax, landgrid.ymax],
        xRes=landgrid.dx,
        yRes=landgrid.dy,
        noData=0,
        burnValues=1,
        outputType=gdal.GetDataTypeByName("UInt16"),
    )
    ds = None
    if gridmod:
        # had to extend for land coverage, cut down to wanted size
        model.resample_raster(
            LAND_PATH,
            LAND_PATH,
            grid.xmin,
            grid.xmax,
            grid.ymin,
            grid.ymax,
            grid.dx,
            grid.dy,
        )
    # read result
    ds = gdal.Open(LAND_PATH, gdal.GA_ReadOnly)
    band = ds.GetRasterBand(1)
    mask = ds.ReadAsArray()
    band = None
    ds = None
    return mask


def create_tif(grid):
    # create output file
    driver = gdal.GetDriverByName("GTiff")
    # just keep ID band as float when could use uint8 in another tif
    ods = driver.Create(
        OUT_PATH,
        xsize=round((grid.xmax - grid.xmin) / X_SPACE),
        ysize=round((grid.ymax - grid.ymin) / Y_SPACE),
        bands=3,
        eType=gdal.GDT_Float32,
        options=["COMPRESS=DEFLATE", "BIGTIFF=YES"],
    )
    t = (grid.xmin, X_SPACE, 0.0, grid.ymax, 0.0, -Y_SPACE)
    ods.SetGeoTransform(t)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(2193)
    ods.SetProjection(srs.ExportToWkt())
    band_id = ods.GetRasterBand(1)
    band_z1p0 = ods.GetRasterBand(2)
    band_z2p5 = ods.GetRasterBand(3)
    band_id.SetNoDataValue(NODATA)
    band_z1p0.SetNoDataValue(NODATA)
    band_z2p5.SetNoDataValue(NODATA)
    return ods, t, {"id": band_id, "z1p0": band_z1p0, "z2p5": band_z2p5}


def fill_tif(csv, t, bands):
    # process all-at-once in ram
    x = np.floor((csv["NZGD_lon"].values - t[0]) / t[1]).astype(np.int32)
    y = np.floor((csv["NZGD_lat"].values - t[3]) / t[5]).astype(np.int32)
    z1p0 = bands["z1p0"].ReadAsArray()
    z1p0[[y, x]] = csv["Z1.0"].values
    bands["z1p0"].WriteArray(z1p0 * mask)
    del z1p0
    z2p5 = bands["z2p5"].ReadAsArray()
    z2p5[[y, x]] = csv["Z2.5"].values
    bands["z2p5"].WriteArray(z2p5 * mask)
    del z2p5
    ids = bands["id"].ReadAsArray()
    ids[[y, x]] = [BASINS[b] for b in list(map(str.strip, csv["basin_name"].values))]
    bands["id"].WriteArray(ids * mask)
    del ids


if __name__ == "__main__":
    csv, grid = load_input()
    mask = create_landmask(grid)
    # open tiff, transform and bands
    ds, t, bands = create_tif(grid)
    fill_tif(csv, t, bands)
    # closes tifs when exiting
