
// Initialize the map
var map = L.map('map').setView([45.39793819727917, -75.72070285499208], 100.0);
var layers = []; // all the tile layers

// Add a base layer (optional)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// maptiler non-commerical only allows zoom level 12-16
// which is not very good since we can't zoom in.

// also appears that 1954 imagery is distorted - probably why geoOttawa hasn't used them.
// perhaps it's just a zoom level issue. i picked coordinates very close together
// TODO: try exporting with far coordinates in maptiler

// TODO: use the $89/mth maptiler account to export with custom zoom levels

// TODO: chatGPT says GDAL with Python can be used as an alternative to generate tiles





document.addEventListener('DOMContentLoaded', function () {


    // setup all tile layers
    var mapMinZoom = 12;
    var mapMaxZoom = 16;
    var layer;
    var options = {
        minZoom: mapMinZoom,
        maxZoom: mapMaxZoom,
        opacity: 1.0,
        attribution: '<a href="https://www.maptiler.com/engine/">Rendered with MapTiler Engine</a>, non-commercial use only',
        tms: false
    };
    //layer = L.tileLayer('static/data/54-4518-0015-0080-json/{z}/{x}/{y}.png', options).addTo(map);
    map.setZoom(13);
    
    var layerUrls = [
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer",
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1958/MapServer",
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer",
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1976/MapServer",
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2002/MapServer",
        "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_2022/MapServer",
    ];

    var sliderValues = [2022, 2002, 1976, 1965, 1958, 1928];
    
    for (var i = 0; i < layerUrls.length; i++) {
        var currentUrl = layerUrls[i];
        console.log("Current URL:", currentUrl);
    
    
        layers[i] = L.esri.tiledMapLayer({
            url: currentUrl,
            pane: "overlayPane",
            opacity: 0.0 // make all hidden
        }).addTo(map);
  
        layers[i].on('tileerror', function (error) {
            console.warn('Tile error:', error);
            //error.preventDefault();
          });
    }
    
    var range = document.querySelector('.input-range');
    var valuesContainer = document.querySelector('.slider-values');

    // range is size of the number of layers we have
    range.min = 0.0;
    range.max = 5.0;
    range.step = "any";
    range.value = 2; // init to 1965 (see below)

    // make 1965 full opacity
    layers[range.value].setOpacity(1.0);
  
    // set this attribute so CSS can scale the values of the slider
    document.documentElement.style.setProperty('--number-of-values', sliderValues.length-1);

 
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

      // make sure all others are zero
      // (in case slider moves fast)
      for (var i = 0; i < layerUrls.length; i++) {
        if (i == layer1_idx || i == layer2_idx) continue;
        layers[i].setOpacity(0.0);
      }

      if (layer2_idx >= layers.length)
      {
        // at the top of the slider - display base map
        layers[layers.length-1].setOpacity(0.0);
        return;
      }

      var pos = 0.5 - (this.value % 1);
      layer2_opacity = this.value % 1;
      layer1_opacity = 1.0 - layer2_opacity;
      layers[layer1_idx].setOpacity(layer1_opacity);
      layers[layer2_idx].setOpacity(layer2_opacity);


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

// Attach the click event handler to the map
map.on('click', onMapClick);

map.on('error', function (error) {
    console.warn('map error:', error);
  });

var consoleerror = console.error;
console.error = function (err) {
    console.log("mike")
    if (typeof (err.stack) != 'undefined' && err.stack.includes('at Actor.receive (https://maps.ottawa.ca/')) {
        return;
    } else {
        consoleerror(err);
    }
}