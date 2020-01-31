const assert = require('assert');
const edigeoTogeojson = require('../lib/index.cjs');
const path = require('path');
const fs = require('fs');


const toGeojson = (_path) => {
  const pathEdigeo = path.join(__dirname, _path)
  const filesNames = fs.readdirSync(pathEdigeo);
  
  const bufferData = { 'THF': undefined, 'QAL': undefined, 'GEO': undefined, 'SCD':undefined, 'VEC': [] }
  for (let i = 0; i < filesNames.length; i++) {
      if (/\.THF$/.test(filesNames[i])) {
          bufferData.THF = fs.readFileSync( path.join(pathEdigeo,filesNames[i]) );
      } else if (/\.VEC$/.test(filesNames[i])) {
          bufferData.VEC.push(fs.readFileSync( path.join(pathEdigeo,filesNames[i]) ));
      } else if (/\.QAL$/.test(filesNames[i])) {
          bufferData.QAL = fs.readFileSync( path.join(pathEdigeo,filesNames[i]) );
      } else if (/\.GEO$/.test(filesNames[i])) {
          bufferData.GEO = fs.readFileSync( path.join(pathEdigeo,filesNames[i]) );
      } else if (/\.SCD$/.test(filesNames[i])) {
          bufferData.SCD = fs.readFileSync( path.join(pathEdigeo,filesNames[i]) );
      }
  }
  return edigeoTogeojson(bufferData);
}

describe('Edigeo to geojson', () => {
  const fixture1 = toGeojson('./fixtures/edigeo-380910000C01');
  const fixture2 = toGeojson('./fixtures/edigeo-380040000B02');
  const fixture3 = toGeojson('./fixtures/edigeo-380030000A04');
  
  describe('Basics test',  () => {
    it('Should have "geojsons" key', () => {
      assert.equal(Object.keys(fixture1).indexOf('geojsons'), 0);
    });

    it('Should have "relations" key', () => {
      assert.equal(Object.keys(fixture1).indexOf('relations'), 1);
    });

    it('"geojsons" should have COMMUNE_id key', () => {
      assert.equal(Object.keys(fixture1.geojsons).includes('COMMUNE_id'), true);
    });

    it('"geojsons" should have PARCELLE_id key', () => {
      assert.equal(Object.keys(fixture1.geojsons).includes('PARCELLE_id'), true);
    });
    it('"geojsons" should have SECTION_id key', () => {
      assert.equal(Object.keys(fixture1.geojsons).includes('SECTION_id'), true);
    });
    
    it('"geojsons" should have 15 features collections ', () => {
      assert.equal(Object.keys(fixture1.geojsons).length, 15);
    });
  });

    describe('Data test',  () => {
      it('"PARCELLE_id" should have 339 features ', () => {
        assert.equal(fixture1.geojsons['PARCELLE_id'].features.length, 339);
      });

      it('"SECTION_id" should be Multipolygon ', () => {
        assert.equal(fixture2.geojsons['SECTION_id'].features[0].geometry.type, 'MultiPolygon');
      });

      it('Should have an error ', () => {
        // coordinates of arc with : [A, B, A]
        assert.equal(fixture3.errors.length, 1);
      });
      
      
    })
});


