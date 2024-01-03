
// Initialize the map
var map = L.map('map').setView([45.39793819727917, -75.72070285499208], 100.0);
var layers = []; // all the tile layers

// Add a base layer (optional)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


var layerUrls = [
    //"https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer",
    "static/data/1928_esri",
    "static/data/1933/{z}/{x}/{y}.png",
    "static/data/1945/{z}/{x}/{y}.png",
    "static/data/1954/{z}/{x}/{y}.png",
    "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1958/MapServer",
    "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer",
    "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1976/MapServer",
    "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2002/MapServer",
    "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2022/MapServer",
];
var sliderValues = [
    2022,
    2002,
    1976,
    1965,
    1958,
    1954,
    1945,
    1933,
    1928
];
var start_layer_index = 3; // 1954



map.refresh = function(timeout, zoom){
    window.setTimeout(function(){
        console.log("map timeout")
        // this fixes inital ESRI tile load
        map.setZoom(zoom);
    }, timeout);
};
map.refresh(500, 13);

// maptiler non-commerical only allows zoom level 12-16
// which is not very good since we can't zoom in.

// TODO: use the $89/mth maptiler account to export with custom zoom levels
// TODO: chatGPT says GDAL with Python can be used as an alternative to generate tiles
// QGIS seems to be the answer.

function addLayerToMap(layer_index)
{
    if (typeof layers[layer_index] === 'undefined')
    {
        if (layerUrls[layer_index].includes("static") && !layerUrls[layer_index].includes("esri"))
        {
            console.log("TILES adding " + layerUrls[layer_index]);
            // local tiles
            // NOTE: if the generated tiles aren't generated to mapMaxZoom - they will go blank
            var mapMinZoom = 5;
            var mapMaxZoom = 18;
            var layer;
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

            // TODO: everytime we load an ESRI map 
            // we have to zoom to have it appear.
            // serving tiles locally doesn't seem to have this issue
            map.refresh(500, map.getZoom()+1);
        }

        layers[layer_index].on('tileerror', function (error) {
            //console.warn('Tile error:', error);
            //error.preventDefault();
        });
    }
}

window.addEventListener('load', function() {
    map.setZoom(12); // start way out (to prevent so many 404s at startup)
    
    addLayerToMap(start_layer_index);
    
    var range = document.querySelector('.input-range');
    var valuesContainer = document.querySelector('.slider-values');

    // range is size of the number of layers we have
    range.min = 0.0;
    range.max = layerUrls.length;
    range.step = "any";
    range.value = start_layer_index;

    // make 1965 full opacity
    layers[range.value].setOpacity(1.0);
  
    // set this attribute so CSS can scale the values of the slider
    document.documentElement.style.setProperty('--number-of-values', sliderValues.length-1);
    var height = Math.round(range.getBoundingClientRect().height);
    var heightString = height + 'px';
    document.documentElement.style.setProperty('--slider-height', heightString);

 
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

      var pos = 0.5 - (this.value % 1);
      layer2_opacity = this.value % 1;
      layer1_opacity = 1.0 - layer2_opacity;
      layers[layer1_idx].setOpacity(layer1_opacity);
      layers[layer2_idx].setOpacity(layer2_opacity);

      console.log(layer1_idx + ":" + layer1_opacity + " " + layer2_idx + ":" + layer2_opacity)

    });
});



// Define an event handler for map clicks
var marker = null;
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
    marker.bindPopup(lat + ", " + lng).openPopup();
}
map.on('click', onMapClick);



var callBack = function () {
    console.log("Map successfully loaded");
};
map.whenReady(callBack);


function onZoom() {
    var currentZoom = map.getZoom();
    //console.log('Map zoomed to level:', currentZoom);
}
map.on('zoom', onZoom);


map.on('error', function (error) {
    console.warn('map error:', error);
});


