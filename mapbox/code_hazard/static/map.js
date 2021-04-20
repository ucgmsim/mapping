// map layer ids on server
var ID_1170 = "1170p5";
var ID_NZTA = "nzta";
var WMS_TILES = '/wms?service=WMS&version=1.3.0&request=GetMap&format=image/png&srs=EPSG:3857&transparent=true&width=256&height=256&BBOX={bbox-epsg-3857}&layer='
var WMS_LEGEND = '/wms?&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&STYLE=default&sld_version=1.1.0&layertitle=false&symbolwidth=16&symbolheight=9&itemfontsize=16&boxspace=2&iconlabelspace=4&LAYER='
var WMS_VALUES = '/wms?service=WMS&version=1.3.0&request=GetFeatureInfo&info_format=application/json&width=20&height=20&i=10&j=10&crs=EPSG:4326'
var ACCESS_TOKEN = "pk.eyJ1Ijoic2Vpc3RlY2giLCJhIjoiY2ttNDd1ZnNoMDF5NjJubHB2NGlzMzU3eiJ9.jNpCQH_wa0p60xgKQ_HXBA";
var MAP_STYLE = "mapbox://styles/seistech/cknf8hztm1z5r17l69yxeapzk";
var PLACE_BELOW = "tunnel-street-minor-low";
var RP_NAMES = ["20 years", "25 years", "50 years", "100 years", "250 years",
                "500 years", "1000 years", "2000 years", "2500 years"];
