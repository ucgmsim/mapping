// map layer ids on server
var ID_MEASURED = "measured-sites";
var ID_COM_MVN = "Combined Vs30 (m/s)";
var WMS_TILES = '/wms_vs30?service=WMS&version=1.3.0&request=GetMap&format=image/png&srs=EPSG:3857&transparent=true&width=256&height=256&BBOX={bbox-epsg-3857}&layer='
var WMS_LEGEND = '/wms_vs30?&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&STYLE=default&sld_version=1.1.0&layertitle=True&symbolwidth=16&symbolheight=9&itemfontsize=16&boxspace=2&symbolspace=0&iconlabelspace=4&LAYER='
var WMS_LEGEND_CAT = '/wms_vs30?&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&STYLE=default&sld_version=1.1.0&layertitle=True&symbolwidth=16&symbolheight=9&itemfontsize=16&boxspace=2&iconlabelspace=4&LAYER='
var WMS_VALUES = '/wms_vs30?service=WMS&version=1.3.0&request=GetFeatureInfo&info_format=application/json&width=20&height=20&i=10&j=10&crs=EPSG:4326'
var ACCESS_TOKEN = "pk.eyJ1Ijoic2Vpc3RlY2giLCJhIjoiY2tvdDZjYjNkMDdhNTJ3azc0YTlrZjR2MSJ9.OIyhZMUOlFfy54r2STMVDg";
var MAP_STYLE = "mapbox://styles/seistech/cknqzrykt0eim17pdaq79jkv2";
var PLACE_BELOW = "tunnel-street-minor-low";

var NAME_GEOCAT = [
    "0: Water",
    "1: Peat",
    "4: Fill",
    "5: Fluvial Estuarine",
    "6: Alluvium",
    "8: Lacustrine",
    "9: Beach Bar Dune",
    "10: Fan",
    "11: Loess",
    "12: Outwash",
    "13: Floodplain",
    "14: Moraine Till",
    "15: Undif Sed",
    "16: Terrace",
    "17: Volcanic",
    "18: Crystalline"
];
var NAME_TERCAT = [
    "1: Well dissected alpine summits, mountains, etc.",
    "2: Large volcano, high block plateaus, etc.",
    "3: Well dissected, low mountains, etc.",
    "4: Volcanic fan, foot slope of high block plateaus, etc.",
    "5: Dissected plateaus, etc.",
    "6: Basalt lava plain, glaciated plateau, etc.",
    "7: Moderately eroded mountains, lava flow, etc.",
    "8: Desert alluvial slope, volcanic fan, etc.",
    "9: Well eroded plain of weak rocks, etc.",
    "10: Valley, till plain, etc.",
    "11: Eroded plain of weak rocks, etc.",
    "12: Desert plain, delta plain, etc.",
    "13: Incised terrace, etc.",
    "14: Eroded alluvial fan, till plain, etc.",
    "15: Dune, incised terrace, etc.",
    "16: Fluvial plain, alluvial fan, low-lying flat plains, etc."
];
var NAME_BASIN = [
    "<unused_index>",
    "Banks Peninsula Volcanics",
    "Cheviot",
    "Collingwood",
    "Hanmer",
    "Kaikoura",
    "Karamea",
    "Marlborough",
    "Murchison",
    "NE Otago",
    "Nelson",
    "Canterbury",
    "North Canterbury",
    "Springs Junction",
    "Waikato / Hauraki",
    "Wakatipu",
    "Wanaka",
    "Wellington / Hutt Valley",
    "Alexandra",
    "Balclutha",
    "Dunedin",
    "Hakataramea",
    "Mosgiel",
    "Ranfurly",
    "Waitaki",
    "Hawke's Bay",
    "Napier",
    "Mackenzie",
    "Greater Wellington",
    "Porirua",
    "Gisborne",
    "SHB",
    "Wairarapa",
    "Motu Bay",
];


function roundmax(value, dp=6) {
    return Math.round((value + Number.EPSILON) * 10**dp) / 10**dp
}


function loaded() {
    $("#spinner").hide();
    $("#spinnero").hide();
}
function loading() {
    $("#spinner").show();
    $("#spinnero").show();
}


