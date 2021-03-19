// map layer ids on server
var ID_1170 = "nzcode";
var ID_NZTA = "nzta";
var COLUMN = "00";
var RPS = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];
var RP_NAMES = ["20 years", "25 years", "50 years", "100 years", "250 years",
                "500 years", "1000 years", "2000 years", "2500 years"];
var RP_RANGE_1170 = [0.2, 0.2, 0.3, 0.4, 0.6, 0.8, 1, 1.2, 1.3];
var IM_RANGE = [1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.5, 2.5, 2.5,
                2.5, 2.5, 2.5, 2.2, 2, 1.8, 1.7, 1.6, 1.5, 1.4,
                1.4, 1.4, 1, 1, 1, 1, 1, 0.18, 0.18, 0.1,
                0.08, 0.05]
var RP_RANGE_NZTA = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9];
var IMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
           "a", "b", "c", "d", "e", "f", "10", "11", "12", "13",
           "14", "15", "16", "17", "18", "19", "1a", "1b", "1c", "1d",
           "1e", "1f"];
var IM_NAMES = ["PGA", "pSA 0.01s", "pSA 0.02s", "pSA 0.03s", "pSA 0.04s",
                "pSA 0.05s", "pSA 0.075s", "pSA 0.1s", "pSA 0.12s",
                "pSA 0.15s", "pSA 0.17s", "pSA 0.2s", "pSA 0.25s", "pSA 0.3s",
                "pSA 0.4s", "pSA 0.5s", "pSA 0.6s", "pSA 0.7s", "pSA 0.75s",
                "pSA 0.8s", "pSA 0.9s", "pSA 1.0s", "pSA 1.25s", "pSA 1.5s",
                "pSA 2.0s", "pSA 2.5s", "pSA 3.0s", "pSA 4.0s", "pSA 5.0s",
                "pSA 6.0s", "pSA 7.5s", "pSA 10.0s"];
