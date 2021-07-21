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
df = pd.read_csv("vs30points.csv", usecols=[2, 3, 7], dtype=np.float32, engine="c")
max_east, max_north = (
    np.round(df.max().values[:2] / half_res).astype(np.int32) * half_res + 500
)
min_east, min_north = (
    np.round(df.min().values[:2] / half_res).astype(np.int32) * half_res - 500
)
nx = int((max_east - min_east) / (half_res * 2))
ny = int((max_north - min_north) / (half_res * 2))
# more raster properties
t = (min_east, half_res * 2, 0, max_north, 0, half_res * -2)
srs = osr.SpatialReference()
srs.ImportFromEPSG(2193)
# index of locations in raster
x = np.floor((df.easting.values - t[0]) / t[1]).astype(np.int32)
y = np.floor((df.northing.values - t[3]) / t[5]).astype(np.int32)


def create_tif(filename, etype, bands=1):
    # create output
    driver = gdal.GetDriverByName("GTiff")
    ods = driver.Create(
        filename,
        xsize=nx,
        ysize=ny,
        bands=bands,
        eType=etype,
        options=["COMPRESS=DEFLATE", "BIGTIFF=YES"],
    )
    ods.SetGeoTransform(t)
    ods.SetProjection(srs.ExportToWkt())
    return ods


def auto_tif(
    array, out_file, zero_na=False, is_file=True, etype=gdal.GDT_Float32, replace=None
):
    na = 255 if etype is gdal.GDT_Byte else -1
    if is_file:
        data = np.load(array)
        # first dimension is location
        bands = int(np.prod(data.shape[1:]))
    else:
        bands = 1
    ods = create_tif(out_file, etype, bands=bands)

    for i in range(bands):
        # get data
        if not is_file:
            layer = array
        elif len(data.shape) == 2:
            layer = data[:, i]
        elif len(data.shape) == 1:
            layer = data[:]
        elif len(data.shape) == 3:
            layer = data[:, i % data.shape[1], i // data.shape[1]]

        # index based replacement array
        if replace is not None:
            replace = np.append(replace, na)
            layer = replace[np.nan_to_num(layer, nan=-1).astype(np.int32)]

        # put in tif
        band = ods.GetRasterBand(1 + i)
        band.SetNoDataValue(na)
        values = np.full((ny, nx), na, dtype=np.float32)
        values[(y, x)] = np.nan_to_num(layer, nan=na)
        if zero_na:
            band.WriteArray(np.where(values == 0, na, values))
        else:
            band.WriteArray(values)
        # finalise
        band = None
    ods = None


vs30 = df.geology_mvn_vs30.values
auto_tif("nzs1170p5_1km.npy", "nzs1170p5.tif")
auto_tif(vs30, "vs30.tif", is_file=False)
auto_tif(
    np.where(
        np.isnan(vs30),
        255,
        np.where(vs30 > 500, 0, 1),
    ),
    "siteclass.tif",
    is_file=False,
    etype=gdal.GDT_Byte,
)
auto_tif(
    np.where(
        np.isnan(vs30),
        255,
        np.where(
            vs30 < 180,
            4,
            np.where(
                vs30 < 350, 3, np.where(vs30 < 500, 2, np.where(vs30 < 2500, 1, 0))
            ),
        ),
    ),
    "nzs1170p5_siteclass.tif",
    is_file=False,
    etype=gdal.GDT_Byte,
)
auto_tif("NZS1170p5_Ch_values.npy", "ch.tif")
auto_tif("NZS1170p5_N_values.npy", "n.tif")
auto_tif("NZS1170p5_R_values.npy", "r.tif")
auto_tif("NZS1170p5_Z_values.npy", "z.tif")
auto_tif("NZTA_PGA_values.npy", "nzta.tif", zero_na=True)

# fmt: off
meff_50_250 = np.array([
    5.75, 5.75, 5.75, 5.75, 5.8, 5.8, 5.9, 5.9, 5.9, 5.9, 5.9, 5.8, 5.8, 5.9, 5.8,
    5.8, 5.8, 5.9, 5.9, 5.9, 5.9, 5.9, 5.9, 5.9, 6, 6, 6, 5.9, 5.9, 6, 6, 6.2, 6.1,
    6.1, 6.1, 6.3, 6.1, 6, 6.25, 6.4, 6.5, 6, 6, 6.1, 6.2, 6.1, 6.2, 6.2, 6, 6.2, 6.2,
    6.25, 6.2, 6.2, 6.25, 6.25, 6.3, 6.25, 6.3, 6.1, 6.1, 6.2, 6.2, 6.2, 6.3, 6.1,
    6.1, 6.2, 6.2, 6.2, 6.2, 6.2, 6.25, 6.2, 6.2, 5.8, 5.9, 6.1, 6.1, 6.1, 6.1, 5.7,
    6, 6.2, 6.5, 6.1, 6.6, 6.5, 6.3, 6.3, 6.4, 6.25, 6.4, 0, 6.25, 6.1, 6, 6, 6.1,
    6.2, 6, 6, 6.1, 6.1, 6.25, 6.3, 6.4, 6.5, 6.1, 6, 6, 6, 6, 6.4, 6.2, 6.2, 6.2,
    6.1, 6, 6.1, 6.1, 6.1
])
meff_500_2500 = np.array([
    5.75, 5.75, 5.75, 5.75, 5.8, 5.8, 5.9, 5.9, 5.9, 5.9, 5.9, 5.8, 5.8, 5.9, 5.8,
    5.8, 5.8, 5.9, 5.9, 5.9, 5.9, 5.9, 5.9, 5.9, 6, 6, 6, 5.9, 5.9, 6, 6, 6.2, 6.1,
    6.1, 6.1, 6.3, 6.1, 6, 6.25, 6.4, 6.5, 6, 6, 6.1, 6.2, 6.1, 6.2, 6.2, 6, 6.2, 6.2,
    6.25, 6.9, 6.9, 6.75, 6.75, 6.3, 6.25, 6.3, 6.7, 6.9, 7, 7, 7.1, 7, 6.7, 6.8, 6.8,
    6.9, 7.1, 7, 7.1, 7.1, 7.1, 7.1, 5.8, 5.9, 6.1, 6.6, 6.75, 6.9, 5.7, 6, 6.2, 7,
    6.7, 6.6, 6.5, 6.75, 7, 7.1, 6.25, 6.4, 0, 5.8, 6.1, 6, 6, 6.1, 6.9, 6, 6, 6.1,
    6.1, 6.25, 6.3, 6.4, 6.5, 7.1, 6, 6, 6, 6, 6.4, 6.2, 6.2, 6.2, 6.1, 6, 6.1, 6.1,
    6.1
])
# fmt: on
auto_tif("NZTA_town_index.npy", "nzta_meff50250.tif", replace=meff_50_250, zero_na=True)
auto_tif(
    "NZTA_town_index.npy", "nzta_meff5002500.tif", replace=meff_500_2500, zero_na=True
)