function load_map()
{
    mapboxgl.accessToken = ACCESS_TOKEN;
    map = new mapboxgl.Map({
        container: 'map',
        style: MAP_STYLE,
        center: [173.2995, -41.2728],
        zoom: 5,
    });

    // zoom and rotation controls
    map.addControl(new mapboxgl.NavigationControl({visualizePitch: true}));
    // distance scale
    map.addControl(new mapboxgl.ScaleControl({maxWidth: 200, unit: 'metric'}), 'bottom-right');
    // marker will be used whin location doesn't update with mousemove
    popup = new mapboxgl.Popup();
    marker = new mapboxgl.Marker().setPopup(popup);

    // control for layer to be visible
    var layers = document.getElementById('menu_layer')
        .getElementsByTagName('a');
    for (var i = 0; i < layers.length; i++) {
        layers[i].onclick = switch_layer;
    }

    map.on("click", map_mouseselect);
    map.on("mousemove", ID_MEASURED, function(e) {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('click', ID_MEASURED, show_measuredsite);
    map.on('mouseleave', ID_MEASURED, function() {
        map.getCanvas().style.cursor = '';
    });
    map.on('idle', loaded);
    map.on('dataloading', loading);
    map.on('load', function () {
        // note: measured sites can be loaded from geojson instead of mapbox
        map.addSource('qgis-wms', {
            'type': 'raster',
            'tiles': [WMS_TILES + ID_COM_MVN],
            'tileSize': 256
        });
        map.addLayer({
            'id': 'qgis-raster',
            'type': 'raster',
            'source': 'qgis-wms',
            'paint': {}
            },
            PLACE_BELOW
        );
        document.getElementById('img-legend').src = WMS_LEGEND + ID_COM_MVN;
        update_opacity();

        map.addSource('mapbox-dem', {
                      'type': 'raster-dem',
                       'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                       'tileSize': 512,
                       'maxzoom': 14
        });

        map.addLayer({
            'id': 'sky',
            'type': 'sky',
            'paint': {
                'sky-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 0, 5, 0.3, 8, 1
                ],
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun': getSunPosition(),
                'sky-atmosphere-sun-intensity': 5
            }
        });
    });
}


function show_measuredsite(e) {
    if (marker_clicked(e.point)) return;

    var feature = e.features[0];
    new mapboxgl.Popup({closeButton: true}).setLngLat(feature.geometry.coordinates)
        .setHTML('<strong>Site:</strong><p><table class="table table-sm"><tbody>' +
            '<tr><th scope="row">Easting</th><td>' + roundmax(feature.properties.easting) + '</td></tr>' +
            '<tr><th scope="row">Northing</th><td>' + roundmax(feature.properties.northing) + '</td></tr>' +
            '<tr><th scope="row">Vs30 (m/s)</th><td>' + feature.properties.vs30 + '</td></tr>' +
            '<tr><th scope="row">Standard Deviation</th><td>' + roundmax(feature.properties.uncertainty) + '</td></tr>' +
            '<tr><th scope="row">Geology Vs30</th><td>' + feature.properties.geology_vs30 + '</td></tr>' +
            '<tr><th scope="row">Geology StDev</th><td>' + roundmax(feature.properties.geology_stdv) + '</td></tr>' +
            '<tr><th scope="row">Terrain Vs30</th><td>' + feature.properties.terrain_vs30 + '</td></tr>' +
            '<tr><th scope="row">Terrain StDev</th><td>' + roundmax(feature.properties.terrain_stdv) + '</td></tr>' +
            '</tbody></table></p>')
        .addTo(map);
}


function enableDEM(exaggeration) {
    if (exaggeration === 0) {
        map.setTerrain(null);
    } else {
        map.setTerrain({
            'source': 'mapbox-dem',
            'exaggeration': exaggeration || 1.5
        });
    }
}


function disableDEM() {
    map.setTerrain(null);
}


function getSunPosition() {
    var center = map.getCenter();
    var sunPos = SunCalc.getPosition(
        Date.now(),
        center.lat,
        center.lng
    );
    var sunAzimuth = 180 + (sunPos.azimuth * 180) / Math.PI;
    var sunAltitude = 90 - (sunPos.altitude * 180) / Math.PI;
    return [sunAzimuth, sunAltitude];
}


function updateSunPosition() {
    map.setPaintProperty('sky', 'sky-atmosphere-sun', getSunPosition());
}


function follow_mouse(cb) {
    if (cb.checked) {
        map.on("mousemove", map_mouseselect);
        marker.remove();
    } else {
        map.off("mousemove", map_mouseselect);
    }
}


function retrieve_values(lngLat) {
    // bounding box made from expanded point
    var diff = 0.000001
    var bbox = (lngLat.lat - diff) + ',' + (lngLat.lng - diff) +
         ',' + (lngLat.lat + diff) + ',' + (lngLat.lng + diff)

    // abort previous request in case not completed
    if (xhr_values !== undefined) xhr_values.abort();

    xhr_values = $.ajax({
        type: "GET",
        url: WMS_VALUES + '&bbox=' + bbox +
            '&query_layers=Geology ID,Geology Vs30 (m/s),Terrain ID,Terrain Vs30 (m/s),Combined Vs30 (m/s),Slope,Coast Distance (m),Z 1.0',
        success: function(data) {
            update_values(data["features"]);
        },
        error: function(data) {
            if (data.statusText === "abort") return;
            alert("Failed to retrieve values.");
        }
    });
}


function update_values(features) {
    var lngLat = marker.getLngLat();
    var coast = features[6]["properties"]["Band 1: Distance to Coast (m)"];
    if (coast == "65535") coast = "65535+";
    popup_html = '<p class="h6">Slope: ' +
        roundmax(parseFloat(features[5]["properties"]["Band 1"])) +
        '<br />Coast Distance: ' + coast + ' m<p>';

    $("#gid_aak").val(NAME_GEOCAT[parseInt(features[0]["properties"]["Band 1: Geology ID Index"])]);
    $("#gid_yca").val(NAME_TERCAT[parseInt(features[2]["properties"]["Band 1: Terrain ID Index"]) - 1]);
    $("#aak_vs30").val(features[1]["properties"]["Band 1: Vs30"]);
    $("#aak_stdv").val(features[1]["properties"]["Band 2: Standard Deviation"]);
    $("#yca_vs30").val(features[3]["properties"]["Band 1"]);
    $("#yca_stdv").val(features[3]["properties"]["Band 2"]);
    $("#com_vs30").val(features[4]["properties"]["Band 1: Vs30"]);
    $("#com_stdv").val(features[4]["properties"]["Band 2: Standard Deviation"]);
    if (features[7]["properties"]["Band 1"] === "null" || features[7]["properties"]["Band 1"] === "0") {
        $("#id_basin").val("Outside Modelled Basin");
        $("#val_z1p0").val("NA");
        $("#val_z2p5").val("NA");
    } else {
        $("#id_basin").val(NAME_BASIN[parseInt(features[7]["properties"]["Band 1"])]);
        $("#val_z1p0").val(features[7]["properties"]["Band 2"]);
        $("#val_z2p5").val(features[7]["properties"]["Band 3"]);
    }

    if (lngLat === undefined) return;
    popup.setHTML(popup_html);
}


function map_lnglatselect(e, silent=false) {
    if (event.which == 13 || event.keyCode == 13 || silent) {
        var lng = document.getElementById("lon").value;
        var lat = document.getElementById("lat").value;
        lng = parseFloat(lng);
        lat = parseFloat(lat);
        if (isNaN(lng) || isNaN(lat)) {
            if (!silent) alert("Not a valid latitude / longitude.");
            return false;
        }
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            if (!silent) alert("Not a valid latitude / longitude.");
            return false;
        }

        var checkbox = document.getElementById("follow_mouse");
        checkbox.checked = false;
        follow_mouse(checkbox);

        map_runlocation(new mapboxgl.LngLat(lng, lat), false);
        return true;
    }
    return false;
}


