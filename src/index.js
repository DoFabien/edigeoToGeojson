// const iconv = require('iconv-lite');
// const parseVEC = require('./parseVEC');
// const generateRingFromPFE = require('./generate-ring-from-arc');
// const turf = require('@turf/turf')

import iconv from 'iconv-lite';
import parseVEC from './parseVEC';
import generateRingFromPFE from './generate-ring-from-arc';
import {union} from '@turf/turf';

/*Récupère la projection en entrée*/
const getProjection = function (GEO_file) {
    if (!GEO_file) return null;

    const projections = {
        "LAMB93": { "epsg": 2154 },
        "RGF93CC42": { "epsg": 3942 },
        "RGF93CC43": { "epsg": 3943 },
        "RGF93CC44": { "epsg": 3944 },
        "RGF93CC45": { "epsg": 3945 },
        "RGF93CC46": { "epsg": 3946 },
        "RGF93CC47": { "epsg": 3947 },
        "RGF93CC48": { "epsg": 3948 },
        "RGF93CC49": { "epsg": 3949 },
        "RGF93CC50": { "epsg": 3950 },
        "GUAD48UTM20": { "epsg": 2970 },
        "MART38UTM20": { "epsg": 2973 },
        "RGFG95UTM22": { "epsg": 2972 },
        "RGR92UTM": { "epsg": 2975 }
    }

    let projEdigeo;
    GEO_file = GEO_file.toString();
    const rows = GEO_file.split(String.fromCharCode(13, 10)); // décompose les lignes
    for (let i = 0; i < rows.length; i++) {
        if (/^RELSA*/g.test(rows[i])) {
            projEdigeo = rows[i].split(':')[1];
            break;
        }
    }
    if (projEdigeo && projections[projEdigeo]) {
        return projections[projEdigeo]
    }
    return null;
}

// retrourne le code d'encodage utilisé par icon-v
const getEncoding = function (THF_string) {
    // console.log(THF_string);
    const CSETrow = THF_string.match(/CSET.*:.*/g);
    const CSET = CSETrow[0].split(':')[1];
    const encodingCodes = {
        'IRV': 'iso-8859-1',
        '646-FRANCE': 'iso-8859-1',
        '8859-1': 'iso-8859-1',
        '8859-2': 'iso-8859-2',
        '8859-3': 'iso-8859-3',
        '8859-4': 'iso-8859-4',
        '8859-5': 'iso-8859-5',
        '8859-6': 'iso-8859-6',
        '8859-7': 'iso-8859-7',
        '8859-8': 'iso-8859-8',
        '8859-9': 'iso-8859-9',
    }
    return encodingCodes[CSET] || 'iso-8859-1';
}


/* Actualité depuis le fichier QAL (date de mise a jour des objets, etc) */
const getActualite = function (QAL_file) {
    QAL_file = QAL_file.toString();
    const RTYSA03s = QAL_file.split('RTYSA03:'); // décompose les lignes
    const actualite = {};
    for (let i = 1; i < RTYSA03s.length; i++) {
        const qualite = { createDate: '', updateDate: '', type_update: '', peren_maj: '', tx_changement: '', date_fin_valid: '' };
        const rows = RTYSA03s[i].split(String.fromCharCode(13, 10));

        if (rows[0] === 'QUP') { //actualite
            const idObjet = rows[1].split(':')[1];
            for (let j = 2; j < rows.length; j++) {
                const row = rows[j]
                if (/^ODA*/g.test(row)) {
                    qualite.createDate = row.split(':')[1];
                } else if (/^UDA*/g.test(row)) {
                    qualite.updateDate = row.split(':')[1];
                } else if (/^UTY*/g.test(row)) {
                    qualite.type_update = row.split(':')[1];
                } else if (/^ULO*/g.test(row)) {
                    qualite.peren_maj = row.split(':')[1];
                } else if (/^RAT*/g.test(row)) {
                    qualite.tx_changement = row.split(':')[1];
                } else if (/^EDA*/g.test(row)) {
                    qualite.date_fin_valid = row.split(':')[1];
                }
            }
            actualite[idObjet] = qualite;
        }
    }
    return actualite;
}

