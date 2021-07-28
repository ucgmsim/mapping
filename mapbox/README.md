# QGIS Server
QGIS server is used by `vs30` and `code_hazard` to provide map tiles on `Mapbox GL JS` maps.
The tiles can be placed between or above layers and will appear the same way they to when viewed in QGIS.
QGIS server allows a few other things such as retrieving the legend for the layer.
A `.qgs` project file contains a QGIS project which discribes layers and how they should be displayed.

## Updating QGS / Data
You may need to update the project file when the data changes (eg: updated `.tif` dataset). This is because the colour scale may need to be adjusted for a new range.
Open the project, edit properties of the layer, make sure auto range is selected and click apply to get the new range.
You may need to enter a digit in the new min or max and erase it before clicking apply again to make sure the new range is updated.
Also note that the number of steps in the colour scale or labels for each colour may have been customised so you will need to make those changes again.
Save the file, you may need to restart the server.

## QGIS Versions
Up to version 3.16, gradient display in legends is unsupported.
The docker image had version 3.16, you must edit the project in QGIS 3.16 or slightly older, opening the file in 3.18 will break the legends.
If the server is also updated, you may want to update the project to 3.18+ but make sure the legend settings are displayed as wanted:
- Discreet data such as group IDs shouldn't show a gradient in the legend.
- JS client retrieving legend may want larger legend box to stretch the gradient rather than being just a short box (GET params).

## Running QGIS Server
Described in subfolders. 