function update_table() {
    // after switching layer, update values if applicable

    var checkbox = document.getElementById("follow_mouse");
    if (!checkbox.checked) {
        map_lnglatselect(null, silent=true);
    }
}


function map_mouseselect(e) {
    map_runlocation(e.lngLat, true);
}


function marker_clicked(cpos) {
    if ((marker.getLngLat() === undefined) || (marker._pos === null)) return false;
    // no api so use x,y coords
    var mpos = marker._pos;
    if (mpos.x - 15  < cpos.x && mpos.x + 15 > cpos.x
            && mpos.y - 15 < cpos.y && mpos.y + 15 > cpos.y) return true;
    return false;
}


function map_runlocation(lngLat, mouse=true) {
    var follow = document.getElementById("follow_mouse").checked;
    // don't move marker if clicked on a measured site and click based selection
    if (! follow && mouse) {
        var features = map.queryRenderedFeatures(map.project(lngLat));
        for (var i=0; i < features.length; i++) {
            if (features[i].layer.id === ID_MEASURED) return;
        }
    }
    // don't accept clicks on the marker
    if (! follow && mouse && marker_clicked(map.project(lngLat))) return;

    // update UI
    if (mouse) {
        document.getElementById("lon").value = roundmax(lngLat.lng);
        document.getElementById("lat").value = roundmax(lngLat.lat);
    }
    if (! follow) {
        marker.setLngLat([lngLat.lng, lngLat.lat]).addTo(map);
    }

    retrieve_values(lngLat);
}


function switch_layer(e) {
    var old_element = document.getElementById("menu_layer").getElementsByClassName("active")[0]
    old_element.classList.remove("active");
    e.target.classList.add("active");

    var layer = map.getSource("qgis-wms");
    var src = WMS_TILES + e.target.id;
    layer._options.tiles = [src];
    layer.load();
    if (e.target.id.substr(e.target.id.length - 2) === "ID") {
        document.getElementById("img-legend").src = WMS_LEGEND_CAT + e.target.id;
    } else {
        document.getElementById("img-legend").src = WMS_LEGEND + e.target.id;
    }

    // update values
    update_table();
}


function update_opacity() {
    let opacity = parseFloat(document.getElementById("opacity").value);
    map.setPaintProperty("qgis-raster", "raster-opacity", opacity);
}


function update_dem() {
    updateSunPosition();
    enableDEM(parseFloat(document.getElementById("dem").value));
}


var map;
var marker;
var popup;
var xhr_values;

$(document).ready(function ()
{
    load_map();
});
