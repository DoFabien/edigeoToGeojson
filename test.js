const decompress = require('decompress');
const edigeoTogeojson = require('./index.js');
const fs = require('fs');


decompress('/home/fabien/Téléchargements/dep38/38149/edigeo-cc-38149000AD01.tar.bz2').then(files => {

    const bufferData = { 'THF': undefined, 'QAL': undefined, 'GEO': undefined, 'VEC': [] }
    for (let i = 0; i < files.length; i++) {
        if (/\.THF$/.test(files[i].path)) {
            bufferData.THF = files[i].data;
        } else if (/\.VEC$/.test(files[i].path)) {
            bufferData.VEC.push(files[i].data);
        } else if (/\.QAL$/.test(files[i].path)) {
            bufferData.QAL = files[i].data;
        } else if (/\.GEO$/.test(files[i].path)) {
            bufferData.GEO = files[i].data;
        }
    }

    const geojsons = edigeoTogeojson(bufferData, '38', { filter: true, geomHash: true });
    // console.log(geojsons);
    // let features  = geojsons['PARCELLE_id'].features;
    // fs.writeFileSync('fixture/test_result.geojson', JSON.stringify(geojsons['PARCELLE_id']))
    // for (let i = 0; i < features.length; i++){
    //     let feat = features[i];
    //     if (!feat.geometry){
    //         console.log(feat);
    //     }
    // }
    
});