// minimum zoom to see full detail
min_zoom = 10;


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
    var return_periods = document.getElementById('select_rp')
        .onchange = switch_column;
    var return_periods = document.getElementById('select_im')
        .onchange = switch_column;

    map.on("click", map_mouseselect);
    map.on('idle', loaded);
    map.on('dataloading', loading);
    map.on('load', function () {
        update_colour();
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

    xhr = $.ajax({
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


function try_markervalues(e) {
    map.off("idle", try_markervalues);

    if ((! map.getBounds().contains(marker.getLngLat())) || (map.getZoom() < min_zoom)) {
        // user has since moved the map in an incompatible manner
        marker.remove().setLngLat([0, 0]);
        document.getElementById("table-rp")
            .innerHTML = "<tr><td>select location</td></tr>";
        document.getElementById("table-im")
            .innerHTML = "<tr><td>select location</td></tr>";
    }
    update_values(map.project(marker.getLngLat()), false);
}


function populate_ims() {
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var select = document.getElementById("select_im");
    select.innerHTML = "";
    if (layer === ID_NZTA) {
        var option = document.createElement("option");
        option.text = IM_NAMES[0];
        option.value = IMS[0];
        select.add(option);
    } else if (layer === ID_1170) {
        for (var i = 0; i < IMS.length; i++) {
            var option = document.createElement("option");
            option.text = IM_NAMES[i];
            option.value = IMS[i];
            select.add(option);
        }
    }
}


function update_values(point, follow=true) {
    var features = map.queryRenderedFeatures(point);
    var table_rp = document.getElementById("table-rp");
    var table_im = document.getElementById("table-im");
    table_rp.innerHTML = "";
    table_im.innerHTML = "";
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id
    for (var i=0; i < features.length; i++) {
        if (features[i].layer.id === ID_1170 && layer === ID_1170) {
            for (var j = 0; j < RPS.length; j++) {
                let row = table_rp.insertRow(j);
                let rp_name = row.insertCell(0);
                let rp_value = row.insertCell(1);
                rp_name.innerHTML = RP_NAMES[j];
                rp_value.innerHTML = features[i]
                    .properties[RPS[j] + COLUMN.substr(1)];
            }
            for (var j = 0; j < IMS.length; j++) {
                let row = table_im.insertRow(j);
                let im_name = row.insertCell(0);
                let im_value = row.insertCell(1);
                im_name.innerHTML = IM_NAMES[j];
                im_value.innerHTML = features[i]
                    .properties[COLUMN.substr(0, 1) + IMS[j]];
            }
            return;
        } else if (features[i].layer.id === ID_NZTA && layer === ID_NZTA) {
            for (var j = 0; j < RPS.length; j++) {
                let row = table_rp.insertRow(j);
                let rp_name = row.insertCell(0);
                let rp_value = row.insertCell(1);
                rp_name.innerHTML = RP_NAMES[j];
                rp_value.innerHTML = features[i]
                    .properties[RPS[j]];
            }
            let row = table_im.insertRow(0);
            let im_name = row.insertCell(0);
            let im_value = row.insertCell(1);
            im_name.innerHTML = IM_NAMES[0];
            im_value.innerHTML = features[i]
                .properties[COLUMN.substr(0, 1)];
            return;
        }
    }
    // no data found
    table_rp.innerHTML = "<tr><td>NA</td></tr>";
    table_im.innerHTML = "<tr><td>NA</td></tr>"
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
        popup.setHTML('<button type="button" '
            + 'onclick="spectra_plot(' + lngLat.lng + ',' + lngLat.lat + ');" '
            + 'class="btn btn-primary btn-sm mr-2"'
            + '>Spectra Plot</button>');
        if (map.getZoom() < min_zoom || ! map.areTilesLoaded()
                || (! mouse && ! map.getBounds().contains(marker.getLngLat()))) {
            document.getElementById("table-rp")
                .innerHTML = "<tr><td>loading...</td></tr>";
            document.getElementById("table-im")
                .innerHTML = "<tr><td>loading...</td></tr>";
            // can't see full detail if zoomed out
            if (map.getZoom() < min_zoom
                    || (! mouse && ! map.getBounds().contains(marker.getLngLat()))) {
                map.flyTo({center: lngLat, zoom: min_zoom});
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
    // available IMs list
    populate_ims();
    // update column name for new layer
    switch_column();
    // update values if marker still in position
    try_markervalues();
}


function switch_column(column) {
    // when changing IM / RP selection
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var rp = document.getElementById("select_rp").value;
    var im = document.getElementById("select_im").value;
    if (layer === ID_1170) {
        COLUMN = rp + im;
    } else if (layer === ID_NZTA) {
        COLUMN = rp;
    }
    update_colour();
    update_extrusion();
    // update values if marker still in position
    try_markervalues();
}


function update_transparency() {
    var layer = document.getElementById("menu_layer").getElementsByClassName("active")[0].id;
    if (layer === "none") return;
    var type = map.getLayer(layer).type + "-opacity";
    var opacity = parseFloat(document.getElementById("transparency").value);
    map.setPaintProperty(layer, type, opacity);
}


function update_extrusion() {
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var extrusion = parseFloat(document.getElementById("extrusion").value);
    map.setPaintProperty(
        layer,
        "fill-extrusion-height",
        ["*", extrusion, ["get", COLUMN]]
    );
}


function update_colour() {
    var layer = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var rp = parseInt(document.getElementById("select_rp").value);
    var im = parseInt(document.getElementById("select_im").value, 16);
    if (layer === ID_1170) var scale = RP_RANGE_1170[rp] * IM_RANGE[im];
    if (layer === ID_NZTA) var scale = RP_RANGE_NZTA[rp];
    scale = 360 / scale;
    map.setPaintProperty(
        layer,
        "fill-extrusion-color",
        ["concat", 
            ["literal", "hsl("],
            ["*", scale, ["get", COLUMN]],
            ["literal", ",75%,50%)"]]
    );
}


function update_dem() {
    updateSunPosition();
    enableDEM(parseFloat(document.getElementById("dem").value));
}


var map;
var marker;
var popup;
var xhr;

$(document).ready(function ()
{
    load_map();
});

$('#spectra-modal').on('hidden.bs.modal', function () {
    if (xhr === undefined) return;
    xhr.abort();
});
