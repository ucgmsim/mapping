# Interactive web interface for Vs30

## Requirements
* static webserver (hosted by ucquakecore2p)
* QGIS server (hosted by Hypocentre): version 3.10 is the best. Versions prior to ~3 won't have JSON support, 3.18 introduces better support for continuous colour palettes but will produce undesirable results with this repo. (To fix, the height of the legend for the continuous block should be made greater and discrete data such as IDs should be made to show discrete for 3.18+.)

## Mapbox Service Requirements
Map data is hosted by Mapbox. Currently this just contains the standard satelite imagery along with the vs30 points which should be updated via the studio.mapbox.com tilesets section. To make updates more simple, vs30 points can be formatted as geojson and loaded from a static file from the webserver using mapbox gl js.
The access token is limited to specific hosts which can be changed via the studio.mapbox.com account section. Subdomains have been allowed so should make local development possible without using a public access token as long as you use the full URL.

## Updating Vs30 map data
You may need to update the project file when the data changes (eg: updated `.tif` dataset). This is because the colour scale may need to be adjusted for a new range.
Open the project (vs30.qgs) on your computer, edit properties of the layer.
<img width="510" alt="Screen Shot 2021-09-01 at 10 48 52 AM" src="https://user-images.githubusercontent.com/466989/131585718-4b27a6e0-364c-45bf-9d9c-ae01e809df43.png">

QGIS is a little fiddly here. To make sure the min and max are updated, try some random values for min and max (e.g. 0 and 1000), select User defined, and click apply. Then change it to Min/max and apply again. This should find a new Min and Max values.
<img width="1063" alt="Screen Shot 2021-09-01 at 10 18 22 AM" src="https://user-images.githubusercontent.com/466989/131585393-e94bddf7-87f4-41df-b209-9c138a5d350d.png">

Click "Classify" and make sure the color scale now uses the new Min and Max values.

<img width="869" alt="Screen Shot 2021-09-01 at 10 50 06 AM" src="https://user-images.githubusercontent.com/466989/131586674-3d00b6f9-01ed-44bd-a971-b2c2934fb69f.png">

Also note that the number of steps in the colour scale or labels for each colour may have been customised so you will need to make those changes again.
Save the file.

## Advertised URL ##
![image](https://github.com/user-attachments/assets/90564328-8f35-473b-8f13-507d69636129)

As the data is hosted at hypocentre behind the UC firewall, external users can not access the data via wms_vs30 endpoint, as it will expose the internal hostname's URL. This can be resolved by enforcing Advertised URL in the QGIS Server setting. 

## Work with QGIS server
Upload the saved project file (vs30.qgs) to /var/www/vs30map_data at Hypocentre, and restart the server.

```
sudo service qgis-server restart
```

Note that /etc/nginx/site-enabled/default has this entry.
Server root loads the static component, add the gateway location `/wms_vs30`:
Specifying default project file means it doesn't have to be specified by the client URL.

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

### Firewall
Note that we will be using port 8008, not the default 80. You might need to tell firewall to allow the traffic on the port.

```
sudo ufw allow 8008
```

### Troubleshooting

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

### Testing

Test if this works by entering http://hypocentre.canterbury.ac.nz:8008/wms_vs30. If you see a page similar to this, it is all good.

![image](https://github.com/user-attachments/assets/5574aad4-1f5a-467a-9e2c-f83beb6a8842)

## Configure nginx on ucquakecore2p host (external facing)

`ucquakecore2p` is the webserver that can serve the web traffic to/from `quakecoresoft.canterbury.ac.nz`

We have the static portion of Vs30 map service hosted at /var/www/Vs30, which includes `index.html` and `map.js` that sends out requests to an endpoint `/wms_vs30`, which is served by Hypocenter QGIS server. So we have the NGINX configured as below.

`/etc/nginx/sites-enabled/001-quakecore`
```
    location  /vs30 {
        alias /var/www/Vs30;
    }

    location /wms_vs30 {
         proxy_pass "http://hypocentre.canterbury.ac.nz:8008/wms_vs30";
         proxy_read_timeout 12s;
    }

```
You need to restart NGINX server

```
sudo systemctl restart nginx
```
Go to https://quakecoresoft.canterbury.ac.nz/vs30. If you see this page, fantastic.

![image](https://github.com/user-attachments/assets/42ab2c05-c5fe-47f0-84e5-d27d62b449e4)


## Basin Data
You need to generate a 100m grid data and which basin each grid point belongs to. Follow instructions in [this page](https://github.com/uggmsim/mapping/mapbox/vs30/scripts/basin_z_values/readme.md) 


Then update and run `basin2tif.py`. ￼

When adding new basins, update `basin2tif.py`, grouping multiple segments of the same basin together with the same index.

![Screen Shot 2021-09-01 at 11 14 51 AM](https://user-images.githubusercontent.com/466989/131588062-7584cba9-8bd6-4f95-b117-8069910c2a08.png)

After that, update `map.js` and add new basin names

![Screen Shot 2021-09-01 at 11 16 27 AM](https://user-images.githubusercontent.com/466989/131588093-80383082-5675-48fc-92f9-af37dfbfef66.png)

Note that map.js alongside index.html are hosted on /var/www/Vs30 @ ucquakecore2p server

### Summary of Steps.
1. Run basin2tif.py and produce basins.tif. 
2. Copy this to where vs30.qgs is located. Open vs30.qgs with QGIS. Make it find basins.tif at ./basins.tif
3. Update color scale for each property.
4. Save vs30.qgs
5. Copy vs30.qgs and basins.tif to /var/www/vs30map_data @ Hypocentre
6. Copy map.js to /var/www/Vs30 @ ucquakecore2p (it might have updates to `NAME_BASIN` list)
7. Restart qgis server at Hypocentre.
8. Check the service status - if .tif files are not found, edit vs30.qgs with an editor and fix the paths.
