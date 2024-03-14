const elementDropDown = document.getElementById('element');

const canvas = document.getElementById('ddCanvas');

const fpsCounter = document.getElementById('fpsCounter');

const ctx = canvas.getContext('2d');

let imageData;

let mouseButtonPressed = false;
let clientMouseX = 0;
let clientMouseY = 0;

let allowCascade = true;

let shouldClearNextFrame = false;
let cascadeOnceNextFrame = false;

let showFps = false;

let destinations = [];
let stayPutWeight = 1;

let totalRows = 0, totalColumns = 0;

let lastMarkedX = -1;
let lastMarkedY = -1;

const CASCADE_DIRECTION_UP = -1, CASCADE_DIRECTION_DOWN = 1, CASCADE_DIRECTION_STILL = 0;

let elementColors = {
    empty: [0, 0, 0],
    sand:  [0xff, 0xcb, 0x6b],
    wall:  [0xaa, 0xaa, 0xaa],
    water: [0x20, 0x40, 0xff],
    oil:   [0x87, 0x5d, 0x3a],
    fire:  [0xff, 0, 0],
    fire2: [0xff, 0x01, 0x01],
    plant: [0x50, 0xc8, 0x78],
    plant2:[0x50, 0xc9, 0x79]
};

let selectedElement = 'sand';

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function init() {
    console.log('loading destinations');
    const destinationsResponse = await fetch('destinations.json');
    const destinationsJson = await destinationsResponse.json();
    destinations = destinationsJson.destinations;
    stayPutWeight = destinationsJson.stayPutWeight;

    const bounding = canvas.getBoundingClientRect();
    await clearCanvas(ctx);
    imageData = ctx.getImageData(0, 0, bounding.width, bounding.height);
    totalRows = imageData.width;
    totalColumns = imageData.height;
}

let lastFrameTimestamp;

function step() {
    draw();
    const timestampNow = performance.now();

    if (showFps) {
        if (lastFrameTimestamp) {
            var msDifference = timestampNow - lastFrameTimestamp;
            var fps = Math.floor(1000 / msDifference);
            fpsCounter.innerText = `${fps} FPS`
        }
        lastFrameTimestamp = timestampNow;
    }

    window.requestAnimationFrame(step);
}

function draw() {
    if (shouldClearNextFrame) {
        clear();
        shouldClearNextFrame = false;
    }
    else if (allowCascade || cascadeOnceNextFrame) {
        cascade();
        if (cascadeOnceNextFrame) {
            cascadeOnceNextFrame = false;
        }
    }

    if (mouseButtonPressed) {
        const mouse = getCanvasMousePosition();
        if (lastMarkedX < 0 || lastMarkedY < 0 || (lastMarkedX === mouse.X && lastMarkedY === mouse.Y)) {
            markSquare(mouse.X, mouse.Y, 5, selectedElement);
        }
        else {
            markSquaresInLine(lastMarkedX, lastMarkedY, mouse.X, mouse.Y, 5, selectedElement);
        }
        lastMarkedX = mouse.X;
        lastMarkedY = mouse.Y;
    } else {
        lastMarkedX = -1;
        lastMarkedY = -1;
    }

    drawImageDataToCanvas(imageData);
}

function clear() {
    for (let x = 0; x < totalColumns; ++x) {
        for (let y = 0; y < totalRows; ++y) {
            markPixel(x, y, 'empty');
        }
    }
}

function markSquaresInLine(x0, y0, x1, y1, radius, element) {
    absoluteDeltaX = Math.abs(x1 - x0);
    absoluteDeltaY = Math.abs(y1 - y0);
    if (absoluteDeltaY < absoluteDeltaX) {
        // octet 0, 3, 4, 7
        if (x0 > x1) {
            // octet 0, 7
            markLineLow(x1, y1, x0, y0, radius, element);
        } else {
            // octet 3, 4
            markLineLow(x0, y0, x1, y1, radius, element);
        }
    } else {
        // octet 1, 2, 5, 6
        if (y0 > y1) {
            // octet 1, 2
            markLineHigh(x1, y1, x0, y0, radius, element);
        } else {
            // octet 5, 6
            markLineHigh(x0, y0, x1, y1, radius, element);
        }
    }
}

function markLineHigh(x0, y0, x1, y1, radius, element) {
    let deltaX = x1 - x0;
    const deltaY = y1 - y0;
    let intervalX = 1;
    if (deltaX < 0) {
        intervalX = -1;
        deltaX = -deltaX;
    }
    let difference = 2 * deltaX - deltaY;
    let x = x0;
    for (let y = y0; y <= y1; ++y) {
        markSquare(x, y, radius, element);
        if (difference > 0) {
            x += intervalX;
            difference = difference + (2 * (deltaX - deltaY));
        } else {
            difference = difference + 2 * deltaX;
        }
    }
}

