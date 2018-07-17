
const iconv = require('iconv-lite');

const turfPoint = require('turf-point');
const turfPolygon = require('turf-polygon');
const turfInside = require('@turf/inside');
const turfUnion = require('@turf/union');
const turfPointOnSurface = require('@turf/point-on-surface');
const cryptography = require("cryptography");



let options = {
    geomHash: false,
    filter: true
}

const projections = { 
    "LAMB93": { "epsg": 2154}, 
    "RGF93CC42": { "epsg": 3942 }, 
    "RGF93CC43": { "epsg": 3943 }, 
    "RGF93CC44": { "epsg": 3944 }, 
    "RGF93CC45": { "epsg": 3945 }, 
    "RGF93CC46": { "epsg": 3946 }, 
    "RGF93CC47": { "epsg": 3947 }, 
    "RGF93CC48": { "epsg": 3948 }, 
    "RGF93CC49": { "epsg": 3949 }, 
    "RGF93CC50": { "epsg": 3950 }, 
    "GUAD48UTM20": { "epsg": 2070 }, 
    "MART38UTM20": { "epsg": 2973 }, 
    "RGFG95UTM22": { "epsg": 2972 }, 
    "RGR92UTM": { "epsg": 2975 } 
} 

const stringToDate = function(dateStr){
    if (dateStr.trim() === ''){
        return null;
    } else if (/^[1-2][0-9][0-9][0-9][0-1][0-9][0-3][0-9]$/.test(dateStr) ) { // YYYYMMDD
        return dateStr.substr(0,4) + '-' + dateStr.substr(4,2)+ '-' + dateStr.substr(6,2);

    } else if(/^[0-3][0-9]\/[0-1][0-9]\/[1-2][0-9][0-9][0-9]$/.test(dateStr)){ // DD/MM/YYYY
        return dateStr.substr(6,4) + '-' + dateStr.substr(3,2)+ '-' + dateStr.substr(0,2);
    }else {
        return null
    }
}

const sc_config = require("./schema.default.json")


const firstPointIsInPolygon = function (poly1, poly2) {
    try {
        const point = turfPoint(poly1[0]);
        const polygon = turfPolygon([poly2])
        return turfInside(point, polygon);     
    } catch (error) {
        console.log(error);
        return false;
    }

}

