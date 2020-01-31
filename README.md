# edigeoToGeojson
Convertit les fichiers du cadastre français de l'EDIGEO en GEOJSON

# Installation

```sh
    npm install edigeo-to-geojson
```

# Exemple

```js
const path = require('path');
const edigeoTogeojson = require('edigeo-to-geojson');
const decompress = require("decompress");

decompress('MonFichierEdigeo-cc-38001000AS01.tar.bz2').then(files => {
    const bufferData = { 'THF': undefined, 'QAL': undefined, 'GEO':undefined, 'VEC':[]}

    for (let i = 0; i < files.length; i++){
        if (/\.THF$/.test(files[i].path)){
            bufferData.THF = files[i].data;
        } else if (/\.VEC$/.test(files[i].path)){
            bufferData.VEC.push(files[i].data);
        } else if (/\.QAL$/.test(files[i].path)){
            bufferData.QAL = files[i].data;
        } else if (/\.GEO$/.test(files[i].path)){
            bufferData.GEO = files[i].data;
        }
    }

   const data = edigeoTogeojson(bufferData);
```