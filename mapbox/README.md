# QGIS Server
QGIS server is used by `vs30` and `code_hazard` to provide map tiles on `Mapbox GL JS` maps.
The tiles can be placed between or above layers and will appear the same way they to when viewed in QGIS.
QGIS server allows a few other things such as retrieving the legend for the layer.
A `.qgs` project file contains a QGIS project which discribes layers and how they should be displayed.

## Installing QGIS server
To install QGIS server, follow the steps below. 
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
It seems the best version for Ubuntu/Debian is 3.10.14+dfsg-1. Version 3.18 and some newer versions (including latest version 3.38) were tested, but they have an issue with slow tile loading and squashed colorbar.

To resolve dependency issues, install the following packages in order. 

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





## QGIS Versions
Up to version 3.16, gradient display in legends is unsupported.
The docker image had version 3.16, you must edit the project in QGIS 3.16 or slightly older, opening the file in 3.18 will break the legends.
If the server is also updated, you may want to update the project to 3.18+ but make sure the legend settings are displayed as wanted:
- Discreet data such as group IDs shouldn't show a gradient in the legend.
- JS client retrieving legend may want larger legend box to stretch the gradient rather than being just a short box (GET params).


## Serving Map data with QGIS Server
Described in subfolders. 
