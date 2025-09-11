# QGIS Server

QGIS Server is used by `vs30` and `code_hazard` to provide map tiles for Mapbox GL JS maps.  
The tiles can be placed between or above layers and will appear the same way they do in QGIS Desktop.  
QGIS Server also supports other features such as returning layer legends or metadata.  

A `.qgs` project file contains a QGIS project which describes the layers and how they should be displayed.  
QGIS Server renders from that project and serves it as WMS/WMTS.

See more details in README pages of each service.

