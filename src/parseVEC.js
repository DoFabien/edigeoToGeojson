const corToJsonCoords = function (cor) {
    const extract_coord = cor.match(/[0-9-\.]+/g);
    return Array(parseFloat(extract_coord[0]), parseFloat(extract_coord[1]))
}
const parseFtpScpNCo = function (FTPstr) {
    const split = FTPstr.split(';');
    return { 'SID': split[0], 'GID': split[1], 'RTY': split[2], 'RID': split[3] }
}
// ensemble de fonction decomposant les type de VEC (on lui passe un block)
let parseVecElems = {
    'PNO': (rows) => {
        const PNO = { 'COR': [] };
        for (let ri = 0; ri < rows.length; ri++){
            const row = rows[ri];
            if (row == '') continue;
            const rs = row.split(':')
            const zone = rs[0].substr(0, 3)
            switch (zone) {
                case 'SCP':
                    PNO['SCP'] = parseFtpScpNCo(rs[1]);
                    break;
                case 'TYP':
                    PNO['TYP'] = parseInt(rs[1]);
                    break;
                case 'ATC':
                    PNO['ATC'] = parseInt(rs[1]);
                    break
                case 'QAC':
                    PNO['QAC'] = rs[1];
                    break
                case 'COR':
                    PNO['COR'].push(corToJsonCoords(rs[1]))
                    break
                default:
                    break;
            }

        }
        // console.log(PNO);
        return PNO;
    },
    'PAR': (rows) => {
        const PAR = { 'COR': [] };
        for (let ri = 0; ri < rows.length; ri++){
            const row = rows[ri];
            if (row == '') continue;
            const rs = row.split(':')
            const zone = rs[0].substr(0, 3)
            switch (zone) {
                case 'SCP':
                    PAR['SCP'] = parseFtpScpNCo(rs[1]);
                    break;
                case 'TYP':
                    PAR['TYP'] = parseInt(rs[1]);
                    break;
                case 'PTC':
                    PAR['PTC'] = parseInt(rs[1]);
                    break;
                case 'ATC':
                    PAR['ATC'] = parseInt(rs[1]);
                    break
                case 'QAC':
                    PAR['QAC'] = rs[1];
                    break
                case 'COR':
                    const coordinates = corToJsonCoords(rs[1]);
                    PAR['COR'].push(coordinates)
                    break
                default:
                    break;
            }
        }
        // console.log(PAR);
        return PAR;
    },
    'PFE': (rows) => {
        const PFE = {};
        for (let ri = 0; ri < rows.length; ri++){
            const row = rows[ri];
            if (row == '') continue;
            const rs = row.split(':')
            const zone = rs[0].substr(0, 3)
            switch (zone) {
                case 'SCP':
                    PFE['SCP'] = parseFtpScpNCo(rs[1]);
                    break;
                case 'CM1':
                    PFE['CM1'] = parseInt(rs[1]);
                    break;
                case 'CM2':
                    PFE['CM2'] = parseInt(rs[1]);
                    break;
                case 'ATC':
                    PFE['ATC'] = parseInt(rs[1]);
                    break
                case 'QAC':
                    PFE['QAC'] = rs[1];
                    break
                default:
                    break;
            }
        }
        // console.log(PFE);
        return PFE;
    },
    'FEA': (rows) => {
        const FEA = { 'ATP': [], 'ATV': [] };
        for (let ri = 0; ri < rows.length; ri++){
            const row = rows[ri];
            if (row == '') continue;
            const rs = row.split(':')
            const zone = rs[0].substr(0, 3)
            switch (zone) {
                case 'SCP':
                    FEA['SCP'] = parseFtpScpNCo(rs[1]);
                    break;
                case 'CM1':
                    FEA['CM1'] = parseInt(rs[1]);
                    break;
                case 'CM2':
                    FEA['CM2'] = parseInt(rs[1]);
                    break;
                case 'REF':
                    FEA['REF'] = rs[1];
                    break;
                case 'ATC':
                    FEA['ATC'] = parseInt(rs[1]);
                    break
                case 'ATP':
                    FEA['ATP'].push(parseFtpScpNCo(rs[1]));
                    break
                case 'ATV':
                    FEA['ATV'].push(rs[1]);
                    break
                case 'QAC':
                    // console.log(rs[1])s
                    FEA['QAC'] = rs[1];
                    break
                case 'QAP':
                    FEA['QAP'] = parseFtpScpNCo(rs[1])
                    break
                default:
                    break;
            }

        }
        // console.log(FEA);
        return FEA;
    },
    'LNK': (rows) => {
        const LNK = { 'FTP': [], 'SNS': [] };
        for (const row of rows) {
            if (row == '') continue;
            const rs = row.split(':')
            const zone = rs[0].substr(0, 3)
            switch (zone) {
                case 'SCP':
                    LNK['SCP'] = parseFtpScpNCo(rs[1]);
                    break;
                case 'FTC':
                    LNK['FTC'] = rs[1];
                    break;
                case 'FTP':
                    LNK['FTP'].push(parseFtpScpNCo(rs[1]));
                    break;
                case 'SNS':
                    LNK['SNS'].push(rs[1]);
                    break;
                case 'ATC':
                    LNK['ATC'] = rs[1];
                    break
                case 'QAC':
                    LNK['QAC'] = rs[1];
                    break
                default:
                    break;
            }

        }
        // console.log(LNK);
        return LNK;
    }
}

export default function  (vecString) {
    const parsedVec = {'PNO':{}, 'PAR':{}, 'PFE':{}, 'FEA':{}, 'LNK':{}};
    const blocks = (vecString.split('RTYSA03:'));
    blocks.shift()
    for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];
        const rows = block.split(String.fromCharCode(13, 10));
        const type = rows[0];
        const id = rows[1].split(':')[1]
        if (type === 'PNO') {
            parsedVec['PNO'][id] = parseVecElems.PNO(rows)
        }
        else if (type === 'PAR') {
            parsedVec['PAR'][id] = parseVecElems.PAR(rows)
        }
        else if (type === 'PFE') {
            parsedVec['PFE'][id] = parseVecElems.PFE(rows)
        }
        else if (type === 'FEA') {
            parsedVec['FEA'][id] = parseVecElems.FEA(rows)
        }
        else if (type === 'LNK') {
            parsedVec['LNK'][id] = parseVecElems.LNK(rows)
        }
    }
    // console.log(parsedVec.PAR.Arc_411031);
    return parsedVec;
}



// module.exports = parseVEC;