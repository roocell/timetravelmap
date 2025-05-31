
// Initialize the map
var layers = []; // all the tile layers
let layersVisible = true;
var marker = null;

// Function to get URL parameters
function getQueryParam(param, defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(param) ? parseFloat(urlParams.get(param)) : defaultValue;
}
// Get lat/lng from URL or use default values
const defaultLat = 45.39793819727917;
const defaultLng = -75.72070285499208;

function getQueryParam(param, defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(param) ? parseFloat(urlParams.get(param)) : defaultValue;
}

const lat = parseFloat(getQueryParam('lat', defaultLat));
const lng = parseFloat(getQueryParam('lng', defaultLng));
const zoom = parseInt(getQueryParam('z', null), 10);
const layerIndex = parseInt(getQueryParam('l', null), 10);

var current_layer_index = 1;
const map = L.map('map').setView([defaultLat, defaultLng], 13);

if (!isNaN(lat) && !isNaN(lng)) {
    map.setView([lat, lng], !isNaN(zoom)?zoom:13);
    if (lat != defaultLat)
        marker = L.marker([lat, lng]).addTo(map);
}
if (layerIndex != null && !isNaN(layerIndex))
{
    current_layer_index = layerIndex;
}

// Add a base layer (optional)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 22
}).addTo(map);

var layerUrls = [
    "static/data/1879/{z}/{x}/{y}.png",
    //"https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer",
    // "static/data/1928_esri",
    "static/data/1928/{z}/{x}/{y}.png",
    "static/data/1930s/{z}/{x}/{y}.png",
    "static/data/1945/{z}/{x}/{y}.png",
    "static/data/1954/{z}/{x}/{y}.png",
    "static/data/1958/{z}/{x}/{y}.png",
    // "static/data/1958_esri",
    // "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1958/MapServer",
    "static/data/1965/{z}/{x}/{y}.png",
    // "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer",
    // "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1976/MapServer",
    // "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2002/MapServer",
    "static/data/2015_lidar/{z}/{x}/{y}.png",
    "static/data/hrdem/{z}/{x}/{y}.png",
    // "https://datacube.services.geo.ca/wrapper/ogc/elevation-hrdem-mosaic?",
    // "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2022/MapServer",
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
];
var sliderValues = [
    "New",
    "hrdem",
    "lidar",
    // 1976,
    1965,
    1958,
    1954,
    1945,
    "1930s",
    1928,
    1879
];

map.refresh = function(timeout, zoom){
    window.setTimeout(function(){
        console.log("map timeout")
        // this fixes inital ESRI tile load
        map.setZoom(zoom);
        window.setTimeout(function(){
            // this fixes inital ESRI tile load
            map.setZoom(zoom-1);
        }, timeout);
    }, timeout);
};
// map.refresh(500, 13);  // for 1928_esri

// maptiler non-commerical only allows zoom level 12-16
// which is not very good since we can't zoom in.

// TODO: use the $89/mth maptiler account to export with custom zoom levels
// TODO: chatGPT says GDAL with Python can be used as an alternative to generate tiles
// QGIS seems to be the answer.

