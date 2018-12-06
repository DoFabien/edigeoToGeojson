const turf = require('@turf/turf');

const firstPointIsInPolygon = function (poly1, poly2) {
    try {
        const point = turf.point(poly1[0]);
        const polygon = turf.polygon([poly2])
        return turf.inside(point, polygon);     
    } catch (error) {
        console.log(error);
        return false;
    }

}

const generateGeometry = function( _rings){
           
        // TODO : Il faudrait modifier tout ça ... Il faut juste trouver le ring exterieur, les multi polygones c'est ailleurs
        // on cherche quels polygones contient d'autre (multiPolygon, polygon a trou, etc...)
        const rings = [];
        // TODO regarder la ligne d'en dessous, il me semble que c'est un polygon uniquement
        if (_rings.length > 1) { // => trou ou/et multi polygon  -(un polygon a trou seulement?)
            // console.log(JSON.stringify(_rings));
            const indexFinded = [];
            for (let i = 0; i < _rings.length; i++) {
               
                for (let j = 0; j < _rings.length; j++) {
                    if (i !== j) {
                       
                        if (firstPointIsInPolygon(_rings[i], _rings[j])) { // le polygon I est contenu par un autre
                            if (indexFinded.indexOf(i) == -1) {
                                if (!rings[j.toString()]) rings[j.toString()] = [];
                                rings[j.toString()].push(i);
                                indexFinded.push(i)
                            }
                            break
                        }
                        else if (firstPointIsInPolygon(_rings[j], _rings[i])) { // le polygon I contient un autre
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
            polygon[t].push(_rings[i]); // outerRing
            if (rings[i].length > 0) { //y'a des trous! => innerRing
                for (let j = 0; j < rings[i].length; j++) {
                    polygon[t].push(_rings[rings[i][j]]);
                }
            }
            t++;
        }

        if (_rings.length > 0) { //=> y'a bien au moins un polygone != Face_0 par exemple
            return { "type": "Polygon", "coordinates": polygon[0] };
        } else {
            return [];
        }
    
}

const countNbRes = function (arr, searchTerm) {
    let nbRes = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] == searchTerm) {
            nbRes++;
        }
    }
    return nbRes;
}

//touve les arcs qui sont en cul de sac... Renvoie les index
const getArcsCulDeSac = function (arcs, id_face) {
    let firstPoints = [];
    let endPoints = [];
    let culDeSac = [];
    for (let i = 0; i < arcs.length; i++) {
        firstPoints.push(arcs[i][0]);
        endPoints.push(arcs[i][arcs[i].length - 1])
    }

    for (let i = 0; i < arcs.length; i++) {
        let summary = [countNbRes(firstPoints, arcs[i][0].toString()) ,
            countNbRes(endPoints, arcs[i][0].toString()), 
            countNbRes(firstPoints, arcs[i][arcs[i].length - 1].toString()) ,
            countNbRes(endPoints, arcs[i][arcs[i].length - 1].toString()) 
        ]
        // let sum = summary.reduce((pv, cv) => pv+cv, 0);
        // console.log
        if (summary.join() !== [1,1,1,1].join()){
            console.log(i, id_face , summary);
            if (summary.indexOf(0) != -1){
                culDeSac.push(i);
            }
        }      

    }
    return culDeSac;

}

const generateRingFromPFE = function (pfe, id_face = null, clean=false) {
    // if (id_face == 'Face_428'){
    //     console.log(pfe)
    //     console.log(pfe['PAR'].map(p => p['SCP']))
    // }
    const _arcs = pfe['PAR'].map(p => p['COR'])
    // const cL = pfe['PAR'].map(p => p['childsLNK'])
    // if (cL.length > 5){
    //     console.log(cL)
    //     console.log('(------------)')
    // }
    // console.log(pfe)
    let arcs = JSON.parse(JSON.stringify(_arcs)); // Object.assign({}, _arcs); // _arcs.slice();
    if (id_face == 'Face_0') {
        generateGeometry([]);
    }
    if (clean){
        console.log('CLEAN = TRUE');
        // get les arcs qui sont en cul de sac
        let culDeSac = getArcsCulDeSac(arcs, id_face);
        if (culDeSac.length > 0){
            //on les supprimme ... 
            for (let i = arcs.length - 1; i >= 0; i--) {
                if (culDeSac.indexOf(i) !== -1){
                    arcs.splice(i,1);
                }
            }
        }
    }



    let rings = [];
    let ring = null

    // LOOP POUR TROUVER LES ARCS QUI BOUCLE SUR EUX MEME ET LES POUSSER COMME RING
    for (let i = arcs.length - 1; i >= 0; i--) {
        if (arcs[i][0].toString() == arcs[i][arcs[i].length - 1].toString()) {
            if (arcs[i].length > 3){ 
                rings.push(arcs[i]);
            }
            // else {} // A => B => A
            arcs.splice(i, 1);
        }
    }

    if (arcs.length == 0) {
        return generateGeometry(rings);
    }

    ring = arcs[arcs.length - 1];
    let ringFirstPoint = ring[0];
    let ringLastPoint = ring[ring.length - 1];
    arcs.splice(arcs.length - 1, 1)

    for (let i = arcs.length - 1; i >= 0; i--) {
        let currentCoords = arcs[i];
        let firstCoord = currentCoords[0]
        let lastCoord = currentCoords[currentCoords.length - 1];


        if (ringLastPoint.toString() == firstCoord.toString()) {
            // le ring se termine la 1ere coords de l'arc en cours
            // console.log('Case 1')
            ring.pop();
            ring = ring.concat(currentCoords);
            ringFirstPoint = ring[0];
            ringLastPoint = ring[ring.length - 1];
            arcs.splice(i, 1);
            i = arcs.length;


        } else if (ringFirstPoint.toString() == lastCoord.toString()) {
            // le ring se commence par la dernière coords de l'arc en cours
            // On ne change pas le sens, on pousse les coords en premier
            // console.log('Case  2')
            currentCoords.pop();
            ring = currentCoords.concat(ring);

            ringFirstPoint = ring[0];
            ringLastPoint = ring[ring.length - 1];
            arcs.splice(i, 1);
            i = arcs.length;


        }
        else if (ringLastPoint.toString() == lastCoord.toString()) {
            // console.log('Cas 3')

            let reversed = currentCoords.reverse();
            ring.pop();
            ring = ring.concat(reversed);
            ringFirstPoint = ring[0];
            ringLastPoint = ring[ring.length - 1];
            arcs.splice(i, 1);

            i = arcs.length;

        }
        else if (ringFirstPoint.toString() == firstCoord.toString()) {
            // il faut renverser les coords, et le placer en 1ere Poistion
            let reversed = currentCoords.reverse();
            reversed.pop();
            ring = reversed.concat(ring);

            ringFirstPoint = ring[0];
            ringLastPoint = ring[ring.length - 1];
            arcs.splice(i, 1);

            i = arcs.length;
        } else {

        }


        if (ringFirstPoint.toString() == ringLastPoint.toString()) {
            rings.push(ring);


            if (arcs.length == 0) {
                return  generateGeometry(rings);
            } else {
                ring = arcs[arcs.length - 1];
                arcs.splice(arcs.length - 1, 1)
                ringFirstPoint = ring[0];
                ringLastPoint = ring[ring.length - 1];
                i = arcs.length;
            }
        }

    }
    if (rings.length == 0 && !clean){
        console.log('oh oh, le ring est vide, on tente de le néttoyer ...')
       
        return generateRingFromPFE(pfe, id_face, true)
    } else if (clean){
        if (rings.length == 0){
            return null;
        }
        return generateGeometry(rings);
    }
    else {
        if (rings.length == 0){
            return null;
        }
        return generateGeometry(rings);
        
        // return generateGeometry(rings);
    }
    
}

module.exports = generateRingFromPFE;