function markLineLow(x0, y0, x1, y1, radius, element) {
    const deltaX = x1 - x0;
    let deltaY = y1 - y0;
    let intervalY = 1;
    if (deltaY < 0) {
        intervalY = -1;
        deltaY = -deltaY;
    }
    let difference = 2 * deltaY - deltaX;
    let y = y0;
    for (let x = x0; x <= x1; ++x) {
        markSquare(x, y, radius, element);
        if (difference > 0) {
            y += intervalY;
            difference += (2 * (deltaY - deltaX));
        } else {
            difference += 2 * deltaY;
        }
    }
}

function getCanvasMousePosition() {
    const bounding = canvas.getBoundingClientRect();
    const X = Math.floor(clientMouseX - bounding.x);
    const Y = Math.floor(clientMouseY - bounding.y);

    return { X, Y };
}

function cascade() {
    // clear bottom and top row
    for (let x = 0; x < totalColumns; ++x) {
        markPixel(x, 0, 'empty');
        markPixel(x, totalRows - 1, 'empty');
    }

    // cascade down starting from next to bottom row and working up
    for (let y = totalRows - 2; y >= 1; --y) {
        cascadeRow(y, CASCADE_DIRECTION_DOWN)
    }
    
    // cascade up starting from next to top row and working down
    for (let y = 1; y < totalRows - 2; ++y) {
        cascadeRow(y, CASCADE_DIRECTION_UP)
    }
}

function shouldCascadeDown(element) {
    return element === 'sand' ||
        element === 'water' ||
        element === 'oil' ||
        element === 'plant' ||
        element === 'plant2'
}

function shouldCascadeUp(element) {
    return element === 'fire' ||
        element === 'fire2'
}

function shouldNotMove(element) {
    return element === 'plant' ||
        element === 'plant2';
}

function isElementMortal(element) {
    return element === 'fire' ||
        element === 'fire2' ||
        element === 'plant2'
}

function getElementMortality(element) {
    if (element === 'fire') {
        return 15;
    }
    return 100;
}

function getElementToRessurectInto(element) {
    if (element === 'fire') {
        return 'empty';
    }
    if (element === 'fire2') {
        return 'fire';
    }
    if (element === 'plant2') {
        return 'plant';
    }
}

function getElementToEngulfWith(element) {
    if (element === 'fire') {
        return 'fire2';
    }
    if (element === 'plant') {
        return 'plant2';
    }
}

function cascadeRow(y, direction) {
    // loop through every pixel of this row
    for (let x = 0; x < totalColumns; ++x) {
        
        const elementId = getElementIdAtPixel(x, y);

        // if cascading down, process still and downward elements. If cascading up, only process upward elements
        if (elementId === 'empty' ||
            (direction === CASCADE_DIRECTION_DOWN && !shouldCascadeDown(elementId)) ||
            (direction === CASCADE_DIRECTION_UP && !shouldCascadeUp(elementId))) {
            continue;
        }

        if (isElementMortal(elementId)) {
            // delete the pixel according to its "mortality" rate
            const mortality = getElementMortality(elementId);
            if (mortality >= 100 || Math.floor(Math.random() * 100) < mortality) {
                markPixel(x, y, getElementToRessurectInto(elementId));
                // once dead, move to the next pixel
                continue;
            }
        }

        // for fire pixels, engulf the surrounding oil pixels with a radius of 2
        if (elementId === 'fire') {
            for (let i = x - 2; i <= x + 2; ++i) {
                for (let j = y - 2; j <= y + 2; ++j) {
                    if (i < 0 || i >= totalColumns || j < 0 || j >= totalRows) {
                        continue;
                    }
                    const destElement = getElementIdAtPixel(i, j)
                    if (destElement === 'oil') {
                        markPixel(i, j, 'fire2')
                    }
                }
            }
        }

        // fire engulfs plant and plant engulfs water with radius of 1 pixel
        if (elementId === 'fire' || elementId === 'plant') {
            for (let i = x - 1; i <= x + 1; ++i) {
                for (let j = y - 1; j <= y + 1; ++j) {
                    if (i < 0 || i >= totalColumns || j < 0 || j >= totalRows) {
                        continue;
                    }
                    const destElement = getElementIdAtPixel(i, j);
                    if (elementId === 'fire' && destElement === 'plant') {
                        markPixel(i, j, 'fire2');
                    } else if (elementId === 'plant' && destElement === 'water') {
                        markPixel(i, j, 'plant2');
                    }
                }
            }
        }

        // no need to process further for elements that don't move
        if (shouldNotMove(elementId)) {
            continue;
        }

        // look through the destinations table and get a list of possible destinations for this pixel to move
        const possibleDestinations = [];
        let totalWeight = 0;
        for (const dest of destinations) {
            // add the deltas to the current pixel
            var potentialDestination = {
                x: x + dest.deltaX,
                y: y + dest.deltaY * direction,
                weight: dest.weight
            };

            // see if that's a space this pixel can move to
            if (potentialDestination.x > 0
                && potentialDestination.x < totalColumns - 1
                && isPossibleDestination(potentialDestination.x, potentialDestination.y, elementId)) {
                possibleDestinations.push(potentialDestination);
                totalWeight += potentialDestination.weight;
            }
        }

        // move on to the next pixel if no possible destinations to move
        if (possibleDestinations.length === 0) {
            continue;
        }

        let finalDestination;

        // add the "stay put" position as a possibility
        possibleDestinations.push({
            x: x,
            y: y,
            weight: stayPutWeight
        });
        totalWeight += stayPutWeight;

        finalDestination = possibleDestinations[0];

        // galaxy-brained algorithm to pick a random destination based on weight
        if (possibleDestinations.length > 1) {
            let pickedWeight = Math.floor(Math.random() * totalWeight);
            for (const dest of possibleDestinations) {
                if (pickedWeight < dest.weight) {
                    finalDestination = dest;
                    break;
                }
                pickedWeight -= dest.weight;
            }
        }

        // swap the two pixels
        const destOriginalElement = getElementIdAtPixel(finalDestination.x, finalDestination.y);
        markPixel(x, y, destOriginalElement);
        markPixel(finalDestination.x, finalDestination.y, elementId);
    }
}


