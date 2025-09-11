# VS30 Web Map Service

This directory hosts the **VS30 map service** and web interface used by QuakeCoRE.  
It provides both:

- A static web frontend: [`/vs30`](https://quakecoresoft.canterbury.ac.nz/vs30)  
- A QGIS Server WMS backend: [`/wms_vs30`](https://quakecoresoft.canterbury.ac.nz/wms_vs30)

Both are now served directly from **ucquakecore2p** using a QGIS Server Docker container.

---

## 1. Data and Project Setup

Clone this repository on **ucquakecore2p**:

```bash
cd /var/www
git clone https://github.com/ucgmsim/mapping.git
```
Copy the VS30 static site and QGIS project/data into place:
- **Static web files**
```bash
sudo mkdir -p /var/www/Vs30
sudo cp -r mapping/mapbox/vs30/static/* /var/www/Vs30/
```
- **QGIS project and data**
Download the latest version of [Vs30map data](https://www.dropbox.com/scl/fi/w7bk2w9a6hrxnk2a2wbbx/vs30map_data_2023.zip?rlkey=sndqdtkd6dga864lryfa7s5cs&st=k2ezv449&dl=1) (2023 edition), unzip and place it in `/var/www/`
```bash
(py310) qcadmin@ucquakecore2p:~$ ls /var/www/vs30map_data/
basins.tif                    combined.tif              gid.tif             slope.tif.aux.xml        tid.tif.aux.xml
basins.tif.aux.xml            combined_mvn.tif          gid.tif.aux.xml     terrain.tif              vs30.qgs
...
```
**Tip**: Keep vs30.qgs and all referenced TIFFs/shapefiles in the same folder so that paths resolve correctly.

- **(Advanced) Updating Vs30 map data** 
You may need to update the project file when the data changes (eg: updated `.tif` dataset). This is because the colour scale may need to be adjusted for a new range.
This will need QGIS Desktop software.
Open the project (vs30.qgs), edit properties of the layer.
<img width="510" alt="Screen Shot 2021-09-01 at 10 48 52 AM" src="https://user-images.githubusercontent.com/466989/131585718-4b27a6e0-364c-45bf-9d9c-ae01e809df43.png">

QGIS is a little fiddly here. To make sure the min and max are updated, try some random values for min and max (e.g. 0 and 1000), select User defined, and click apply. Then change it to Min/max and apply again. This should find a new Min and Max values.
<img width="1063" alt="Screen Shot 2021-09-01 at 10 18 22 AM" src="https://user-images.githubusercontent.com/466989/131585393-e94bddf7-87f4-41df-b209-9c138a5d350d.png">

Click "Classify" and make sure the color scale now uses the new Min and Max values.

<img width="869" alt="Screen Shot 2021-09-01 at 10 50 06 AM" src="https://user-images.githubusercontent.com/466989/131586674-3d00b6f9-01ed-44bd-a971-b2c2934fb69f.png">

Also note that the number of steps in the colour scale or labels for each colour may have been customised so you will need to make those changes again.
Save the file. You will have to copy `vs30.qgs` and files to `/var/www/vs30map_data` again.

- **Advertised URL**
As the data is hosted at hypocentre behind the UC firewall, external users can not access the data via wms_vs30 endpoint, as it will expose the internal hostname's URL. This can be resolved by enforcing Advertised URL in the QGIS Server setting. 
In QGIS Desktop, open vs30.qgs → Project Properties → QGIS Server → set **Advertised URL** to:
```
https://quakecoresoft.canterbury.ac.nz/wms_vs30
```

![image](https://github.com/user-attachments/assets/90564328-8f35-473b-8f13-507d69636129)

Save the project and redeploy if updated.

## 2. QGIS Server with Docker
See this [page](../README.md) and follow installation instruction for QGIS Server with Docker.


## 3. Nginx Configuration
Edit `/etc/nginix/site-enabled/000-quakecore`
Ensure these blocks are present:
```nginx
# Static frontend
location /vs30 {
    alias /var/www/Vs30;
    try_files $uri $uri/ /vs30/index.html;
}

# QGIS WMS backend
location /wms_vs30 {
    gzip off;
    include fastcgi_params;

    fastcgi_param SCRIPT_FILENAME qgis_mapserv.fcgi;
    fastcgi_param SCRIPT_NAME     /wms_vs30;
    fastcgi_param PATH_INFO       "";

    fastcgi_param REQUEST_METHOD  $request_method;
    fastcgi_param QUERY_STRING    $query_string;
    fastcgi_param CONTENT_TYPE    $content_type;
    fastcgi_param CONTENT_LENGTH  $content_length;
    fastcgi_param REQUEST_URI     $request_uri;
    fastcgi_param SERVER_PROTOCOL $server_protocol;
    fastcgi_param REMOTE_ADDR     $remote_addr;
    fastcgi_param SERVER_NAME     $host;

    fastcgi_param QGIS_SERVER_LOG_STDERR 1;
    fastcgi_param QGIS_SERVER_LOG_LEVEL  0;

    fastcgi_pass 127.0.0.1:8008;
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
## 4. Testing
- Open the frontend: https://quakecoresoft.canterbury.ac.nz/vs30
- Test WMS GetCapabilities:
```perl
https://quakecoresoft.canterbury.ac.nz/wms_vs30?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0
```
- Test GetMap (example):
```perl
https://quakecoresoft.canterbury.ac.nz/wms_vs30?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:4326&BBOX=165,-48,179,-34&WIDTH=800&HEIGHT=600&LAYERS=Combined%20Vs30%20(m/s)&FORMAT=image/png
```
If you see errors, check:
```bash
journalctl -u qgis-vs30 -f
tail -n 100 /var/log/nginx/error.log
```

## 5. Notes
- Warnings like:
```
WARNING Python error: The extra plugin path '/io/plugins' does not exist!
INFO Server: No server python plugins are available

```
are **harmless** unless you actually plan to install custom server plugins.
- The Mapbox access token used by the frontend must allow requests from `quakecoresoft.canterbury.ac.nz`.

## Other Info
- Maintainer: Sung Bae
- Service lives on: ucquakecore2p.canterbury.ac.nz
- External entrypoints:
	- Static: `/vs30`
 	- WMS: `/wms/vs30`
  
## Integrting New Basin Data
When you wish to integrate new basin data, you need to generate a 100m grid data and determine which basin each grid point belongs to. 
Follow instructions in [this page](https://github.com/uggmsim/mapping/mapbox/vs30/scripts/basin_z_values/readme.md) 

You may need to update `basin2tif.py`, grouping multiple segments of the same basin together with the same index.

![Screen Shot 2021-09-01 at 11 14 51 AM](https://user-images.githubusercontent.com/466989/131588062-7584cba9-8bd6-4f95-b117-8069910c2a08.png)

After that, update `map.js` and add new basin names

![Screen Shot 2021-09-01 at 11 16 27 AM](https://user-images.githubusercontent.com/466989/131588093-80383082-5675-48fc-92f9-af37dfbfef66.png)

Note that map.js alongside index.html are hosted on /var/www/Vs30 @ ucquakecore2p server

