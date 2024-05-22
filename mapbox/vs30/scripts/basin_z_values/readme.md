# Preparation for Vs30map update

This is an instruction on how to generate a file containing points *inside* known basins, and their Z-values.
The points are from 100m x 100m grid (hard-coded in gen_sites_in_basin.py), and we will be using v2.07 basins.

This manual is based on the assumption that you are using NeSI Maui.

## Generation of grid points within basins

(Duration: 15~30 mins)

Velocity_Model/Data has basins.yaml containing the list of basin models. 
Make sure this file contains all the basins you want, and their outline files are correctly listed.

```
- version: 2.07
  basins:
  - id: 26
    name: Hawke's Bay
    files:
      - Basins/Napier_Hawkes_Bay/v21p7/HawkesBay1_Outline_WGS84_delim.dat
      - Basins/Napier_Hawkes_Bay/v21p7/HawkesBay2_Outline_WGS84_delim.dat
      - Basins/Napier_Hawkes_Bay/v21p7/HawkesBay3_Outline_WGS84_delim.dat
      - Basins/Napier_Hawkes_Bay/v21p7/HawkesBay4_Outline_WGS84_delim.dat
...
```
Enter the following command.

`python gen_sites_in_basin.py`

This will generate 100m * 100m grid points, filter out offshore locations, and determines if a site is inside one of the 
specified basins.
The output is stored (by default) as "sites_in_basin.csv".
The `--keep_outer_basin` option keeps the sites even if they are not in 
any basins from the output file. This takes about 15 minutes on a good desktop PC.

If you have a station file containing station name, longitude and latitude, you can use it as an input.
You will need to specify the index for these columns as below. 

`python gen_sites_in_basin.py --stat_file station_file.csv --stat_name_col 0 --lat_col 1 --lon_col 2 --sep , --skiprows 1`


## Computing Z values for given locations

(Duration: 3~4 hours)

We will be computing Z values using NZVM. This requires quite a large memory (96Gb peak), and it is recommended to run on Maui using the supplied SLURM script.

Let's split the file into smaller files, with 80000 lines each.

```angular2html
(ringo310) seb56@c015kr:~/mapping/mapbox/vs30/scripts/basin_z_values$ mkdir splits
(ringo310) seb56@c015kr:~/mapping/mapbox/vs30/scripts/basin_z_values$ cd splits/
(ringo310) seb56@c015kr:~/mapping/mapbox/vs30/scripts/basin_z_values/splits$ split -l80000 -d -a4 ../sites_in_basin_whole_nz.csv sites_in_basin_whole_nz.csv_
(ringo310) seb56@c015kr:~/mapping/mapbox/vs30/scripts/basin_z_values/splits$ ls -ltr
total 407008
-rw-rw-r-- 1 seb56 seb56 7911070 Sep 29 15:46 sites_in_basin_whole_nz.csv_0000
-rw-rw-r-- 1 seb56 seb56 8045492 Sep 29 15:46 sites_in_basin_whole_nz.csv_0001
-rw-rw-r-- 1 seb56 seb56 8102851 Sep 29 15:46 sites_in_basin_whole_nz.csv_0002
-rw-rw-r-- 1 seb56 seb56 8119448 Sep 29 15:46 sites_in_basin_whole_nz.csv_0003
...
-rw-rw-r-- 1 seb56 seb56 9007784 Sep 29 15:46 sites_in_basin_whole_nz.csv_0044
-rw-rw-r-- 1 seb56 seb56 9001716 Sep 29 15:46 sites_in_basin_whole_nz.csv_0045
-rw-rw-r-- 1 seb56 seb56 9004491 Sep 29 15:46 sites_in_basin_whole_nz.csv_0046
-rw-rw-r-- 1 seb56 seb56 5924069 Sep 29 15:46 sites_in_basin_whole_nz.csv_0047

```
From above, we have 48 split files to process - if you have a different number, update the SLURM script.

In particular, you will need to enter as "47" below.
```
#SBATCH --array=0-47%4 # 48 array jobs with 4 jobs running at a time

```

Find your VMDIR as above and replace it in the below example

```
sbatch --export=ALL,VMDIR=/scale_wlg_persistent/filesets/home/baes/Velocity-Model get_z_values.sl # update the command therein to use the correct version eg. -v 2.07

```

This will keep 4 array jobs running at a time, each job takes less than 30 mins.

When everything is completed, merge all the output files into a single file
```
cd z_values
cat sites_in_basin_whole_nz.z_???? > ../sites_in_basin_whole_nz.z
cd ..
```

Finally, run the command below.

```
python combine_basin_stats_z.py sites_in_basin_whole_nz.csv sites_in_basin_whole_nz.z
```

This must be quick. It will create `basin_stats_z.csv` file.

```
NZGD_lon,NZGD_lat,in_basin,Z1.0,Z2.5,basin_name
1224800,5038100,True,0.045,0.275,WakatipuBasinOutlineWGS84.txt
1224800,5038200,True,0.045,0.275,WakatipuBasinOutlineWGS84.txt
1224800,5038300,True,0.045,0.275,WakatipuBasinOutlineWGS84.txt
...
```

You can use thie file as an input to run `basin2tif.py` to generate GeoTIFF for updating Vs30map. 
Follow the instructions given in https://github.com/ucgmsim/mapping/tree/master/mapbox/vs30 and run `basin2tif.py`