const getAnnee = function (THF_string) {
    THF_string = THF_string.toString();
    const rows = THF_string.split(String.fromCharCode(13, 10)); // décompose les lignes
    for (let i = 0; i < rows.length; i++) {
        if (/^TDASD*/g.test(rows[i])) {
            return rows[i].split(':')[1].substring(0, 4);
        }
    }
    return null;
}
const getProperties = function (fea, qualite = null) {
    let properties = {};
    const ATP = fea['ATP'];
    const ATV = fea['ATV']

    for (let i = 0; i < ATP.length; i++) {
        properties[ATP[i]['RID']] = ATV[i]
    }
    if (qualite && fea['QAP']) {
        let QAP = qualite[fea['QAP']['RID']]
        properties = { ...properties, ...QAP }
    }
    return properties;
};


const parseSCD = function (scdString) {
    const parsedScd = {};
    const blocks = (scdString.split('RTYSA03:'));
    blocks.shift()
    for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];

        const rows = block.split(String.fromCharCode(13, 10));
        const type = rows[0];
        const id = rows[1].split(':')[1]
        if (!parsedScd[type]) {
            parsedScd[type] = {};
        }
        // console.log(id);
        parsedScd[type][id] = {};
        // const elements = {'type': rows[0] };
        for (let i = 2; i < rows.length; i++) {
            const row = rows[i]
            if (row == '') {
                continue;
            }
            const rs = row.split(':');
            parsedScd[type][id][rs[0]] = rs[1];
        }
    }
    // console.log(parsedScd);
    return parsedScd;
}