function isPossibleDestination(destX, destY, sourceElement) {
    const destElement = getElementIdAtPixel(destX, destY);
    if (destElement === 'empty') {
        return true;
    }
    if (sourceElement === 'water' && destElement === 'oil') {
        return true;
    }
    return false;
}

async function clearCanvas() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawImageDataToCanvas() {
    ctx.putImageData(imageData, 0, 0);
}

function getElementIdAtPixel(x, y) {
    const pixelIndex = getImageDataPixelIndex(x, y);
    const r = imageData.data[pixelIndex];
    const g = imageData.data[pixelIndex + 1];
    const b = imageData.data[pixelIndex + 2];

    const actualColors = { r, g, b };

    if (colorsMatchElement(actualColors, elementColors.empty)) {
        return 'empty';
    }
    if (colorsMatchElement(actualColors, elementColors.sand)) {
        return 'sand';
    }
    if (colorsMatchElement(actualColors, elementColors.wall)) {
        return 'wall';
    }
    if (colorsMatchElement(actualColors, elementColors.water)) {
        return 'water';
    }
    if (colorsMatchElement(actualColors, elementColors.oil)) {
        return 'oil';
    }
    if (colorsMatchElement(actualColors, elementColors.fire)) {
        return 'fire';
    }
    if (colorsMatchElement(actualColors, elementColors.fire2)) {
        return 'fire2';
    }
    if (colorsMatchElement(actualColors, elementColors.plant)) {
        return 'plant';
    }
    if (colorsMatchElement(actualColors, elementColors.plant2)) {
        return 'plant2';
    }

    return 'empty';
}

function colorsMatchElement(actualColors, elementColors) {
    return actualColors.r === elementColors[0]
        && actualColors.g === elementColors[1]
        && actualColors.b === elementColors[2];
}

function getImageDataPixelIndex(x, y) {
    return y * (imageData.width * 4) + x * 4;
}

function markSquare(x, y, radius, element) {
    for (let i = x - (radius - 1); i < x + (radius - 1); ++i) {
        for (let j = y - (radius - 1); j < y + (radius - 1); ++j) {
            markPixel(i, j, element);
        }
    }
}

function markPixel(x, y, elementId) {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return;
    }
    
    const colors = elementColors[elementId];

    var pixels = imageData.data;
    var pixelIndex = y * (imageData.width * 4) + x * 4;
    pixels[pixelIndex] = colors[0];
    pixels[pixelIndex + 1] = colors[1];
    pixels[pixelIndex + 2] = colors[2];
    pixels[pixelIndex + 3] = 0xff;
}

init().then(() => {
    window.requestAnimationFrame(step);
}).catch(e => console.error(`cannot init: ${e}`));

/**
 * 
 * @param {MouseEvent} e 
 */
function updateMouse(e) {
    mouseButtonPressed = (e.buttons & 1) === 1;
    clientMouseX = e.clientX;
    clientMouseY = e.clientY;
}

document.addEventListener("mousedown", updateMouse);
document.addEventListener("mousemove", updateMouse);
document.addEventListener("mouseup", updateMouse);

document.addEventListener('keydown', function (event) {
    if (event.key === '.') {
        allowCascade = !allowCascade;
    }
    if (event.key === 'f') {
        showFps = !showFps;
        if (!showFps) {
            fpsCounter.innerText = '';
        }
    }
    if (event.key === 'c') {
        shouldClearNextFrame = true;
    }
    if (event.key === ',') {
        cascadeOnceNextFrame = true;
    }
});

elementDropDown.addEventListener('change', event => {
    const elementId = event.target.value;
    selectedElement = elementId;
    console.log(`Selected Element is: ${selectedElement}`);
})
