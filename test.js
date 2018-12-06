const decompress = require('decompress');
const edigeoTogeojson = require('./index.js');
const fs = require('fs');

decompress('./fixture/edigeo-cc-38053000CN01.tar.bz2').then(files => {

    const bufferData = { 'THF': undefined, 'QAL': undefined, 'GEO': undefined, 'SCD':undefined, 'VEC': [] }
    for (let i = 0; i < files.length; i++) {
        if (/\.THF$/.test(files[i].path)) {
            bufferData.THF = files[i].data;
        } else if (/\.VEC$/.test(files[i].path)) {
            bufferData.VEC.push(files[i].data);
        } else if (/\.QAL$/.test(files[i].path)) {
            bufferData.QAL = files[i].data;
        } else if (/\.GEO$/.test(files[i].path)) {
            bufferData.GEO = files[i].data;
        } else if (/\.SCD$/.test(files[i].path)) {
            bufferData.SCD = files[i].data;
        }
    }

    console.time('Time')
    const data = edigeoTogeojson(bufferData);
    console.timeEnd('Time')

    for (const name in data.relations){
        fs.writeFileSync(`./fixture/rels/${name}.json`, JSON.stringify(data.relations[name]));
    }
     for (const name in data.geojsons){
        fs.writeFileSync(`./fixture/geojsons/${name}.geojson`, JSON.stringify(data.geojsons[name]));
    }
});