# Interactive web interface for Code Hazard

## Requirements
* static webserver
* QGIS server

## Mapbox Service Requirements
Map data is hosted by Mapbox. Currently this just contains the standard satelite imagery along with the NZTA points which should be updated via the studio.mapbox.com tilesets section. To make updates more simple, NZTA points can be formatted as geojson and loaded from a static file from the webserver using mapbox gl js.
The access token is limited to specific hosts which can be changed via the studio.mapbox.com account section. Subdomains have been allowed so should make local development possible without using a public access token as long as you use the full URL.

## Running
The website has a static portion with a QGIS server requirement (for the overlay tilesets, legend and value returning). The simplest setup is with the NGINX web server.
Start the QGIS Server, you should make this into a service if not already available:
```
spawn-fcgi -s /run/qgisserver.socket -U nginx -G nginx -n /usr/bin/qgis_mapserv.fcgi
```
The paths and accounts may be different by machine. Debian based distros are usually:
```
spawn-fcgi -s /run/qgisserver.socket -U www-data -G www-data -n /usr/lib/cgi-bin/qgis_mapserv.fcgi
```
More information: [https://docs.qgis.org/3.16/en/docs/server_manual/getting_started.html]
QGIS Server capabilities: [https://docs.qgis.org/en/docs/server_manual/services.html]

NGINX configuration:
link server root or copy files to server root
```
ln -s <code_hazard/static> <server-root>
```
Server root loads the static component, add the gateway location `/wms`:
Specifying default project file means it doesn't have to be specified by the client URL.
```
server {
    ...

    location /wms {
        gzip off;
        include fastcgi_params;
        fastcgi_param  QGIS_SERVER_LOG_STDERR  1;
        fastcgi_param  QGIS_SERVER_LOG_LEVEL   0;
        fastcgi_param  QGIS_PROJECT_FILE /path/to/code_hazard.qgs;
        fastcgi_pass unix:/run/qgisserver.socket;
    }
}
```

Don't forget to add the GeoTIFF files into the qgis directory containing the qgs project file. Data for the GeoTIFF files come from `npy` arrays and `npy2tif.py` creates the `tif` files.
And then access it at [http://hostname.canterbury.ac.nz](http://hostname.canterbury.ac.nz) for the map access token to work.
