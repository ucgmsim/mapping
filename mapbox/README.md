# QGIS Server
QGIS server is used by `vs30` and `code_hazard` to provide map tiles on `Mapbox GL JS` maps.
The tiles can be placed between or above layers and will appear the same way they to when viewed in QGIS.
QGIS server allows a few other things such as retrieving the legend for the layer.
A `.qgs` project file contains a QGIS project which discribes layers and how they should be displayed.

## Installing QGIS server
It seems the best version for Ubuntu/Debian is 3.10.14+dfsg-1 as the color bars are squashed in later versions and they tend to load tiles very slowly. 
To install this specific version, 
```
sudo mkdir -m755 -p /etc/apt/keyrings  # not needed since apt version 2.4.0 like Debian 12 and Ubuntu 22 or newer
sudo wget -O /etc/apt/keyrings/qgis-archive-keyring.gpg https://download.qgis.org/downloads/qgis-archive-keyring.gpg
sudo vim /etc/apt/sources.list.d/qgis.sources
```
and edit

```
(mamba310) seb56@hypocentre:~$ cat /etc/apt/sources.list.d/qgis.sources
Types: deb deb-src
URIs: https://qgis.org/debian
Suites: bullseye <== your distribution codename `lsb_release -c`
Architectures: amd64
Components: main
Signed-By: /etc/apt/keyrings/qgis-archive-keyring.gpg

```
Then 

```
sudo apt update
```
We are installing version 3.10.14 to avoid slow tile loading and squashed colorbar issue found in later versions (It seems version 3.18 and later, including the latest version 3.38 have these issues). To resolve dependency issues, install the following packages in order. 

```
sudo apt install python3-qgis-common=3.10.14+dfsg-1 qgis-providers-common=3.10.14+dfsg-1
sudo apt install python3-qgis=3.10.14+dfsg-1 qgis-providers=3.10.14+dfsg-1
sudo apt install qgis-server=3.10.14+dfsg-1
```

We will make the QGIS server automatically started by setting up a service


Edit a service definition in `/etc/systemd/system/qgis-server.service`

```
[Unit]
Description=QGIS server
After=network.target

[Service]
;; set env var as needed
Environment="LANG=en_EN.UTF-8"
Environment="QGIS_SERVER_PARALLEL_RENDERING=1"
Environment="QGIS_SERVER_MAX_THREADS=12"
Environment="QGIS_SERVER_LOG_LEVEL=0"
Environment="QGIS_SERVER_LOG_STDERR=1"
;; or use a file:
;EnvironmentFile=/etc/qgis-server/env

ExecStart=spawn-fcgi -s /var/run/qgisserver.socket -U www-data -G www-data -n /usr/lib/cgi-bin/qgis_mapserv.fcgi

[Install]
WantedBy=multi-user.target
```
Then enable and start the service

```
systemctl enable --now qgis-server
```
If everything went well, it should have created a socket `/var/run/qgisserver.socket`.





## Updating QGS / Data
You may need to update the project file when the data changes (eg: updated `.tif` dataset). This is because the colour scale may need to be adjusted for a new range.
Open the project (vs30.qgs) on your computer, edit properties of the layer.
<img width="510" alt="Screen Shot 2021-09-01 at 10 48 52 AM" src="https://user-images.githubusercontent.com/466989/131585718-4b27a6e0-364c-45bf-9d9c-ae01e809df43.png">

QGIS is a little fiddly here. To make sure the min and max are updated, try some random values for min and max (eg.0 and 1000), select User defined, and click apply. Then change it to Min/max and apply again. This should find a new Min and Max values.
<img width="1063" alt="Screen Shot 2021-09-01 at 10 18 22 AM" src="https://user-images.githubusercontent.com/466989/131585393-e94bddf7-87f4-41df-b209-9c138a5d350d.png">

Click "Classify" and make sure the color scale now uses the new Min and Max values.

<img width="869" alt="Screen Shot 2021-09-01 at 10 50 06 AM" src="https://user-images.githubusercontent.com/466989/131586674-3d00b6f9-01ed-44bd-a971-b2c2934fb69f.png">

Also note that the number of steps in the colour scale or labels for each colour may have been customised so you will need to make those changes again.
Save the file, and upload to /var/www/vs30map_data at Hypocentre (10.195.0.37), and restart the server.

```
sudo service qgis-server restart
```

Note that /etc/nginx/site-enabled/default has this entry

```
server {
	listen 8008;
	server_name hypocentre.canterbury.ac.nz;
...

	location /wms_vs30 {
		gzip off;
		include fastcgi_params;
		fastcgi_param  QGIS_SERVER_LOG_STDERR  1;
		fastcgi_param  QGIS_SERVER_LOG_LEVEL   0;
		fastcgi_param  QGIS_PROJECT_FILE /var/www/vs30map_data/vs30.qgs;
		fastcgi_pass unix:/var/run/qgisserver.socket;
	}
}

```
which can be controlled with `sudo service nginx {start|stop|restart|status}` command. Note that it uses `/var/run/qgisserver.socket`. 


If something goes wrong, you can check the status by
```
sudo service qgis-server status
```

vs30.qgs may not be able to find the path to TIFF files. 

```
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/combined_mvn.tif: No such fil>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/geology_mvn.tif: No such file>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/geology_mvn.tif: No such file>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/gid.tif: No such file or dire>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/slope.tif: No such file or di>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/terrain_mvn.tif: No such file>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/terrain_mvn.tif: No such file>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/tid.tif: No such file or dire>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: ERROR 4: /../../Vs30/vs30/data/basins.tif: No such file or d>
Aug 31 18:10:25 UCRCC0304 spawn-fcgi[971561]: More than 1000 errors or warnings have been reported. No mor>
~
```
This happens because the QGIS software auto-finds the path to the local TIFF files and updates them, and the server can't find them.
It's best to keep the vs30.qgs and all TIFF files in the same directory, and if needed, vs30.qgs can be edited and you can fix the path manually.
```
  <customproperties/>
    <layer-tree-layer id="combined_mvn_da971f3a_6dc3_4e65_b7f5_e837a9e6040f" checked="Qt::Checked" source="./combined_mvn.tif" expanded="0" patch_size="-1,-1" legend_exp="" legend_split_behavior="0" name="Combined Vs30 (m/s)" providerKey="gdal">
```

## QGIS Versions
Up to version 3.16, gradient display in legends is unsupported.
The docker image had version 3.16, you must edit the project in QGIS 3.16 or slightly older, opening the file in 3.18 will break the legends.
If the server is also updated, you may want to update the project to 3.18+ but make sure the legend settings are displayed as wanted:
- Discreet data such as group IDs shouldn't show a gradient in the legend.
- JS client retrieving legend may want larger legend box to stretch the gradient rather than being just a short box (GET params).


## Running QGIS Server
Described in subfolders. 
