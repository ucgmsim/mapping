// map layer ids on server
var ID_1170 = "1170p5";
var ID_NZTA = "nzta";
var ID_NZTA_POINTS = "nzta-points";
var WMS_TILES = '/wms?service=WMS&version=1.3.0&request=GetMap&format=image/png&srs=EPSG:3857&transparent=true&width=256&height=256&BBOX={bbox-epsg-3857}&layer='
var WMS_LEGEND = '/wms?&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&STYLE=default&sld_version=1.1.0&layertitle=false&symbolwidth=16&symbolheight=9&itemfontsize=16&boxspace=2&iconlabelspace=4&LAYER='
var WMS_VALUES = '/wms?service=WMS&version=1.3.0&request=GetFeatureInfo&info_format=application/json&width=20&height=20&i=10&j=10&crs=EPSG:4326'
var ACCESS_TOKEN = "pk.eyJ1Ijoic2Vpc3RlY2giLCJhIjoiY2tvdDZjYjNkMDdhNTJ3azc0YTlrZjR2MSJ9.OIyhZMUOlFfy54r2STMVDg";
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
var PARAM_R = [0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.3, 1.7, 1.8];
var DISPLAY_1170 = [
    ["hazard", "Hazard"],
    ["siteclass", "Parameter: Site Class"],
    ["vs30", "Parameter: Vs30"],
    ["ch", "Parameter: Ch, spectral shape factor"],
    ["n", "Parameter: N, near-fault factor"],
    ["r", "Parameter: R, return period factor"],
    ["z", "Parameter: Z, Z factor"],
];
var DISPLAY_NZTA = [
    ["hazard", "Hazard"],
    ["siteclass", "Parameter: Site Class"],
    ["vs30", "Parameter: Vs30"],
    ["meff50250", "Property: Meff for design period 50 - 250 years"],
    ["meff5002500", "Property: Meff for design period 500 - 2500 years"],
];
var SITE_CLASS_1170 = ["A: Rock", "B: Weak Rock", "C: Intermediate Rock",
                       "D: Soft or Deep Soil", "E: Very Soft"];
