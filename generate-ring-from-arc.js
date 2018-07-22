// const turf = require('@turf/turf');
// const fs = require('fs');

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
    
            // culDeSac.push(i);
            // console.log('CUL DE SAC' , i);
        

    }
    return culDeSac;

}

const generateRingFromArcs = function (_arcs, id_face = null, clean=false) {
    let arcs = JSON.parse(JSON.stringify(_arcs)); // Object.assign({}, _arcs); // _arcs.slice();
    if (id_face == 'Face_0') {
        return [];
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

    // DEBUG
    // if (id_face == 'Face_214612') {
    //     let r = [];
    //     console.log(arcs);
    //     for (let i = 0; i < arcs.length; i++) {
    //         let first = arcs[i][0].toString()
    //         let last = arcs[i][arcs[i].length - 1].toString();
    //         r.push(turf.lineString(arcs[i], { id: i, first: first, last: last }))
    //     }
    //     fs.writeFileSync('./fixture/debug_arc_' + (clean ? 'cleaned' : '') +'_'+ id_face + '.geojson', JSON.stringify(turf.featureCollection(r)));
    // }

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
        return rings;
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
            // console.log('Cas 4')
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
                return rings;
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
        return generateRingFromArcs(_arcs, id_face, true)
    } else if (clean){
        console.log('RESUSLT ', rings);
        return rings;
    }
    else {
        
        return rings;
    }
    
}

module.exports = generateRingFromArcs;