const basePath = 'https://dbapi.csgofloat.com';

let defIndex, paintIndex, floatSlider, startIndex = 0, lastRowCount, isFetching;
let items;

const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

class Counter {
    constructor(elem) {
        this.elem = elem;
    }

    set(res) {
        const secondsSincePast = Date.now()/1000-res.lastUpdate;

        this.count = res.count - res.rate*res.updateInterval + secondsSincePast * res.rate;
        this.finalCount = res.count + res.rate; // Add additional one second to account for network request delay for update
        this.rate = res.rate;

        if (!this.lastTime) {
            // Initialize
            this.lastTime = performance.now();
        }

        requestAnimationFrame(this.step.bind(this));
    }

    step(ts) {
        const durationMs = ts-this.lastTime;
        this.lastTime = ts;

        this.count += (durationMs/1000) * this.rate;

        const formattedCount = numberWithCommas(Math.floor(this.count));
        if (this.elem.textContent !== formattedCount) {
            this.elem.textContent = formattedCount;
        }

        if (this.count < this.finalCount) {
            requestAnimationFrame(this.step.bind(this));
        }
    }
}

// https://stackoverflow.com/a/46431916
const groupBy = (items, key) => items.reduce((result, item) => ({
        ...result,
        [item[key]]: [
            ...(result[item[key]] || []),
            item,
        ],
    }),
    {},
);

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

function generateWeaponsDropdownHtml(text, data) {
    let html = '';

    html += `<option value="-1" selected>${text}</option>`;

    const weapons = [];
    for (const defIndex of Object.keys(data)) {
        weapons.push(Object.assign({
            defIndex
        }, data[defIndex]))
    }
    const grouped = groupBy(weapons, 'type');

    for (const groupName of Object.keys(grouped)) {
        grouped[groupName].sort((a, b) => a.name.localeCompare(b.name));

        html += `<optgroup label=${groupName}>`;

        for (const item of grouped[groupName]) {
            html += `<option value="${item.defIndex}">${item.name}</option>`;
        }

        html += `</optgroup>`;
    }
    console.log(grouped);

    return html;
}

function addStickerInputs(amt) {
    const parent = $("#stickers");
    parent.empty();

    const stickersDropdown = [];
    for (const stickerIndex of Object.keys(items.stickers)) {
        stickersDropdown.push({key: items.stickers[stickerIndex]});
    }

    const fuse = new Fuse(stickersDropdown, {
        shouldSort: true,
        tokenize: true,
        threshold: 0.2,
        location: 0,
        distance: 1000,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: [
            "key"
        ]
    });

    for (let i = 0; i < amt; i++) {
        let d = `
        <div class="input-field col s4 ${i === 4 ? 'offset-s3' : ''}">
            <input type="text" id="sticker${i}-input" class="autocomplete sticker-autocomplete" autocomplete="off">
            <label for="sticker${i}-input">Sticker</label>
        </div>
        <div class="input-field col s2">
            <select id="sticker${i}-slot">
              <option value="" selected>Any Slot</option>
        `;

        for (let j = 0; j < amt; j++) {
            d += `<option value="${j+1}">Slot ${j+1}</option>`;
        }

        d += '</select></div>';

        d = $(d);

        parent.append(d);

        const auto = d.find('input').autocomplete({
            data: stickersDropdown,
            limit: 6,
        })[0].M_Autocomplete;

        // Gotta love hacky solutions
        // Uses Fuse instead of regular matching for fuzzy search
        auto.__proto__._renderDropdown = function(data, searchVal) {
            this._resetAutocomplete();

            var matchingData = [];

            for (const result of fuse.search(searchVal)) {
                if (this.count >= this.options.limit) {
                    break;
                }

                matchingData.push({
                    data: null,
                    key: result.key
                });

                this.count++;
            }

            // Render
            for (var i = 0; i < matchingData.length; i++) {
                var _entry = matchingData[i];
                var $autocompleteOption = $('<li></li>');
                if (!!_entry.data) {
                    $autocompleteOption.append("<img src=\"" + _entry.data + "\" class=\"right circle\"><span>" + _entry.key + "</span>");
                } else {
                    $autocompleteOption.append('<span>' + _entry.key + '</span>');
                }

                $(this.container).append($autocompleteOption);
            }
        };

        d.find('select').formSelect();
    }
}

function setFloatMinMax(min, max) {
    floatSlider.noUiSlider.set([min, max]);
    $('#minFloat').val(min.toFixed(2));
    $('#maxFloat').val(max.toFixed(2));
}

