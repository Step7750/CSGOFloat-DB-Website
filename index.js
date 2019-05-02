let defIndex, paintIndex, floatSlider;
let items;

function generateDropdownHtml(text, data, vanilla) {
    let html = '';
    html += `<option value="-1" selected>${text}</option>`;
    if (vanilla) {
        html += `<option value="0">Vanilla</option>`
    }
    for (const key of Object.keys(data).sort()) {
        html += `<option value="${data[key]}">${key}</option>`;
    }
    return html;
}

function addStickerInputs(amt) {
    const parent = $("#stickers");
    parent.empty();

    const stickersDropdown = {};
    for (const stickerIndex of Object.keys(items.stickers)) {
        stickersDropdown[items.stickers[stickerIndex]] = null;
    }

    for (let i = 0; i < amt; i++) {
        const d = $(`
        <div class="input-field col s4 ${i === 4 ? 'offset-s3' : ''}">
            <input type="text" id="sticker${i}-input" class="autocomplete sticker-autocomplete" autocomplete="off">
            <label for="sticker${i}-input">Sticker</label>
        </div>
        <div class="input-field col s2">
            <select id="sticker${i}-slot">
              <option value="" selected>Any Slot</option>
              <option value="1">Slot 1</option>
              <option value="2">Slot 2</option>
              <option value="3">Slot 3</option>
              <option value="4">Slot 4</option>
              <option value="5">Slot 5</option>
            </select>
        </div>
        `);

        parent.append(d);

        d.find('input').autocomplete({
            data: stickersDropdown,
            limit: 12,
        });
        d.find('select').formSelect();
    }
}

$(document).ready(async function(){
    $('body').append('<select class="browser-default" style="position:absolute;visibility:hidden" id="fix-scroll"></select>'); //this is the hack
    $('#fix-scroll').formSelect();

    floatSlider = document.getElementById('float-slider');
    const data = await fetch('http://localhost:3000/items');
    items = await data.json();

    const weaponsDropdown = {};
    for (const defIndex of Object.keys(items.weapons)) {
        weaponsDropdown[items.weapons[defIndex].name] = defIndex;
    }

    $("#weaponSelect").html(generateDropdownHtml("Any Weapon", weaponsDropdown));
    $("#weaponSelect").formSelect();
    $("#paintSelect").formSelect();
    $("#qualitySelect").formSelect();

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

    addStickerInputs(5);

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
        $("#paintSelect").html(generateDropdownHtml("Any Skin", paintsDropdown, defIndex >= 500));
        $("#paintSelect").formSelect();

        // Initialize the stickers
        addStickerInputs(items.weapons[defIndex].stickerAmount);
    });

    $("#paintSelect").on('change', function () {
        paintIndex = this.value;
        if (paintIndex == -1) {
            floatSlider.noUiSlider.set([0, 1]);
        } else if (paintIndex == 0) {
            floatSlider.noUiSlider.set([0.06, 0.80]);
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

function getStickers() {
    const stickers = [];

    for (let i = 0; i < 5; i++) {
        const stickerInput = $(`#sticker${i}-input`);

        if (!stickerInput.length) continue;

        const slot = $(`#sticker${i}-slot`).val();

        const stickerName = stickerInput.val();

        // find sticker id
        const stickerId = Object.keys(items.stickers).find((id) => items.stickers[id] === stickerName);

        if (!stickerId) continue;

        const sticker = {
            i: stickerId
        };
        if (slot) {
            sticker.s = parseInt(slot)-1;
        }

        stickers.push(sticker);
    }

    return stickers;
}

async function search() {
    $("#searchLoading").show();
    $("#searchButton").addClass('disabled');

    const params = {
        defIndex: defIndex == -1 ? '' : defIndex,
        paintIndex: paintIndex == -1 ? '' : paintIndex,
        order: $('input[name=sort]:checked').val(),
        paintSeed: $("#paintSeed").val(),
    };

    console.log(floatSlider.noUiSlider.get());

    const [min, max] = floatSlider.noUiSlider.get();

    params.min = min;
    params.max = max;

    const qualitySelection = parseInt($("#qualitySelect").val());
    if (qualitySelection > -1) {
        if (qualitySelection === 0) {
            params.stattrak = false;
            params.souvenir = false;
        } else if (qualitySelection === 9) {
            params.stattrak = true;
        } else if (qualitySelection === 12) {
            params.souvenir = true;
        }
    }

    const stickers = getStickers();
    if (stickers.length > 0) {
        params.stickers = JSON.stringify(stickers);
    }
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

    $('html, body').animate({
        scrollTop: $("#results").offset().top
    }, 500);

}