var SITE_CLASS_NZTA = ["A/B rock", "D/E deep/soft soil"];


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
    populate_display();
    document.getElementById('select_display').onchange = switch_column;
    document.getElementById('select_rp').onchange = switch_column;
    document.getElementById('select_im').onchange = switch_column;

    map.on("click", map_mouseselect);
    map.on("mousemove", ID_NZTA_POINTS, function() {
        var code_type = document.getElementById("menu_layer")
            .getElementsByClassName("active")[0].id;
        if (code_type === ID_NZTA) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('click', ID_NZTA_POINTS, show_nzta_point);
    map.on('mouseleave', ID_NZTA_POINTS, function() {
        var code_type = document.getElementById("menu_layer")
            .getElementsByClassName("active")[0].id;
        if (code_type === ID_NZTA) map.getCanvas().style.cursor = '';
    });
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


function show_nzta_point(e) {
    if (marker_clicked(e.point)) return;

    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    if (code_type !== ID_NZTA) return;

    var feature = e.features[0];
    new mapboxgl.Popup({closeButton: true}).setLngLat(feature.geometry.coordinates)
        .setHTML('<strong>Town/City: ' + feature.properties.place + '</strong><p><table class="table table-sm"><tbody>' +
            '<tr><th scope="row">Longitude</th><td>' + feature.properties.longitude + '</td></tr>' +
            '<tr><th scope="row">Latitude</th><td>' + feature.properties.latitude + '</td></tr>' +
            '<tr><th scope="row">C<sub>0,1000</sub> Class A/B rock</th><td>' + feature.properties.C_0_1000_AB + '</td></tr>' +
            '<tr><th scope="row">C<sub>0,1000</sub> Class D/E deep/soft soil</th><td>' + feature.properties.C_0_1000_DE + '</td></tr>' +
            '<tr><th scope="row">M<sub>eff</sub> 500 - 2500 years</th><td>' + feature.properties.Meff_500_2500 + '</td></tr>' +
            '<tr><th scope="row">M<sub>eff</sub> 50 - 250 years</th><td>' + feature.properties.Meff_50_250 + '</td></tr>' +
            '<tr><th scope="row">Vs30</th><td>' + feature.properties.vs30 + '</td></tr>' +
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


function populate_display() {
    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var select = document.getElementById("select_display");
    select.innerHTML = "";
    if (code_type === ID_NZTA) {
        var options = DISPLAY_NZTA;
    } else if (code_type === ID_1170) {
        var options = DISPLAY_1170;
    }
    for (var i = 0; i < options.length; i++) {
        var option = document.createElement("option");
        option.text = options[i][1];
        option.value = options[i][0];
        select.add(option);
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

    if (code_type === ID_1170) {
        var code_layers = ",nzs1170p5_siteclass,chim0,z";
    } else if (code_type === ID_NZTA) {
        var code_layers = ",siteclass,nzta_meff50250,nzta_meff5002500";
    }

    xhr_values = $.ajax({
        type: "GET",
        url: WMS_VALUES + '&bbox=' + bbox +
            '&query_layers=' + code_type + 'rp0im0,vs30' + code_layers,
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
    var table_rp = document.getElementById("table-rp");
    var table_im = document.getElementById("table-im");
    var lngLat = marker.getLngLat();
    table_rp.innerHTML = '<thead><tr><th scope="col">RP</th><th scope="col">IM value (g)</th></tr></thead>';
    table_im.innerHTML = '<thead><tr><th scope="col">IM</th><th scope="col">RP value (g)</th></tr></thead>';
    popup_html = "";

    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var rp = parseInt(document.getElementById("select_rp").value);
    var im = parseInt(document.getElementById("select_im").value);

    // add site properties to popup
    popup_html += '<p class="h6">Vs30: ' + features[1]["properties"]["Band 1"] + " m/s<br />";

    bands = features[0]["properties"];
    if (code_type === ID_1170) {
        popup_html += "Site class: " +
            SITE_CLASS_1170[parseInt(features[2]["properties"]["Band 1"])] + "<br />";
        popup_html += "Ch, spectral shape factor: " +
            features[3]["properties"]["Band " + ("0" + (im + 1)).slice(-2)] + "<br />";
        popup_html += "N, near-fault factor: 1<br />";
        popup_html += "R, return period factor: " + PARAM_R[rp] + "<br />";
        popup_html += "Z, Z factor: " + features[4]["properties"]["Band 1"] + "<br />";
        for (var j = 0; j < RP_NAMES.length; j++) {
            let row = table_rp.insertRow(j + 1);
            let rp_name = row.insertCell(0);
            let rp_value = row.insertCell(1);
            rp_name.innerHTML = RP_NAMES[j];
            rp_value.innerHTML = bands["Band " + ("00" + (1 + im + j * IM_NAMES.length)).slice(-3)];
        }
        for (var j = 0; j < IM_NAMES.length; j++) {
            let row = table_im.insertRow(j + 1);
            let im_name = row.insertCell(0);
            let im_value = row.insertCell(1);
            im_name.innerHTML = IM_NAMES[j];
            im_value.innerHTML = bands["Band " + ("00" + (1 + j + rp * IM_NAMES.length)).slice(-3)];
        }
    }
    if (code_type === ID_NZTA) {
        popup_html += "Site class: " +
            SITE_CLASS_NZTA[parseInt(features[2]["properties"]["Band 1"])] + "<br />";
        popup_html += "M<sub>eff</sub> 50 - 250 years: " +
            features[3]["properties"]["Band 1"] + "<br />";
        popup_html += "M<sub>eff</sub> 500 - 2500 years: " +
            features[4]["properties"]["Band 1"] + "<br />";
        for (var j = 0; j < RP_NAMES.length; j++) {
            let row = table_rp.insertRow(j + 1);
            let rp_name = row.insertCell(0);
            let rp_value = row.insertCell(1);
            rp_name.innerHTML = RP_NAMES[j];
            rp_value.innerHTML = bands["Band " + (1 + j)];
        }
        let row = table_im.insertRow(1);
        let im_name = row.insertCell(0);
        let im_value = row.insertCell(1);
        im_name.innerHTML = IM_NAMES[0];
        im_value.innerHTML = bands["Band " + (1 + rp)];
    }
    popup_html += "</p>";

    if (lngLat === undefined) return;
    popup_html += '<div id="marker_prop"></div><button type="button" '
            + 'onclick="spectra_plot(' + lngLat.lng + ',' + lngLat.lat + ');" '
            + 'class="btn btn-primary btn-sm mr-2"'
            + '>Spectra Plot</button>'
    popup.setHTML(popup_html);
    if (! popup.isOpen()) marker.togglePopup();
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


function marker_clicked(cpos) {
    if ((marker.getLngLat() === undefined) || (marker._pos === null)) return false;
    // no api so use x,y coords
    var mpos = marker._pos;
    if (mpos.x - 15  < cpos.x && mpos.x + 15 > cpos.x
            && mpos.y - 15 < cpos.y && mpos.y + 15 > cpos.y) return true;
    return false;
}


function map_runlocation(lngLat, mouse=true) {
    // lngLat: location of interest
    // mouse: location from map rather than text box

    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    // follow mouse mode?
    var follow = document.getElementById("follow_mouse").checked;
    // don't move marker if clicked on a nzta site and click based selection
    if (! follow && mouse) {
        var features = map.queryRenderedFeatures(map.project(lngLat));
        for (var i=0; i < features.length; i++) {
            if (features[i].layer.id === ID_NZTA_POINTS && code_type === ID_NZTA) return;
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


function switch_layer(layer) {
    var old_element = document.getElementById("menu_layer").getElementsByClassName("active")[0]
    old_element.classList.remove("active");
    layer.target.classList.add("active");

    if (layer.target.id === ID_1170) {
        map.setPaintProperty(ID_NZTA_POINTS, "circle-opacity", 0);
        map.setPaintProperty(ID_NZTA_POINTS, "circle-stroke-opacity", 0);
    } else {
        map.setPaintProperty(ID_NZTA_POINTS, "circle-opacity", 1);
        map.setPaintProperty(ID_NZTA_POINTS, "circle-stroke-opacity", 1);
    }

    // available items in selects list
    populate_display();
    populate_ims();
    // update column name for new layer
    document.getElementById("select_display").value = "hazard";
    display_previous = "hazard";
    switch_column();
}


function switch_column() {
    // when changing IM / RP selection
    var code_type = document.getElementById("menu_layer")
        .getElementsByClassName("active")[0].id;
    var display = document.getElementById("select_display").value;
    var rp = document.getElementById("select_rp").value;
    var im = document.getElementById("select_im").value;

    var layer = map.getSource("qgis-wms");
    if (display === "hazard") {
        suffix = code_type + "rp" + rp + 'im' + im;
    } else if (display === "vs30") {
        suffix = "vs30";
    } else if (display === "siteclass") {
        if (code_type === ID_1170) {
            suffix = "nzs1170p5_siteclass";
        } else if (code_type === ID_NZTA) {
            suffix = "siteclass";
        }
    } else if (display === "ch") {
        suffix = "chim" + im;
    } else if (display === "z") {
        suffix = "z";
    } else if (display === "n") {
        alert("Near fault factor is 1");
        document.getElementById("select_display").value = display_previous;
        return;
    } else if (display === "r") {
        alert("Return period factor is " + PARAM_R[rp] + " for " + RP_NAMES[rp])
        document.getElementById("select_display").value = display_previous;
        return;
    } else if (display === "meff50250" || display === "meff5002500") {
        suffix = "nzta_" + display;
    }
    var src = WMS_TILES + suffix;
    layer._options.tiles = [src];
    layer.load();
    document.getElementById("img-legend").src = WMS_LEGEND + suffix;

    // update values in table
    update_table();
    display_previous = display;
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
var display_previous = "hazard";

$(document).ready(function ()
{
    load_map();
});

$('#spectra-modal').on('hidden.bs.modal', function () {
    if (xhr_spectra === undefined) return;
    xhr_spectra.abort();
});
