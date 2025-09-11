# Mapbox Services Overview

This directory contains web mapping services powered by **QGIS Server** and displayed with **Mapbox GL JS**.  

Services currently deployed:

- [VS30](vs30/README.md)  
- [Code Hazard](code_hazard/README.md)  

Each service has its own README with **complete installation instructions**.

---

## QGIS Server

Both services use [QGIS Server](https://hub.docker.com/r/openquake/qgis-server) running in Docker on **ucquakecore2p**.  
QGIS Server renders layers from a `.qgs` project file as WMS/WMTS, which Mapbox GL JS then displays as a tiled overlay.  

- We use the **OpenQuake LTR** Docker image (`openquake/qgis-server:ltr`), exposing FastCGI on port 9993.  
- Nginx proxies FastCGI to public endpoints (`/wms_vs30`, `/wms_codehazard`).  
- Each service has a dedicated systemd unit to run QGIS Server in Docker.  

---

## Notes

- See [vs30/README.md](vs30/README.md) or [code_hazard/README.md](code_hazard/README.md) for detailed installation and configuration steps.  
- The old instructions referencing **Hypocentre** or direct QGIS installs are deprecated.  
