#!/usr/bin/env python
"""
One-off run script for converting raw numpy array into GeoTIF.
GeoTIF is used by QGIS.
Script may need changes depending on how input data was generated.
Therefore, time should not be spent to make it overly user friendly with argparse etc.
Especially until workflow is finalised.
"""

import numpy as np
from osgeo import gdal, osr
import pandas as pd

# get location range of useful values
# assuming original was EPSG:2193 grid with coords ending in half resolution
# eg: 1000m grid has eastings and northings ending in 500 always.
# columns: easting, northing
half_res = 500
df = pd.read_csv("vs30points.csv", usecols=[2, 3], dtype=np.float32, engine="c")
max_east, max_north = (
    np.round(df.max().values / half_res).astype(np.int32) * half_res + 500
)
min_east, min_north = (
    np.round(df.min().values / half_res).astype(np.int32) * half_res - 500
)
nx = int((max_east - min_east) / (half_res * 2))
ny = int((max_north - min_north) / (half_res * 2))


# numpy array containting location, intensity_measure, return_period
data = np.load("nzs1170p5_1km.npy")
n_locations, n_im, n_rp = data.shape

# create output
driver = gdal.GetDriverByName("GTiff")
ods = driver.Create(
    "nzs1170p5.tif",
    xsize=nx,
    ysize=ny,
    bands=n_im * n_rp,
    eType=gdal.GDT_Float32,
    options=["COMPRESS=DEFLATE", "BIGTIFF=YES"],
)
t = (min_east, half_res * 2, 0, max_north, 0, half_res * -2)
ods.SetGeoTransform(t)
srs = osr.SpatialReference()
srs.ImportFromEPSG(2193)
ods.SetProjection(srs.ExportToWkt())

# fill output
x = np.floor((df.easting.values - t[0]) / t[1]).astype(np.int32)
y = np.floor((df.northing.values - t[3]) / t[5]).astype(np.int32)

for i in range(n_rp):
    for j in range(n_im):
        band = ods.GetRasterBand(1 + i * n_im + j)
        # skip description because qgis will still prepend "Band 00: " anyway
        # band.SetDescription(hex(i)[2:] + hex(j)[2:])
        band.SetNoDataValue(-1)
        # assume enough RAM to process whole raster
        values = np.full((ny, nx), -1, dtype=np.float32)
        values[(y, x)] = np.nan_to_num(data[:, j, i], nan=-1.0)
        band.WriteArray(values)
        # finalise
        band = None

# finalise file
ods = None


# numpy array containting location, intensity_measure, return_period
data = np.load("nzta.npy")
n_locations, n_rp = data.shape

# create output
driver = gdal.GetDriverByName("GTiff")
ods = driver.Create(
    "nzta.tif",
    xsize=nx,
    ysize=ny,
    bands=n_rp,
    eType=gdal.GDT_Float32,
    options=["COMPRESS=DEFLATE", "BIGTIFF=YES"],
)
ods.SetGeoTransform(t)
ods.SetProjection(srs.ExportToWkt())

# fill output
for i in range(n_rp):
    band = ods.GetRasterBand(1 + i)
    # skip description because qgis will still prepend "Band 00: " anyway
    # band.SetDescription(hex(i)[2:])
    band.SetNoDataValue(-1)
    # assume enough RAM to process whole raster
    values = np.full((ny, nx), -1, dtype=np.float32)
    values[(y, x)] = np.nan_to_num(data[:, i], nan=-1.0)
    band.WriteArray(np.where(values == 0, -1, values))
    # finalise
    band = None

# finalise file
ods = None