var IM_NAMES = ["PGA", "pSA 0.01s", "pSA 0.02s", "pSA 0.03s", "pSA 0.04s",
                "pSA 0.05s", "pSA 0.075s", "pSA 0.1s", "pSA 0.12s",
                "pSA 0.15s", "pSA 0.17s", "pSA 0.2s", "pSA 0.25s", "pSA 0.3s",
                "pSA 0.4s", "pSA 0.5s", "pSA 0.6s", "pSA 0.7s", "pSA 0.75s",
                "pSA 0.8s", "pSA 0.9s", "pSA 1.0s", "pSA 1.25s", "pSA 1.5s",
                "pSA 2.0s", "pSA 2.5s", "pSA 3.0s", "pSA 4.0s", "pSA 5.0s",
                "pSA 6.0s", "pSA 7.5s", "pSA 10.0s"];


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
    // changing return period / IM
    populate_ims();
    document.getElementById('select_display').onchange = switch_column;
    document.getElementById('select_rp').onchange = switch_column;
    document.getElementById('select_im').onchange = switch_column;

    map.on("click", map_mouseselect);
    map.on('idle', loaded);
    map.on('dataloading', loading);
    map.on('load', function () {
        map.addSource('qgis-wms', {
            'type': 'raster',
            'tiles': [WMS_TILES + ID_1170 + 'rp0im0'],
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
        document.getElementById('img-legend').src = WMS_LEGEND + ID_1170 + 'rp0im0';
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


function spectra_plot(lon, lat) {
    document.getElementById("spectra-modal-label").innerText = "Spectra Plot";
    document.getElementById("spectra-div").innerHTML = "please wait...";
    $("#spectra-modal").modal("show");

    xhr_spectra = $.ajax({
        type: "GET",
        url: "http://mantle:10099/nzs1170p5_uhs",
        headers: {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuemNvZGUiOiJ1aHMifQ.UMRpGrAvwqfiJRPOCv012S1SqKnj1AnJ-5TXSbUSBVg"},
        data: { lon: lon, lat: lat },
        success: function(data) {
            document.getElementById("spectra-modal-label")
                .innerHTML = 'Spectra Plot <span class="ml-2 badge bg-light">'
                    + "lon: " + roundmax(data.snap_lon)
                    + " lat: " + roundmax(data.snap_lat)
                    + " distance: " + roundmax(data.snap_dist, dp=3) + " km</span>";
            var img = document.createElement('img');
            img.src = "data:image/png;base64, " + data.uhs_plot_data;
            img.className += "mx-auto d-block"
            document.getElementById("spectra-div").innerHTML = "";
            document.getElementById("spectra-div").appendChild(img);
        },
        error: function(data) {
            if (data.statusText === "abort") return;
            $("#spectra-modal").modal("hide");
            alert("Failed to retrieve Spetra Plot");
        }
    });
}


function follow_mouse(cb) {
    if (cb.checked) {
        map.on("mousemove", map_mouseselect);
        marker.remove().setLngLat([0, 0]);
    } else {
        map.off("mousemove", map_mouseselect);
    }
}


function populate_ims() {
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var select = document.getElementById("select_im");
    select.innerHTML = "";
    if (layer === ID_NZTA) {
        var option = document.createElement("option");
        option.text = IM_NAMES[0];
        option.value = 0;
        select.add(option);
    } else if (layer === ID_1170) {
        for (var i = 0; i < IM_NAMES.length; i++) {
            var option = document.createElement("option");
            option.text = IM_NAMES[i];
            option.value = i;
            select.add(option);
        }
    }
}


function retrieve_values(lngLat) {
    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    // bounding box made from expanded point
    var diff = 0.000001
    var bbox = (lngLat.lat - diff) + ',' + (lngLat.lng - diff) +
         ',' + (lngLat.lat + diff) + ',' + (lngLat.lng + diff)

    // abort previous request in case not completed
    if (xhr_values !== undefined) xhr_values.abort();
    xhr_values = $.ajax({
        type: "GET",
        url: WMS_VALUES + '&bbox=' + bbox + '&query_layers=' + code_type + 'rp0im0',
        success: function(data) {
            update_values(data["features"][0]["properties"]);
        },
        error: function(data) {
            if (data.statusText === "abort") return;
            alert("Failed to retrieve values.");
        }
    });
}


function update_values(bands) {
    var table_rp = document.getElementById("table-rp");
    var table_im = document.getElementById("table-im");
    var lngLat = marker.getLngLat();
    table_rp.innerHTML = "";
    table_im.innerHTML = "";
    popup_html = "";

    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var rp = parseInt(document.getElementById("select_rp").value);
    var im = parseInt(document.getElementById("select_im").value);

    if (code_type === ID_1170) {
        // add site properties to popup
        let band_offset = 1 + RP_NAMES.length * IM_NAMES.length;
        popup_html += '<p class="h6">Vs30: ' + bands["Band " + band_offset] + " m/s</p>";

        for (var j = 0; j < RP_NAMES.length; j++) {
            let row = table_rp.insertRow(j);
            let rp_name = row.insertCell(0);
            let rp_value = row.insertCell(1);
            rp_name.innerHTML = RP_NAMES[j];
            rp_value.innerHTML = bands["Band " + ("00" + (1 + im + j * IM_NAMES.length)).slice(-3)];
        }
        for (var j = 0; j < IM_NAMES.length; j++) {
            let row = table_im.insertRow(j);
            let im_name = row.insertCell(0);
            let im_value = row.insertCell(1);
            im_name.innerHTML = IM_NAMES[j];
            im_value.innerHTML = bands["Band " + ("00" + (1 + j + rp * IM_NAMES.length)).slice(-3)];
        }
    }
    if (code_type === ID_NZTA) {
        for (var j = 0; j < RP_NAMES.length; j++) {
            let row = table_rp.insertRow(j);
            let rp_name = row.insertCell(0);
            let rp_value = row.insertCell(1);
            rp_name.innerHTML = RP_NAMES[j];
            rp_value.innerHTML = bands["Band " + (1 + j)];
        }
        let row = table_im.insertRow(0);
        let im_name = row.insertCell(0);
        let im_value = row.insertCell(1);
        im_name.innerHTML = IM_NAMES[0];
        im_value.innerHTML = bands["Band " + (1 + rp)];
    }


    if (lngLat === undefined) return;
    popup_html += '<div id="marker_prop"></div><button type="button" '
            + 'onclick="spectra_plot(' + lngLat.lng + ',' + lngLat.lat + ');" '
            + 'class="btn btn-primary btn-sm mr-2"'
            + '>Spectra Plot</button>'
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
    // after switching layer/column, update table if applicable

    var checkbox = document.getElementById("follow_mouse");
    if (!checkbox.checked) {
        map_lnglatselect(null, silent=true);
    }
}


function map_mouseselect(e) {
    map_runlocation(e.lngLat, true);
}


function map_runlocation(lngLat, mouse=true) {
    // lngLat: location of interest
    // mouse: location from map rather than text box

    // follow mouse mode?
    var follow = document.getElementById("follow_mouse").checked;
    // don't accept clicks on the marker
    if (! follow && mouse && (marker.getLngLat() != undefined) && (marker._pos != null)) {
        // no api so use x,y coords
        var mpos = marker._pos;
        var cpos = map.project(lngLat);
        if (mpos.x - 15  < cpos.x && mpos.x + 15 > cpos.x 
            && mpos.y - 15 < cpos.y && mpos.y + 15 > cpos.y) return
    }

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


function switch_layer(layer) {
    var old_element = document.getElementById("menu_layer").getElementsByClassName("active")[0]
    old_element.classList.remove("active");
    layer.target.classList.add("active");

    if (layer.target.id === ID_1170) {
        $("#collapse_display").show();
    } else {
        $("#collapse_display").hide();
    }

    // available IMs list
    populate_ims();
    // update column name for new layer
    switch_column();
}


function switch_column(column) {
    // when changing IM / RP selection
    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var display = document.getElementById("select_display").value;
    var rp = document.getElementById("select_rp").value;
    var im = document.getElementById("select_im").value;

    var layer = map.getSource("qgis-wms");
    if (display === "hazard" || code_type !== ID_1170) {
        suffix = "rp" + rp + 'im' + im;
    } else if (display === "vs30") {
        suffix = "vs30"
    }
    var src = WMS_TILES + code_type + suffix;
    layer._options.tiles = [src];
    layer.load();
    document.getElementById("img-legend").src = WMS_LEGEND + code_type + suffix;

    // update values in table
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
var xhr_spectra;
var xhr_values;

$(document).ready(function ()
{
    load_map();
});

$('#spectra-modal').on('hidden.bs.modal', function () {
    if (xhr_spectra === undefined) return;
    xhr_spectra.abort();
});
