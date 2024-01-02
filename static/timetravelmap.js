
// Initialize the map
var map = L.map('map').setView([45.39793819727917, -75.72070285499208], 100.0);

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
layer = L.tileLayer('static/data/54-4518-0015-0080-json/{z}/{x}/{y}.png', options).addTo(map);
map.setZoom(13);

// // Set initial opacity
// var currentOpacity = 0.5;

// // Create opacity slider
// $("#opacitySlider").slider({
// value: currentOpacity,
// min: 0,
// max: 1,
// step: 0.01,
// slide: function(event, ui) {
//     currentOpacity = ui.value;
//     updateOverlayOpacity();
// }
// });

// Function to update overlay opacity
function updateOverlayOpacity() {
    // Update opacity for both Google Earth and KML tile layers
    // Replace this with the appropriate method for your chosen library.
    // Example for Leaflet:
    kmlTileLayer.setOpacity(currentOpacity);
    // Update opacity for Google Earth - replace with actual code.
}