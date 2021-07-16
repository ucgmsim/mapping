# Interactive web interface for Vs30

## Requirements
* static webserver
* v3 <= QGIS server <= v3.16 - versions prior to ~3 won't have JSON support, 3.18 introduces better support for continuous colour palettes but will produce undesirable results with this repo. To fix, the height of the legend for the continuous block should be made greater and discrete data such as IDs should be made to show discrete for 3.18+.

## Mapbox Service Requirements
Map data is hosted by Mapbox. Currently this just contains the standard satelite imagery along with the vs30 points which should be updated via the studio.mapbox.com tilesets section. To make updates more simple, vs30 points can be formatted as geojson and loaded from a static file from the webserver using mapbox gl js.
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
More information: [https://docs.qgis.org/3.16/en/docs/server_manual/getting_started.html]<br />
QGIS Server capabilities: [https://docs.qgis.org/en/docs/server_manual/services.html]

NGINX configuration:
link server root or copy files to server root
```
ln -s <vs30/static> <server-root>
```
Server root loads the static component, add the gateway location `/wms_vs30`:
Specifying default project file means it doesn't have to be specified by the client URL.
```
server {
    ...

    location /wms_vs30 {
        gzip off;
        include fastcgi_params;
        fastcgi_param  QGIS_SERVER_LOG_STDERR  1;
        fastcgi_param  QGIS_SERVER_LOG_LEVEL   0;
        fastcgi_param  QGIS_PROJECT_FILE /path/to/vs30.qgs;
        fastcgi_pass unix:/run/qgisserver.socket;
    }
}
```

Don't forget to add the GeoTIFF files into the qgis directory containing the qgs project file.
And then access it at [http://hostname.canterbury.ac.nz](http://hostname.canterbury.ac.nz) for the map access token to work.