$(document).ready(async function() {
    const counter = new Counter(document.getElementById('itemCounter'));
    async function fetchCount() {
        try {
            const res = await fetch(`${basePath}/count`);
            const data = await res.json();
            if (data.rate) {
                counter.set(data);
            } else {
                document.getElementById('itemCounter').innerText = numberWithCommas(data.count);
            }

            const waitPeriod = (data.updateInterval - (Date.now()/1000-data.lastUpdate))*1000;

            if (waitPeriod < 1000) {
                await wait(500);
            }

            setTimeout(() => {
                fetchCount();
            }, waitPeriod);
        } catch (e) {
            console.error(e);
        }
    }
    fetchCount();

    $(".dropdown-trigger").dropdown();
    $('.sidenav').sidenav();
    $('#infoModal').modal();

    floatSlider = document.getElementById('float-slider');
    
    try {
        const data = await fetch(`${basePath}/items`);
        items = await data.json();
    } catch (e) {
        document.getElementById('counterWrapper').innerHTML = `Server Maintenance, We'll Be Back Soon!`;
    }

    const weaponsDropdown = {};
    for (const defIndex of Object.keys(items.weapons)) {
        weaponsDropdown[items.weapons[defIndex].name] = defIndex;
    }

    $("#weaponSelect").html(generateWeaponsDropdownHtml("Any Weapon", items.weapons));
    $("#weaponSelect").formSelect();
    $("#paintSelect").formSelect();
    $("#qualitySelect").formSelect();
    $("#raritySelect").formSelect();

    noUiSlider.create(floatSlider, {
        start: [0, 1],
        connect: true,
        step: 0.001,
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

        setFloatMinMax(0, 1);

        $("#raritySelect").prop('disabled', false);
        $("#raritySelect").formSelect();

        $("#slotImage").hide();
        $("#slotImage").attr('src', '');

        if (defIndex == -1 || items.weapons[defIndex].stickerAmount === 0) {
            $("#slotImageContainer").hide();
        } else {
            $("#slotImageContainer").show();
        }

        if (defIndex == -1) {
            $("#paintSelect").prop('disabled', true);
            $("#paintSelect").formSelect('destroy');
            $("#paintSelect").formSelect();
            addStickerInputs(5);
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
        // TODO: Allow doppler filtering

        paintIndex = this.value;
        if (paintIndex == -1) {
            setFloatMinMax(0, 1);
        } else if (paintIndex == 0) {
            setFloatMinMax(0.06, 0.80);
        } else {
            const paint = items.weapons[defIndex].paints[paintIndex];
            setFloatMinMax(paint.min, paint.max);
        }

        $("#raritySelect").prop('disabled', paintIndex != -1);
        $("#raritySelect").formSelect();
    });

    $('#minFloat').change(function () {
        let min = parseFloat($(this).val());
        if (min > 1 || min < 0 || min > parseFloat($('#maxFloat').val())) {
            min = 0;
            $('#minFloat').val(min.toFixed(2));
        }
        floatSlider.noUiSlider.set([min, null]);
    });

    $('#maxFloat').change(function () {
        let max = parseFloat($(this).val());
        if (max > 1 || max < 0 || max < parseFloat($('#minFloat').val())) {
            max = 1;
            $('#maxFloat').val(max.toFixed(2));
        }
        floatSlider.noUiSlider.set([null, max]);
    });

    floatSlider.noUiSlider.on('slide', (values) => {
        $('#minFloat').val(values[0]);
        $('#maxFloat').val(values[1]);
    });

    if (location.search) {
        searchQuery(location.search.substring(1), false, 0);
    }
});

window.onpopstate = function(event) {
    searchQuery(location.search.substring(1));
};


function generateInspectURL(item) {
    if (item.s === '0') return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${item.m}A${item.a}D${item.d}`;
    else return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${item.s}A${item.a}D${item.d}`;
}

function generateLink(item) {
    if (item.s === '0') {
        return `https://steamcommunity.com/market/listings/730/${getItemName(item.defIndex, item.paintIndex, item.floatvalue, item.stattrak, item.souvenir, false)}`;
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

const floatRanges = {
    'Factory New': {
        range: [0.0, 0.07],
        a: 'FN',
    },
    'Minimal Wear': {
        range: [0.07, 0.15],
        a: 'MW',
    },
    'Field-Tested': {
        range: [0.15, 0.38],
        a: 'FT',
    },
    'Well-Worn': {
        range: [0.38, 0.45],
        a: 'WW',
    },
    'Battle-Scarred': {
        range: [0.45, 1.00],
        a: 'BS',
    }
};

function getWearName(floatvalue, abbreviation) {
    const fullName = Object.keys(floatRanges).find((name) => floatvalue >= floatRanges[name].range[0] && floatvalue < floatRanges[name].range[1]);
    if (abbreviation) {
        return floatRanges[fullName].a;
    } else {
        return fullName;
    }
}

function getItemName(defIndex, paintIndex, floatvalue, isStattrak, isSouvenir, abbreviation) {
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

        if (!abbreviation && name.indexOf('Doppler') > -1) {
            // remove the phase
            const m = name.match(/(.*) \(/);

            name = (m && m[1]) || name;
        }

        if (floatvalue) {
            name += ` (${getWearName(floatvalue, abbreviation)})`;
        }
    }

    return name;
}

const rarities = {
    0: {
        name: "Stock",
        bg: "#6a6156",
        text: "#262a2f"
    },
    1: {
        name: "Consumer",
        bg: "#b0c3d9",
        text: "#262a2f"
    },
    2: {
        name: "Industrial",
        bg: "#5e98d9",
        text: "#182533"
    },
    3: {
        name: "Mil-Spec",
        bg: "#4b69ff",
        text: "white"
    },
    4: {
        name: "Restricted",
        bg: "#8847ff",
        text: "white"
    },
    5: {
        name: "Classified",
        bg: "#d32ce6",
        text: "white"
    },
    6: {
        name: "Covert",
        bg: "#eb4b4b",
        text: "white"
    },
    7: {
        name: "Contraband",
        bg: "#e4ae39",
        text: "#503d15"
    },
};

function getStickerNames(stickers) {
    const names = [];
    for (const sticker of stickers || []) {
        names.push(`${items.stickers[sticker.i]} - ${Math.round((sticker.w || 0) * 100)}% - Slot ${sticker.s+1}`);
    }
    return names;
}


const personaStateToClassMap = {
    0: 'offline', // Offline
    1: 'online', // Online
    2: 'online', // Busy
    3: 'online', // Away
    4: 'online', // Snooze
    5: 'online', // Looking to trade
    6: 'online', // Looking to play
    100: 'in-game', // In-game, custom persona state
};

function getBasicLinkHtml(row, linkText) {
    return `<a href="${generateLink(row)}"
                class="tooltipped"
                data-position="top"
                data-tooltip="${getRelativeTimeChange(Date.parse(row.updated)).join('\n')}"
                target="_blank"
                style="line-height: 40px;">
                ${linkText}
            </a>`
}

function getProfileHtml(row) {
    return row.avatar ? `<a href="${generateLink(row)}"
                class="tooltipped playerAvatar ${personaStateToClassMap[row.personaState]}"
                data-position="top"
                data-tooltip="${getRelativeTimeChange(Date.parse(row.updated)).join('\n')}"
                target="_blank">
                <img src="${row.avatar}">
            </a>` : getBasicLinkHtml(row, 'Profile');
}

function getTableHtml(rows, startIndex) {
    let html = '';
    for (let rank = 0; rank < rows.length; rank++) {
        const row = rows[rank];
        const properties = extractProperties(row.props);
        const rarity = rarities[properties.rarity];
        const hasStickers = (row.stickers || []).length > 0;

        html += `
                <tr>
                    <td>${startIndex + rank + 1}</td>
                    <td>${row.a}</td>
                    <td>${getItemName(row.defIndex, row.paintIndex, row.floatvalue, row.stattrak, row.souvenir, true)}</td>
                    <td>
                        <span style="background-color: ${rarity.bg}; padding: 5px; border-radius: 5px; color: ${rarity.text}">
                        ${rarity.name}
                        </span>
                    </td>
                    <td>${row.floatvalue.toFixed(14)}</td>
                    <td>${row.paintseed}</td>
                    <td>
                        <a class="${hasStickers ? "tooltipped" : ""}"
                            data-position="top"
                            data-tooltip="${getStickerNames(row.stickers).join('\n')}">
                        ${(row.stickers || []).length > 0 ? "Show" : ""}
                        </a>
                    </td>
                    <td>${row.s === "0" ? getBasicLinkHtml(row, 'Market') : getProfileHtml(row)}</a></td>
                    <td><a href="${generateInspectURL(row)}">Inspect</a></td>
                </tr>
                `
    }

    return html;
}

function getRelativeTimeChange(time) {
    return ['Last Changed', `${Math.floor((Date.now()-time)/86000000)} days ago`];
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

function serializeQuery(params, filterFn) {
    return Object.keys(params)
        .filter(filterFn || (() => true))
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');
}

async function search(scroll, index) {
    let params = {
        defIndex: defIndex == -1 ? '' : defIndex,
        paintIndex: paintIndex == -1 ? '' : paintIndex,
        order: $('input[name=sort]:checked').val(),
        paintSeed: $("#paintSeed").val(),
    };

    params.min = $('#minFloat').val();
    params.max = $('#maxFloat').val();

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

    const raritySelection = parseInt($("#raritySelect").val());
    if (raritySelection > -1 && !$('#raritySelect').prop('disabled')) {
        params.rarity = raritySelection;
    }

    const stickers = getStickers();
    if (stickers.length > 0) {
        params.stickers = JSON.stringify(stickers);
    }

    // Add a user friendly item name
    if (params.defIndex) {
        params.name = getItemName(params.defIndex, params.paintIndex, false, !!params.stattrak, !!params.souvenir, true)
            .replace(/ \| /g, '-').replace(/ /g, '-');
    }

    // Remove empty keys (can't just do !! since 0)
    params = Object.keys(params).reduce((result, key) => {
        if (key in params && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            result[key] = params[key];
        }

        return result;
    }, {});

    // Don't include `start` in the URL since we don't want the user to be jumped to that on a refresh
    history.pushState(params, '', '?' + serializeQuery(params, (key) => key !== 'start'));

    return searchQuery(serializeQuery(params), scroll, index);
}

function toggleWeaponSlots() {
    $("#slotImage").attr('src', `assets/slots/${defIndex}.png`);
    $("#slotImage").toggle();
}

function getToken() {
    return new Promise((resolve, reject) => {
        grecaptcha.ready(function() {
            grecaptcha.execute('6LdLz8QUAAAAAJyPFMMjrwzUX2smVEVD2OdbcKm3', {action: 'db_query'}).then(function(token) {
                resolve(token);
            }, err => {
                reject(err);
            });
        });
    });
}

function resetFetchingStatus() {
    $("#searchLoading").hide();
    $("#searchButton").removeClass('disabled');
    isFetching = false;
}

async function searchQuery(query, scroll, index) {
    if (isFetching) return Promise.reject("Already fetching");

    isFetching = true;
    startIndex = index || 0;

    let token;

    try {
        token = await getToken();
    } catch (e) {
        M.toast({html: `Failed to verify recaptcha, please try disabling ad-blockers`});
        M.toast({html: e.toString()});
        resetFetchingStatus();

        return Promise.reject(e);
    }

    const loadingBar = scroll ? $("#scrollLoading") : $("#searchLoading");

    loadingBar.show();
    $("#searchButton").addClass('disabled');

    let results;
    
    try {
        const data = await fetch(`${basePath}/search?${query}&start=${startIndex}&token=${token}`);
        results = await data.json();

        if (results.error) {
            throw results.error;
        }
    } catch (e) {
        M.toast({html: `Something went wrong while searching :(`});
        M.toast({html: e.toString()});
        resetFetchingStatus();

        return Promise.reject(e);
    }

    lastRowCount = results.length;

    // Destroy all current tooltips
    $("#results-body").find(".tooltipped").each(function () {
        M.Tooltip.getInstance(this).destroy();
    });

    const tableHtml = getTableHtml(results, startIndex);

    if (scroll) {
        $("#results-body").append(tableHtml);
    } else {
        $("#results-body").html(tableHtml);
    }


    $("#results-body").find(".tooltipped").each(function () {
        $(this).tooltip();
    });

    $("#results").show();
    loadingBar.hide();
    $("#searchButton").removeClass('disabled');

    if (!scroll) {
        $('html, body').animate({
            scrollTop: $("#results").offset().top
        }, 500);
    }

    isFetching = false;
}

window.onscroll = () => {
    // Scroll infinite only on desktop mode
    if (window.innerWidth >= 1000 && (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 1000
        && lastRowCount /* ensure initialized, prevents going too far as well */) {
        startIndex += lastRowCount;

        // Hard limit, enforced server side as well
        if (startIndex >= 5000) return;

        searchQuery(location.search.substring(1), true, startIndex).catch(() => {
            // Restore index state
            startIndex -= lastRowCount;
        });
    }
};