const edigeo2Json = function (data_VEC, projection, code_dep, annee, _options = null, qualite = null) {
    data_VEC = data_VEC.toString();
    if (_options) {
        for (opt in _options) {
            options[opt] = _options[opt];
        }

    }


    let PARs = [];
    let PFEs = [];
    let PNOs = [];
    let FEAs = [];
    let LNKs = [];

    let arr_RTYSA = data_VEC.split("RTYSA03"); // array avec les blocs (PAR(arc), PNO(noeud), PFE(face),LINK(lien) ...)

    /*L'objet est un arc*/
    const case_ARC = function (array_RTYSA_ligne_arc, projection) {
        const id_arc = String(array_RTYSA_ligne_arc[1]).split(":")[1];
        const coords = extract_coords_arc(array_RTYSA_ligne_arc, projection);

        PARs[id_arc] = { coords: coords };
        PARs[id_arc]['geometryGeoJson'] = { "type": "LineString", "coordinates": coords }

    };

    /*l'objet est une face (PFE)*/
    const case_Face = function (array_RTYSA_ligne_face) { // => PFE on initialise les futures faces
        const id_face = String(array_RTYSA_ligne_face[1]).split(":")[1];

        PFEs[id_face] = { coords: [] };
    };

    /* L'objet est un noeud (PNO)*/
    const case_Noeud = function (array_RTYSA_ligne_face, projection) {
        const id_noeud = String(array_RTYSA_ligne_face[1]).split(":")[1];
        const coord_noeud = String(array_RTYSA_ligne_face[5]).split(":")[1];
        const extract_coord = coord_noeud.match(/[0-9-\.]+/g);
        let coords = Array(parseFloat(extract_coord[0]), parseFloat(extract_coord[1]));//[lng,lat];

        PNOs[id_noeud] = { coords: coords, geometryGeoJson: { "type": "Point", "coordinates": coords } };
    };

    /*L'objet est un lien*/
    const case_LNK = function (array_RTYSA_ligne) {

        const id_lnk = String(array_RTYSA_ligne[1]).split(":")[1];
        LNKs[id_lnk] = { type: String(array_RTYSA_ligne[3]).split(";")[3] };

        let count_true = 0;
        const contenant = [];
        for (let k = 1, n = array_RTYSA_ligne.length; k < n; k++) {

            if (/FTPCP/g.test(array_RTYSA_ligne[k]) == true) {
                if (count_true == 0) {
                    LNKs[id_lnk].contenu = String(array_RTYSA_ligne[k]).split(";")[3];
                    LNKs[id_lnk].contenu_type = String(array_RTYSA_ligne[k]).split(";")[2]; // type d'objet
                    count_true++;
                }
                else if (count_true > 0) {
                    contenant.push(String(array_RTYSA_ligne[k]).split(";")[3]);
                    LNKs[id_lnk].contenant_type = String(array_RTYSA_ligne[k]).split(";")[2];// type d'objet
                    count_true++;
                }
            }
        }
        LNKs[id_lnk].contenant = contenant;
    };


    // L'objet est un FEA, on initialise les objets presents et récupere les attributs de ce dernier
    const create_objet = function (array_RTYSA_ligne) {

        // on prend l'id de l'objet et son type qui sont toujours bien placé (l1 et 3);
        const id_objet = String(array_RTYSA_ligne[1]).split(":")[1];
        const type_fea = String(array_RTYSA_ligne[3]).split(";")[3];
            
        FEAs[id_objet] = {
            type: type_fea, geometryGeoJson: '',
            createDate: '', updateDate: '', type_update: '', peren_maj: '', tx_changement: '', date_fin_valid: ''
        }; // <= qualite

        //extraction des attributs
        let nom_attribut = "";
        let count_true = 0;

        for (let k = 1; k < array_RTYSA_ligne.length; k++) {
            if (/ATP..../g.test(array_RTYSA_ligne[k]) == true && count_true == 0) {
                nom_attribut = String(array_RTYSA_ligne[k]).split(";")[3];
            }
            else if (/ATV..../g.test(array_RTYSA_ligne[k]) == true && nom_attribut != "") {
                FEAs[id_objet][nom_attribut] = String(array_RTYSA_ligne[k]).split(":")[1];
            }
            else if (/^QAPCP*/g.test(array_RTYSA_ligne[k]) == true && qualite) { // qualite!
                const idObjQualite = String(array_RTYSA_ligne[k]).split(";")[3];
                if (qualite[idObjQualite]) {
                    for (const q in qualite[idObjQualite]) {
                        FEAs[id_objet][q] = qualite[idObjQualite][q];
                    }
                }
            }
        }
    };


    for (let j = 1; j < arr_RTYSA.length; j++) {
        const curre_RTYSA = arr_RTYSA[j] // feature actuelle entre RTYSA
        const arr_ligne = curre_RTYSA.split(String.fromCharCode(13, 10)); // décompose les lignes

        if (arr_ligne[0] == ":PAR") {
            case_ARC(arr_ligne, projection);
        }

        else if (arr_ligne[0] == ":PFE") {
            case_Face(arr_ligne);
        }

        else if (arr_ligne[0] == ":PNO") {
            case_Noeud(arr_ligne, projection);
        }
        else if (arr_ligne[0] == ":LNK") {
            case_LNK(arr_ligne);
        }

        else if (arr_ligne[0] == ":FEA") {
            create_objet(arr_ligne);
        } else{
 
        }
    }


    for (let id_lnk in LNKs) {
        //si c'est une face, c'est spécial, on rempli le PFEs
        // Objet_156551 // 

        if (LNKs[id_lnk].type == "ID_S_RCO_FAC_DRTE" || LNKs[id_lnk].type == "ID_S_RCO_FAC_GCHE") {
            const face = LNKs[id_lnk].contenant

            const Arc = LNKs[id_lnk].contenu
            let clone_arr_arc = [];
            clone_arr_arc = PARs[Arc].coords.slice(); // on clone le tableau de coordonnée pour que le reverse ne touche pas l'original
            if (LNKs[id_lnk].type == "ID_S_RCO_FAC_DRTE") {
                clone_arr_arc = clone_arr_arc.reverse();
            }
            if (PFEs[face]) {
                PFEs[face].coords.push(clone_arr_arc);
            }
        }
    }


    // on lui donne la liste des arcs => liste de polygons fermés
    const generatePolygonsFromArcs = function (_arcs, id_face) {
        const arcs = JSON.parse(JSON.stringify(_arcs));
        const polygons = [];

        // Les arcs qui boucles sur eux même  => Polygons puis on les supprimes
        for (let i = arcs.length - 1; i >= 0; i--) {
            if (arcs[i][0].toString() == arcs[i][arcs[i].length - 1].toString()) {
    
                /* 
                Un polygon doit avoir au moins 4 pairs de coordonnées ( la 1ere =  la dernière)
                Sinon c'est juste une ligne ...
                */
                if (arcs[i].length > 3){
                    polygons.push(arcs[i]);
                } else {
                    console.log('WTF ? un polygon à 2 points ?!')
                }
               
                arcs.splice(i, 1);
            }
        }


        const relArc = [];
        for (let i = 0; i < arcs.length; i++) {
            for (let j = 0; j < arcs.length; j++) {
                if (j != i) {
                    let cloneIReverse = [];
                    cloneIReverse = arcs[i].slice(); // on clone le tableau de coordonnée pour que le reverse ne touche pas l'original
                    cloneIReverse = cloneIReverse.reverse();

                    if (arcs[i][arcs[i].length - 1].toString() == arcs[j][0].toString()) {
                        relArc.push({ endOf: i, startOf: j })

                    // Dans de rare cas, les coordonéees sont pas dans le bon ordre... tsss
                    } else if (cloneIReverse[cloneIReverse.length - 1].toString() == arcs[j][0].toString() ){
                        arcs[j] = arcs[j].reverse();
                        relArc.push({ endOf: i, startOf: j, reverse: true })
                    }
                }
            }
        }

        function findChainPolygonIndex(relArc) {
            let res = [relArc[0].endOf, relArc[0].startOf];
            let o = 0;
            while (res[0] != res[res.length - 1]) { //for
                const nextIndex = findNextIndex(relArc, res[res.length - 1])
                res.push(nextIndex);
                o++;

                if (o > relArc.length) {
                    polygons.push([])
                    return;
                }
            }

            res.pop();
            let ring = arcs[res[0]].slice(0);
            for (let k = 1; k < res.length; k++) {
                ring.pop();
                ring = ring.concat(arcs[res[k]]) // clone suppression de la derniere coords  + c
            }

            polygons.push(ring);
            return res;
        }

        function findNextIndex(relArc, startOf) {
            for (let i = 0; i < relArc.length; i++) {
                if (relArc[i].endOf == startOf) {
                    return relArc[i].startOf
                }
            }
            return null;
        }


        const orderOfArcs = [];
        while (relArc.length > 0) {

            const tpmp = findChainPolygonIndex(relArc);
            if (!tpmp) return [];

            orderOfArcs.push(tpmp);
            for (let i = relArc.length - 1; i >= 0; i--) {
                if (tpmp.indexOf(relArc[i].endOf) != -1) {
                    relArc.splice(i, 1);
                }
            }
        }
        return polygons;
    }


    /*On chaine les géométries des polygones*/
    let chainageFace = function () {
        for (const id_face in PFEs) {

            let arcsOfFace = [];
            arcsOfFace = arcsOfFace.concat(PFEs[id_face].coords); // tableau avec la face en cours et les arcs qui lui sont associés;
            
            const listOfPolygons = generatePolygonsFromArcs(arcsOfFace, id_face); // => on a les polygon qui compose la face

            // on cherche quels polygones contient d'autre (multiPolygon, polygon a trou, etc...)
            const rings = [];
            // TODO regarder la ligne d'en dessous, il me semble que c'est un polygon uniquement
            if (listOfPolygons.length > 1) { // => trou ou/et multi polygon  -(un polygon a trou seulement?)
                // console.log(JSON.stringify(listOfPolygons));
                const indexFinded = [];
                for (let i = 0; i < listOfPolygons.length; i++) {
                    for (let j = 0; j < listOfPolygons.length; j++) {
                        if (i !== j) {
                            if (firstPointIsInPolygon(listOfPolygons[i], listOfPolygons[j])) { // le polygon I est contenu par un autre
                                if (indexFinded.indexOf(i) == -1) {
                                    if (!rings[j.toString()]) rings[j.toString()] = [];
                                    rings[j.toString()].push(i);
                                    indexFinded.push(i)
                                }
                                break
                            }
                            else if (firstPointIsInPolygon(listOfPolygons[j], listOfPolygons[i])) { // le polygon I contient un autre
                                if (indexFinded.indexOf(j) == -1) {
                                    if (!rings[i.toString()]) rings[i.toString()] = [];
                                    rings[i.toString()].push(j);
                                    indexFinded.push(j)
                                }
                                break
                            }
                        }
                    }
                    if (indexFinded.indexOf(i) == -1 && !rings[i]) { // WTF?  le polygon n'appartient à personne et ne contient personne
                        rings[i.toString()] = [];

                    }
                }
            } else { // => il est tout seul
                rings['0'] = [];
            }

            // on genere les polygones complexes (ou pas);
            let polygon = [];
            let t = 0;
            for (let i in rings) {
                polygon[t] = [];
                polygon[t].push(listOfPolygons[i]); // outerRing
                if (rings[i].length > 0) { //y'a des trous! => innerRing
                    for (let j = 0; j < rings[i].length; j++) {
                        polygon[t].push(listOfPolygons[rings[i][j]]);
                    }
                }
                t++;
            }

            if (listOfPolygons.length > 0) { //=> y'a bien au moins un polygone != Face_0 par exemple
                let geometryGeoJson = { "type": "Polygon", "coordinates": polygon[0] };
            
                if (geometryGeoJson) {
                    PFEs[id_face]['geometryGeoJson'] = geometryGeoJson;
                }
            }
        }
    }

    chainageFace();
    //on reparcours la table LINK pour faire les relations entre FEA et [PAR,PFE,PNO] => La table FEA est la table finale!

    for (const id_lnk2 in LNKs) {
        if (LNKs[id_lnk2].contenu_type == 'FEA') {

            if (LNKs[id_lnk2].contenant_type == "PFE") { // Dans le Cas FEA/PFE => Geometrie dans FEA

                if (LNKs[id_lnk2].contenant.length > 1) { // => C'est un multi polygon! Union des polygones qui le compose
                    let multiPoly = { "type": "Feature", "properties": {}, "geometry": PFEs[LNKs[id_lnk2].contenant[0]].geometryGeoJson };
                    for (let q = 1; q < LNKs[id_lnk2].contenant.length; q++) {
                        multiPoly = turfUnion(multiPoly, { "type": "Feature", "properties": {}, "geometry": PFEs[LNKs[id_lnk2].contenant[q]].geometryGeoJson });
                    }
                    // console.log(multiPoly.geometry)
                    FEAs[LNKs[id_lnk2].contenu].geometryGeoJson = multiPoly.geometry;


                }
                else {

                    FEAs[LNKs[id_lnk2].contenu].geometryGeoJson = PFEs[LNKs[id_lnk2].contenant[0]].geometryGeoJson;
                }

            }
            else if (LNKs[id_lnk2].contenant_type == "PAR") {// Dans le Cas FEA/PAR => Geometrie dans FEA
                if (LNKs[id_lnk2].contenant.length > 1) { // => C'est une MultiLineString! 
                    const multiLineCoords = [];
                    for (let q = 0; q < LNKs[id_lnk2].contenant.length; q++) {
                        multiLineCoords.push(PARs[LNKs[id_lnk2].contenant[q]].coords);
                    }
                    const multiLineGeom = { type: 'MultiLineString', coordinates: multiLineCoords };

                    FEAs[LNKs[id_lnk2].contenu].geometryGeoJson = multiLineGeom;

                }
                else {
                    FEAs[LNKs[id_lnk2].contenu].geometryGeoJson = PARs[LNKs[id_lnk2].contenant[0]].geometryGeoJson;
                }

            }
            else if (LNKs[id_lnk2].contenant_type == "PNO") {// Dans le Cas FEA/PNO => Geometrie dans FEA
                FEAs[LNKs[id_lnk2].contenu].geometryGeoJson = PNOs[LNKs[id_lnk2].contenant].geometryGeoJson;

            }
        }
    }


    const features = []; // données structurées à l'état final pour les liens

    for (const o in LNKs) {
        LNKs[o].contenant = LNKs[o].contenant[0];
        if (sc_config[LNKs[o].type]) { // => C'est dans le schema, on extrait les attributs et on l'extrait
            const table = sc_config[LNKs[o].type].table;
            const att = sc_config[LNKs[o].type].att;
            const current_obj = {};
            if (!features[table]) { // si l'objet qui va stocker la table n'existe pas
                features[table] = [];
            }
            for (const a in att) {
                current_obj[att[a].name] = LNKs[o][a];
            }
            features[table].push(current_obj);
        }
    }

    // données structurées à l'état final des objets géographiques
    for (const o in FEAs) {

        if (sc_config[FEAs[o].type] || !options.filter) { //présent dans la config
            let table = options.filter ? sc_config[FEAs[o].type].table : FEAs[o].type

            let feature = { "type": "Feature", "properties": {}, "geometry": FEAs[o].geometryGeoJson }
            feature.properties['objectid'] = o;
            feature.properties['annee'] = annee;

            if (qualite) {
                feature.properties['create_date'] = stringToDate(FEAs[o].createDate);
                feature.properties['update_date'] = stringToDate(FEAs[o].updateDate);
                feature.properties['type_update'] = parseInt(FEAs[o].type_update);
                feature.properties['peren_maj'] = parseInt(FEAs[o].peren_maj);
                feature.properties['tx_changement'] = FEAs[o].tx_changement;
                feature.properties['date_fin_valid'] = parseInt(FEAs[o].date_fin_valid);
            }

            if (!features[table]) { // si l'objet qui va stocker la table n'existe pas
                features[table] = [];
            }

            // Y'a des attributs spécifiques => options.filter == true
            if (options.filter && sc_config[FEAs[o].type].att) {
                const att = sc_config[FEAs[o].type].att;
                for (const a in att) {
                    let value = FEAs[o][a];

                    if (att[a].fct) { // si il y a une fonction
                        switch (att[a].fct) {
                            case 'toNumber': // transforme une chaine en number...
                                value = parseFloat(FEAs[o][a]);
                                break;
                            
                            case 'toDate': // transforme une chaine en  date YYYY-MM-DD...
                            value = stringToDate(FEAs[o][a]);
                            break;

                            case 'idsection':
                                FEAs[o]['COMMUNE_ID'] = code_dep + FEAs[o][a].substr(-8, 3);
                                FEAs[o]['NUM_SECTION'] = FEAs[o][a].substr(-2, 2);
                                FEAs[o]['PREFIX_SECTION'] = FEAs[o][a].substr(-5, 3);
                                value = code_dep + FEAs[o][a].substr(-8, 8);
                                break;

                            case 'idcommune':
                                // FEAs[o]['COMMUNE_ID'] = code_dep + FEAs[o][a].substr(-8, 3);
                                value = code_dep + FEAs[o][a].substr(-8, 8);
                                break;

                            case 'idsubsection':
                                //076 000 0Z 01
                                //076 000 0C
                                FEAs[o]['SECTION_ID'] = code_dep + FEAs[o][a].substr(-10, 8);
                                FEAs[o]['NUM_SUBSECTION'] = FEAs[o][a].substr(-2, 2);
                                FEAs[o]['NUM_SECTION'] = FEAs[o][a].substr(-4, 2);
                                FEAs[o]['PREFIX_SECTION'] = FEAs[o][a].substr(-7, 3);
                                FEAs[o]['COMMUNE_ID'] = code_dep + FEAs[o][a].substr(-10, 3);
                                value = code_dep + FEAs[o][a].substr(-10, 10);
                                break;

                            case 'idParcelle':
                                //On ajoute les sous identifiants au FEAs
                                FEAs[o]['SUBSECTION_ID'] = code_dep + FEAs[o][a].substr(-12, 10);
                                FEAs[o]['SECTION_ID'] = code_dep + FEAs[o][a].substr(-12, 8);
                                FEAs[o]['NUM_PARCELLE'] = FEAs[o][a].substr(-4, 4);
                                FEAs[o]['NUM_SECTION'] = FEAs[o][a].substr(-6, 2);
                                FEAs[o]['PREFIX_SECTION'] = FEAs[o][a].substr(-9, 3);
                                FEAs[o]['COMMUNE_ID'] = code_dep + FEAs[o][a].substr(-12, 3);
                                value = code_dep + FEAs[o][a].substr(-12, 12); //cas ou il y a le code département devant//0760000A0135
                                break;
                        }
                    }
                    feature.properties[[att[a].name]] = value;
                }

            } else { //y'a pas d'attributs spécifique, ou pas de filtre, on met tous! 
                const attIgnore = ['type', 'geometryGeoJson', 'createDate', 'updateDate', 'peren_maj', 'tx_changement', 'date_fin_valid', 'type_update']
                //console.log(FEAs[o])
                for (key in FEAs[o]) {

                    if (attIgnore.indexOf(key) == -1) {
                        //console.log(key);
                        feature.properties[key] = FEAs[o][key];
                    }
                }
            }

            features[table].push(feature);
        }

    }
    return features;
};