function addLayerToMap(layer_index)
{
    if (layer_index >= layerUrls.length)
        return;
    if (typeof layers[layer_index] === 'undefined')
    {
        // argis satellite
        if (layerUrls[layer_index].includes("arcgisonline"))
        {
            var options = {
                minNativeZoom: 12,
                maxNativeZoom: 17,
                minZoom: 5,
                maxZoom: 22,
                attribution: 'arcgisonline',
            };
            layers[layer_index] = L.tileLayer(layerUrls[layer_index], options).addTo(map);
        } else if (layerUrls[layer_index].includes("static") && !layerUrls[layer_index].includes("esri"))
        {
            console.log("TILES adding " + layerUrls[layer_index]);
            // local tiles
            // NOTE: if the generated tiles aren't generated to mapMaxZoom - they will go blank
            var mapMinZoom = 12;
            var mapMaxZoom = 17;
            var options = {
                minNativeZoom: mapMinZoom,
                maxNativeZoom: mapMaxZoom,
                minZoom: 5,
                maxZoom: 22,
                opacity: 0.0,
                attribution: 'rendered with QGIS',
                tms: false
            };
            layers[layer_index] = L.tileLayer(layerUrls[layer_index], options).addTo(map);
        } else if (layerUrls[layer_index].includes("hrdem")) {
            console.log("adding hrdem");
            var options = {
                layers: 'dtm-hillshade',
                format: 'image/png',
                attribution: "Canada HRDEM",
                minNativeZoom: 12,
                maxNativeZoom: 17,
                minZoom: 5,
                maxZoom: 22
            };
            layers[layer_index] = L.tileLayer(layerUrls[layer_index], options).addTo(map);    
        } else {
            // city of ottawa source
            console.log("ESRI TILES adding " + layerUrls[layer_index]);
            layers[layer_index] = L.esri.tiledMapLayer({
                url: layerUrls[layer_index],
                pane: "overlayPane",
                opacity: 0.0, // make all hidden
                maxNativeZoom: 18, // zoom capability of tiles
                maxZoom: 22 // zoom on map (will stretch tiles)
            }).addTo(map);

            // TODO: everytime we load an ESRI map from ottawa server
            // we have to zoom to have it appear.
            // serving tiles locally doesn't seem to have this issue
            if(!layerUrls[layer_index].includes("esri"))
            {
                map.refresh(500, map.getZoom()+1);
            }
        }

        layers[layer_index].on('tileerror', function (error) {
            //console.warn('Tile error:', error);
            //error.preventDefault();
        });
    }
}

function removeLayerToMap(layer_index)
{
    // TODO: should probably remove layers from the map
    // as the date is moved. that way - we won't be downloading tiles from every 
    // year when panning/zooming.
    // although...the upside to loading everything is that you can swipe
    // through the years very smoothly without loading tiles.
}

let currentLocationMarker;