const toGeojson = function (bufferData) {
    let errors = [];
    const THFstrUtf8 = bufferData.THF.toString(); // => en UTF8 mais c'est pas grave
    const encoding = getEncoding(THFstrUtf8); // permet de recupérer l'encodage
    // console.log(encoding);
   
    // const THFstr = iconv.decode(bufferData.THF, encoding); // convertit en utf8
    const QALstr = iconv.decode(bufferData.QAL, encoding);
    const GEOstr = iconv.decode(bufferData.GEO, encoding);
    // const SCDstr = iconv.decode(bufferData.SCD, encoding);
    const proj = getProjection(GEOstr);
    const crs = {
        "type": "EPSG",
        "properties": {
            "code": proj.epsg
        }
    }
    const year = getAnnee(THFstrUtf8);
    // console.log(year)
    const actu = getActualite(QALstr);
    // const parsedSCD = parseSCD(SCDstr);
    // console.log(parsedSCD);

    const VECstrs = [];

    for (let i = 0; i < bufferData.VEC.length; i++) {
        VECstrs.push(iconv.decode(bufferData.VEC[i], encoding))
    }
    // les VEC des 4 feuilles sont dedans...
    let result = { 'PNO': {}, 'PAR': {}, 'PFE': {}, 'FEA': {}, 'LNK': {} };
    for (let vec of VECstrs) {
        //ici on a tout ce qu'il faut pour generer les geometrie
        const parsedVec = parseVEC(vec);
        // TODO utiliser SCP ici
        // for (let id in parsedVec['LNK']) { // on ne l'utilise pas...
        //     let currentLNK = parsedVec['LNK'][id];
        //     let SCP = currentLNK['SCP'];
        //     if (SCP.RTY == 'REL') {
        //         if (['ID_S_RCO_NOD_FIN', 'ID_S_RCO_NOD_INI'].indexOf(SCP.RID) !== -1) {
        //             let arc = parsedVec.PAR[currentLNK.FTP[0].RID]
        //             let noeud = parsedVec.PNO[currentLNK.FTP[1].RID]
        //             if (!arc.nodes) { arc['nodes'] = [] };
        //             arc.nodes.push(noeud)
        //         }
        //     }
        // }

        // relation entre les PAR et les FEA
        for (let id in parsedVec['LNK']) {
            let currentLNK = parsedVec['LNK'][id];
            let SCP = currentLNK['SCP'];
            if (SCP.RTY == 'REL') {
                if (['ID_S_RCO_FAC_GCHE', 'ID_S_RCO_FAC_DRTE'].indexOf(SCP.RID) !== -1) {
                    let arc = parsedVec.PAR[currentLNK.FTP[0].RID]
                    let face = parsedVec.PFE[currentLNK.FTP[1].RID]
                    if (!face.arcs) { face['arcs'] = [] };
                    face.arcs.push(arc)
                }
            }
        }

        for (let id in parsedVec['LNK']) {
            let currentLNK = parsedVec['LNK'][id];
            let SCP = currentLNK['SCP'];
            if (SCP.RTY == 'REL') {

                if (currentLNK.FTP[0].RTY == 'FEA') {
                    let fea = parsedVec.FEA[currentLNK.FTP[0].RID]

                    // console.log(fea)
                    // console.log(currentLNK.FTP);
                    let pfeLnk = currentLNK.FTP.filter(p => p.RTY === 'PFE');
                    let parLnk = currentLNK.FTP.filter(p => p.RTY === 'PAR');
                    let pnoLnk = currentLNK.FTP.filter(p => p.RTY === 'PNO');
                    if (pfeLnk.length > 0) {
                        let geoms = pfeLnk.map(pf => generateRingFromPFE(parsedVec.PFE[pf.RID], pf.RID));
                        if (geoms.length == 1) {
                            fea['geometry'] = geoms[0]
                        } else if (geoms.length > 1) {
                            let multiPoly = { "type": "Feature", "properties": {}, "geometry": geoms[0] };
                            for (let q = 1; q < geoms.length; q++) {
                                multiPoly = union(multiPoly, { "type": "Feature", "properties": {}, "geometry": geoms[q] });
                            }
                            fea['geometry'] = multiPoly.geometry
                        } else {
                            console.log('PAS DE PFE DANS LE FEA')
                        }
                    } else if (parLnk.length > 0) {
                        let geomsCoords = parLnk.map(p => parsedVec.PAR[p.RID].COR);
                        if (geomsCoords.length == 1) {
                            fea['geometry'] = {  'type': 'LineString', "coordinates" : geomsCoords[0]}
                        } else if( geomsCoords.length > 1){
                            fea['geometry'] = {  'type': 'MultiLineString', "coordinates" : geomsCoords}
                        }
                        // { "type": "LineString", "coordinates": coords[0] }

                    }
                    else if (pnoLnk.length > 0) {
                        let geomsCoords = pnoLnk.map(p =>  parsedVec.PNO[p.RID].COR);
                        if (geomsCoords.length == 1) {
                            fea['geometry'] = {  'type': 'Point', "coordinates": geomsCoords[0][0] }
                        } else if( geomsCoords.length > 1){
                            fea['geometry'] = {  'type': 'MultiPoint', "coordinates" : geomsCoords[0]}
                        }
                    } else {
                        errors.push({'error': 'La FEA ne possède pas de PNO, PAR ou PFE', 'fea': fea });
                    }


                    if( !fea.geometry){
                        errors.push({'error': 'PAS DE geometrie dans la FEA', 'fea': fea });
                    }
                    if( Array.isArray(fea.geometry)){
                        errors.push({'error': 'la geometrie de la FEA est un array vide', 'fea': fea });
                    }

                }
            }
        }

        for (let id in parsedVec['FEA']) {
            result['FEA'][id] = parsedVec['FEA'][id];
        }
        for (let id in parsedVec['LNK']) {
            result['LNK'][id] = parsedVec['LNK'][id];
        }

    };

    let geojsons = {}

    for (let id in result['FEA']) {


        let fea = result['FEA'][id];
        // if (id == 'Objet_214345'){

        // }

        let tableId = fea['SCP']['RID'];
        if (!geojsons[tableId]) {
            geojsons[tableId] = {
                "type": "FeatureCollection",
                "crs": crs,
                "features": []
            }
        }
        const feature = {
            "type": "Feature",
            "properties": { _id: id, ...getProperties(fea, actu) },
            "geometry": fea.geometry
        }
        geojsons[tableId].features.push(feature);
    }


    const rels = {};
    for (let id in result['LNK']) {
        const lnk = result['LNK'][id];
        if (lnk.SCP.RTY == 'ASS') {
            let type = lnk.SCP.RID;
            if (!rels[type]) {
                rels[type] = [];
            }
            const parentProperties = { _id: lnk.FTP[0].RID, ...getProperties(result[lnk.FTP[0].RTY][lnk.FTP[0].RID]) }
            for (let i = 1; i < lnk.FTP.length; i++) {
                let rel = {};
                rel[result[lnk.FTP[0].RTY][lnk.FTP[0].RID].SCP.RID] = parentProperties; // parent
                const childProperties = { _id: lnk.FTP[0].RID, ...getProperties(result[lnk.FTP[i].RTY][lnk.FTP[i].RID]) };
                rel[result[lnk.FTP[i].RTY][lnk.FTP[i].RID].SCP.RID] = childProperties; // child
                rels[type].push(rel);
            }
        }
    }

    return { 'geojsons': geojsons, 'relations': rels, 'errors':errors };
}

// module.exports = toGeojson;
export default toGeojson