//transforme les coordonnées comprises dans en arc en xxx yyyy, xxx2 yyyy2, etc (dans un tableau indexé (pour pouvoir le retourner au besoin);
const extract_coords_arc = function (array_ligne, projection) {
    const coords = [];
    // trouve les coordonnées
    for (let i = 0, n = array_ligne.length; i < n; i++) {
        const split = array_ligne[i].split(':');
        if (/COR*/g.test(split[0]) == true) {
            const coord_brute = split[1];
            const extract_coord = coord_brute.match(/[0-9-\.]+/g);
            let coords_lng_lat = Array(parseFloat(extract_coord[0]), parseFloat(extract_coord[1]));//[lng,lat];
            coords.push(coords_lng_lat);
        }
    }
    return coords;
};


/*Récupère la projection en entrée*/
const getProjection = function (GEO_file) {
    if (!GEO_file) return null;

    GEO_file = GEO_file.toString();
    const rows = GEO_file.split(String.fromCharCode(13, 10)); // décompose les lignes
    for (let i = 0; i < rows.length; i++) {
        if (/^RELSA09*/g.test(rows[i])) {
            return rows[i].split(':')[1];
        }
    }
    return null;
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

// relations entre les parcelles et les batiments/suf
// => grace à indexIds on divise le temps d'execution par 2 par rapport au find de lodash
const getRels = function (JSONSufParcelle, JSONBatimentParcelle, GeoJsonParcelle, GeoJsonSuf, GeoJsonBatiment, indexIds) {
    //SUF PARCELLE
    if (JSONSufParcelle && GeoJsonParcelle && GeoJsonParcelle.features) {
        for (let i = 0; i < JSONSufParcelle.length; i++) {

            const parcelleIdx = indexIds['EDI_PARCELLE'].indexOf(JSONSufParcelle[i].parcelle_id);
            const parcelle = (parcelleIdx == -1) ? undefined : GeoJsonParcelle.features[parcelleIdx] ;   
            
            const sufIdx = indexIds['EDI_SUF'].indexOf(JSONSufParcelle[i].suf_id);
            const suf = (sufIdx == -1) ? undefined : GeoJsonSuf.features[sufIdx]
           
            try {
                if (suf.geometry){
                    const pointOnSuf = turfPointOnSurface(suf);
                    if (turfInside(pointOnSuf, parcelle)) {
                        suf.properties['parcelle_id'] = parcelle.properties.parcelle_id;
                    } 
                }

            } catch (error) {
                console.log(error);
            }
 
        }
    }

    //BATIMENT PARCELLE
    if (JSONBatimentParcelle && GeoJsonParcelle && GeoJsonParcelle.features) {
        for (let i = 0; i < JSONBatimentParcelle.length; i++) {
            const parcelleIdx = indexIds['EDI_PARCELLE'].indexOf(JSONBatimentParcelle[i].parcelle_id);
            const parcelle = (parcelleIdx == -1) ? undefined : GeoJsonParcelle.features[parcelleIdx] ; 

            const batimentIdx = indexIds['EDI_BATIMENT'].indexOf(JSONBatimentParcelle[i].batiment_id);
            const batiment = (batimentIdx == -1) ? undefined : GeoJsonBatiment.features[batimentIdx] ;

            try {
                const pointOnSuf = turfPointOnSurface(batiment);
                if (parcelle.geometry && turfInside(pointOnSuf, parcelle)) {
                    batiment.properties['parcelle_id'] = parcelle.properties.parcelle_id;
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    return { GeoJsonSuf: GeoJsonSuf, GeoJsonBatiment: GeoJsonBatiment }
}

const toGeojson = function (bufferData, dep, opt) {
    const THFstrUtf8 = bufferData.THF.toString(); // => en UTF8 mais c'est pas grave
    const encoding = getEncoding(THFstrUtf8); // permet de recupérer l'encodage
    const THFstr = iconv.decode(bufferData.THF, encoding); // convertit en utf8
    const QALstr = iconv.decode(bufferData.QAL, encoding);
    const GEOstr = iconv.decode(bufferData.GEO, encoding);
    const VECstrs = [];

    for (let i = 0; i < bufferData.VEC.length; i++) {
        VECstrs.push(iconv.decode(bufferData.VEC[i], encoding))
    }


    if (!VECstrs) return null;
    const qualite = getActualite(QALstr);
    const projectionCode = getProjection(GEOstr);
    const annee = getAnnee(THFstr);

    const crs = {
        "type": "EPSG",
        "properties": {
            "code": (projections[projectionCode].epsg )
        }
    }

    let result = [];
    let indexIds ={'EDI_PARCELLE':[], 'EDI_BATIMENT':[], 'EDI_SUF':[]}
    for (let i = 0; i < VECstrs.length; i++) {
        const res = edigeo2Json(VECstrs[i], projectionCode, dep, annee, opt, qualite)
        for (let k in res) {
            if (!result[k] && !/^EDI_REL/.test(k) ){ // si c'est pas une relation !
                result[k] =   {
                    "type": "FeatureCollection",
                    "crs": crs,
                    "features": []
                };
            } else { // C'est une relation, un json
                result[k] = [];
            }
            
            if (!/^EDI_REL/.test(k)){
                if (result[k]['features']){

                    for (let i =0; i < res[k].length; i++){
                        if (options.geomHash){
                            if (res[k][i].geometry){
                                const geomHash = cryptography.hashSync({
                                    data : JSON.stringify(res[k][i].geometry),
                                    algorithm : 'sha256'
                                });
                                res[k][i]['properties']['geom_hash'] = geomHash;
                            }else{ // Pas de geometry ?!
                                res[k][i]['properties']['geom_hash'] = null;
                            }
                        }
                        result[k]['features'].push(res[k][i]);

                        //pour la suite et ne pas utiliser le _.find de lodash qui est trèèèèèèès lent...
                        if (/^EDI_PARCELLE/.test(k)){
                            indexIds['EDI_PARCELLE'].push(res[k][i]['properties']['objectid']);
                        } else if(/^EDI_BATIMENT/.test(k)){
                            indexIds['EDI_BATIMENT'].push(res[k][i]['properties']['objectid']);
                        } else if(/^EDI_SUF/.test(k)){
                            indexIds['EDI_SUF'].push(res[k][i]['properties']['objectid']);
                        }
                    }
                   
                } else {
                    // console.log('????', k, result[k])
                }
               
            } else {
                for (let i =0; i < res[k].length; i++){
                    result[k].push(res[k][i])
                }
            } 
        }
    }

    if(options.filter){ 
        const relSufBatiment = getRels(result['EDI_REL_SUF_PARCELLE'],
        result['EDI_REL_BATIMENT_PARCELLE'],
        result['EDI_PARCELLE'],
        result['EDI_SUF'],
        result['EDI_BATIMENT'],
        indexIds);

    }

    return result;
}

module.exports = toGeojson;