// Define an event handler to add a marker at the user's current location
function showCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;

            // If there's already a marker, remove it before adding a new one
            if (currentLocationMarker) {
                currentLocationMarker.setLatLng([lat, lng]);
            } else {
                // Add a new blue circle marker at the user's current location
                currentLocationMarker = L.circleMarker([lat, lng], {
                    color: 'blue',           // Set the circle color to blue
                    fillColor: 'blue',       // Fill color inside the circle
                    fillOpacity: 0.6,        // Set fill opacity
                    radius: 8                // Set circle radius
                }).addTo(map);
            }

            // Optionally, bind a popup to the marker
            //currentLocationMarker.bindPopup("You are here").openPopup();

            // Set the map view to the current location with a zoom level
            //map.setView([lat, lng], 13);
        }, function(error) {
            console.warn("Error getting location: " + error.message);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

setInterval(showCurrentLocation, 5000);

window.addEventListener('load', function() {
    map.setZoom(13); // start way out (to prevent so many 404s at startup)
    
    addLayerToMap(current_layer_index);

    showCurrentLocation();

    // free satellite
    // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    // attribution: 'Tiles &copy; Esri'
    // }).addTo(map);

    var range = document.querySelector('.input-range');
    var valuesContainer = document.querySelector('.slider-values');

    // range is size of the number of layers we have
    range.min = 0.0;
    range.max = layerUrls.length - 1;
    range.step = "any";
    range.value = current_layer_index;

    // make 1965 full opacity
    layers[range.value].setOpacity(1.0);
  
    // set this attribute so CSS can scale the values of the slider
    document.documentElement.style.setProperty('--number-of-values', sliderValues.length - 1);
    var height = Math.round(range.getBoundingClientRect().height);
    var heightString = height + 'px';
    document.documentElement.style.setProperty('--slider-height', heightString);

    document.getElementById('zoom-level').innerText = "Zoom: " + map.getZoom();

 
    // Populate values container with evenly distributed values
    sliderValues.forEach(function (val) {
      var span = document.createElement('span');
      span.innerHTML = val;
      valuesContainer.appendChild(span);
    });
  
    // Update the displayed value when the slider value changes
    range.addEventListener('input', function () {
      // as the slider moves between two whole numbers,
      // we want to change the opacity of those layers
      // (fade in/out
      var layer1_idx = Math.floor(this.value);
      var layer2_idx = layer1_idx + 1;

      current_layer_index = layer1_idx;

      addLayerToMap(layer1_idx);
      addLayerToMap(layer2_idx);

      // make sure all others are zero
      // (in case slider moves fast)
      for (var i = 0; i < layerUrls.length; i++) {
        if (i == layer1_idx || i == layer2_idx) continue;
        if (typeof layers[i] === 'undefined') continue;
        layers[i].setOpacity(0.0);
      }

      if (layer2_idx >= layerUrls.length)
      {
        // at the top of the slider - display base map
        layers[layerUrls.length-1].setOpacity(0.0);
        return;
      }

      layer2_opacity = this.value % 1;
      layer1_opacity = 1.0 - layer2_opacity;
      layers[layer1_idx].setOpacity(layer1_opacity);
      if (layer2_idx < layerUrls.length) {
        layers[layer2_idx].setOpacity(layer2_opacity);
      }
      //console.log(this.value + " " + layer1_idx + ":" + layer1_opacity + " " + layer2_idx + ":" + layer2_opacity);

    });
});



// Define an event handler for map clicks
function onMapClick(e) {
    if (marker)
    {
        map.removeLayer(marker);
    }

    // Get the clicked coordinates
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    // Create a marker and add it to the map
    marker = L.marker([lat, lng]).addTo(map);

    // You can customize the marker popup or other properties here
    var latlng = lat + ",<BR>" + lng;
    var baseUrl = window.location.origin;
    var zoom = Math.min(map.getZoom(), 17);
    var ttm_link = `<a href="${baseUrl}/?lat=${lat}&lng=${lng}&z=${zoom}&l=${current_layer_index}">TTM Link</a>`;
    var gm_link = `<a href="https://www.google.com/maps/place/${lat},${lng}">Google Maps Link</a>`;

    var popuptext = latlng + "<br>" + ttm_link + "<BR>" + gm_link;
    marker.bindPopup(popuptext).openPopup();
}
map.on('click', onMapClick);



var callBack = function () {
    console.log("Map successfully loaded");
};
map.whenReady(callBack);


function onZoom() {
    var currentZoom = map.getZoom();
    document.getElementById('zoom-level').innerText = "Zoom: " + currentZoom;
    //console.log('Map zoomed to level:', currentZoom);
}
map.on('zoom', onZoom);


map.on('error', function (error) {
    console.warn('map error:', error);
});

function updateLayerVisibility() {
    const range = document.querySelector('.input-range');
    const layer1_idx = Math.floor(range.value);
    const layer2_idx = layer1_idx + 1;

    if (layersVisible) {
        const layer2_opacity = range.value % 1;
        const layer1_opacity = 1.0 - layer2_opacity;

        if (layer1_idx < layers.length) {
            layers[layer1_idx].setOpacity(layer1_opacity);
        }
        if (layer2_idx < layers.length) {
            layers[layer2_idx].setOpacity(layer2_opacity);
        }
    } else {
        layers.forEach(layer => layer.setOpacity(0));
    }
}

// Toggle visibility with click
document.getElementById('toggle-layers').addEventListener('click', function () {
    layersVisible = !layersVisible;
    updateLayerVisibility();
});

// Toggle visibility with spacebar
document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
        layersVisible = !layersVisible;
        updateLayerVisibility();
    }
});