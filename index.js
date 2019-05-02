let defIndex, paintIndex, floatSlider;
let items;

function generateDropdownHtml(text, data) {
    let html = '';
    html += `<option value="-1" selected>${text}</option>`;
    for (const key of Object.keys(data)) {
        html += `
                    <option value="${data[key]}">${key}</option>
                `;
    }
    return html;
}

$(document).ready(async function(){
    $('body').append('<select class="browser-default" style="position:absolute;visibility:hidden" id="fix-scroll"></select>'); //this is the hack
    $('#fix-scoll').formSelect();

    floatSlider = document.getElementById('float-slider');
    const data = await fetch('http://localhost:3000/items');
    items = await data.json();

    const weaponsDropdown = {};
    for (const defIndex of Object.keys(items.weapons)) {
        weaponsDropdown[items.weapons[defIndex].name] = defIndex;
    }

    $("#weaponSelect").html(generateDropdownHtml("Any Weapon", weaponsDropdown));
    $("#weaponSelect").formSelect();

    noUiSlider.create(floatSlider, {
        start: [0, 1],
        connect: true,
        step: 0.01,
        orientation: 'horizontal', // 'horizontal' or 'vertical'
        range: {
            'min': 0,
            'max': 1
        },
        behaviour: 'tap-drag',
        tooltips: [true, true],
        format: wNumb({
            decimals: 2
        }),
        pips: {
            mode: 'positions',
            density: 5,
            values: [0, 7, 15, 38, 45, 100],
            format: wNumb({
                decimals: 2,
            })
        }
    });

    $("#weaponSelect").on('change', function() {
        paintIndex = undefined;
        defIndex = this.value;

        floatSlider.noUiSlider.set([0, 1]);

        if (defIndex == -1) {
            $("#paintSelect").prop('disabled', true);
            $("#paintSelect").formSelect('destroy');
            return;
        }

        const paintsDropdown = {};
        for (const paintIndex of Object.keys(items.weapons[defIndex].paints)) {
            paintsDropdown[items.weapons[defIndex].paints[paintIndex].name] = paintIndex;
        }
        $("#paintSelect").prop('disabled', false);
        $("#paintSelect").html(generateDropdownHtml("Any Skin", paintsDropdown));
        $("#paintSelect").formSelect();
    });

    $("#paintSelect").on('change', function () {
        paintIndex = this.value;
        if (paintIndex ==-1) {
            floatSlider.noUiSlider.set([0, 1]);
        } else {
            const paint = items.weapons[defIndex].paints[paintIndex];
            floatSlider.noUiSlider.set([paint.min, paint.max]);
        }
    });
});

function generateInspectURL(item) {
    if (item.s === '0') return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${item.m}A${item.a}D${item.d}`;
    else return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${item.s}A${item.a}D${item.d}`;
}

function generateLink(item) {
    if (item.s === '0') {
        return `https://steamcommunity.com/market/search?q=${getItemName(item.defIndex, item.paintIndex, item.stattrak, item.souvenir)}`;
    } else {
        return `https://steamcommunity.com/profiles/${item.s}/inventory/#730_2_${item.a}`;
    }
}

/*
Returns the following properties in a 32 bit integer
              rarity     quality    origin
0000000000   00000000   00000000   00000000
<future>      8 bits     8 bits     8 bits
*/
function extractProperties(prop) {
    return {
        origin: prop & ((1 << 8) - 1),
        quality: (prop >> 8) & ((1 << 8) - 1),
        rarity: (prop >> 16) & ((1 << 8) - 1)
    }
}

function getItemName(defIndex, paintIndex, isStattrak, isSouvenir) {
    let name = '';

    if (defIndex >= 500) {
        name += '★ ';
    }

    if (isStattrak) {
        name += 'StatTrak™ ';
    }

    if (isSouvenir) {
        name += 'Souvenir ';
    }

    name += items.weapons[defIndex].name;

    if (paintIndex > 0) {
        name += ' | ' + items.weapons[defIndex].paints[paintIndex].name;
    }

    return name;
}

const rarities = {
    0: "Stock",
    1: "Consumer",
    2: "Industrial",
    3: "Mil-Spec",
    4: "Restricted",
    5: "Classified",
    6: "Covert",
    7: "Contraband",
};

function getTableHtml(rows) {
    let html = '';
    for (let rank = 0; rank < rows.length; rank++) {
        const row = rows[rank];
        const properties = extractProperties(row.props);

        html += `
                <tr>
                    <td>${rank+1}</td>
                    <td>${row.a}</td>
                    <td>${getItemName(row.defIndex, row.paintIndex, row.stattrak, row.souvenir)}</td>
                    <td>${rarities[properties.rarity]}</td>
                    <td>${row.floatvalue.toFixed(14)}</td>
                    <td>${row.paintseed}</td>
                    <td><a href="${generateLink(row)}" target="_blank">${row.s === "0" ? "Market" : "Profile"}</a></td>
                    <td><a href="${generateInspectURL(row)}">Inspect</a></td>
                </tr>
                `
    }

    return html;
}

async function search() {
    $("#searchLoading").show();
    $("#searchButton").addClass('disabled');

    const params = {
        defIndex: defIndex == -1 ? '' : defIndex,
        paintIndex: paintIndex == -1 ? '' : paintIndex,
        order: $('input[name=sort]:checked').val(),
    };

    const queryString = Object.keys(params)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');

    const data = await fetch(`http://localhost:3000/search?${queryString}`);
    const results = await data.json();

    const tableHtml = getTableHtml(results);
    $("#results-body").html(tableHtml);
    $("#results").show();
    $("#searchLoading").hide();
    $("#searchButton").removeClass('disabled');
}