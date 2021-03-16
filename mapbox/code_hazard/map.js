// map layer ids on server
var ID_1170 = "nzcode"
var ID_NZTA = "nzta_map_fill"


function roundmax(value, dp=6) {
    return Math.round((value + Number.EPSILON) * 10**dp) / 10**dp;
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
    mapboxgl.accessToken = 'pk.eyJ1Ijoic2Vpc3RlY2giLCJhIjoiY2ttNDd1ZnNoMDF5NjJubHB2NGlzMzU3eiJ9.jNpCQH_wa0p60xgKQ_HXBA';
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/seistech/ckm48m7gd2p8y17s1ahyn5c7d',
        center: [173.2995, -41.2728],
        zoom: 5,
    });

    // zoom and rotation controls
    map.addControl(new mapboxgl.NavigationControl({visualizePitch: true}));
    // distance scale
    map.addControl(new mapboxgl.ScaleControl({maxWidth: 200, unit: 'metric'}), 'bottom-right');
    // marker will be used whin location doesn't update with mousemove
    marker = new mapboxgl.Marker()

    // control for layer to be visible
    var layers = document.getElementById('menu_layer')
        .getElementsByTagName('a');
    for (var i = 0; i < layers.length; i++) {
        layers[i].onclick = switch_layer;
    }

    map.on("click", map_mouseselect);
    map.on('idle', loaded);
    map.on('dataloading', loading);
    map.on('load', function () {
        map.addSource('mapbox-dem', {
                      'type': 'raster-dem',
                       'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                       'tileSize': 512,
                       'maxzoom': 14
        });
        enableDEM();

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


function enableDEM() {
    map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
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


function try_markervalues(e) {
    map.off("idle", try_markervalues);

    if ((! map.getBounds().contains(marker.getLngLat())) || (map.getZoom() < 11)) {
        // user has since moved the map in an incompatible manner
        marker.remove().setLngLat([0, 0]);
    }
    update_values(map.project(marker.getLngLat()), false);
}


function update_values(point, follow=true) {
    var features = map.queryRenderedFeatures(point);
    var val_1170;
    var val_nzta;
    for (var i=0; i < features.length; i++) {
        if (features[i].layer.id === ID_1170 && val_1170 === undefined) {
            val_1170 = features[i].properties["00"];
        } else if (features[i].layer.id === val_nzta && val_nzta === undefined) {
            val_nzta = features[i].properties.val_name;
        }
    }

    // UI values
    if (val_1170 === undefined) {
        document.getElementById("val_1170").value = "NA";
    } else {
        document.getElementById("val_1170").value = val_1170;
    }
    /*if (val_nzta === undefined) {
        document.getElementById("val_nzta").value = "NA";
    } else {
        document.getElementById("val_nzta").value = val_nzta;
    }*/
}


function map_lnglatselect(e) {
    if (event.which == 13 || event.keyCode == 13) {
        var lng = document.getElementById("lon").value;
        var lat = document.getElementById("lat").value;
        if (isNaN(lng) || isNaN(lat)) {
            alert("Not a valid latitude / longitude.");
            return;
        }
        lng = parseFloat(lng);
        lat = parseFloat(lat);
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            alert("Not a valid latitude / longitude.");
            return;
        }

        var checkbox = document.getElementById("follow_mouse");
        checkbox.checked = false;
        follow_mouse(checkbox);

        map_runlocation(new mapboxgl.LngLat(lng, lat), false);
    }
}


function map_mouseselect(e) {
    map_runlocation(e.lngLat, true);
}


function map_runlocation(lngLat, mouse=true) {
    var follow = document.getElementById("follow_mouse").checked;

    // update UI
    if (mouse) {
        document.getElementById("lon").value = roundmax(lngLat.lng);
        document.getElementById("lat").value = roundmax(lngLat.lat);
    }
    if (! follow) {
        marker.setLngLat([lngLat.lng, lngLat.lat]).addTo(map);
        if (map.getZoom() < 11 || ! map.areTilesLoaded()
                || (! mouse && ! map.getBounds().contains(marker.getLngLat()))) {
            document.getElementById("val_1170").value = "loading...";
            // can't see 111m grid
            if (map.getZoom() < 11
                    || (! mouse && ! map.getBounds().contains(marker.getLngLat()))) {
                map.flyTo({center: lngLat, zoom: 11});
            }
            map.on("idle", try_markervalues);
            return;
        }
    }

    update_values(map.project(lngLat), follow);
}


function switch_layer(layer) {
    var old_element = document.getElementById("menu_layer").getElementsByClassName("active")[0]
    old_element.classList.remove("active");
    var opacity = parseFloat(document.getElementById("transparency").value);
    if (old_element.id !== "none") {
        var old_type = map.getLayer(old_element.id).type + "-opacity";
        map.setPaintProperty(old_element.id, old_type, 0);
    }
    if (layer.target.id !== "none") {
        var new_type = map.getLayer(layer.target.id).type + "-opacity";
        map.setPaintProperty(layer.target.id, new_type, opacity);
    }
    layer.target.classList.add("active");

    // extrusion control
    $("#collapse").show();
}


function update_transparency() {
    var layer = document.getElementById("menu_layer").getElementsByClassName("active")[0].id;
    if (layer === "none") return;
    var type = map.getLayer(layer).type + "-opacity";
    var opacity = parseFloat(document.getElementById("transparency").value);
    map.setPaintProperty(layer, type, opacity);
}


function update_extrusion() {
    var layer = document.getElementById("menu_layer").getElementsByClassName("active")[0].id;
    var extrusion = parseFloat(document.getElementById("extrusion").value);
    map.setPaintProperty(layer, "fill-extrusion-height", ["*", extrusion, ["get", "00"]]);
}


var map;
var marker;

$(document).ready(function ()
{
    load_map();
});
