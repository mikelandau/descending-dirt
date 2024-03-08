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

let elements = [];
let selectedElement;

let totalRows = 0, totalColumns = 0;

let lastMarkedX = -1;
let lastMarkedY = -1;

const CASCADE_DIRECTION_UP = -1, CASCADE_DIRECTION_DOWN = 1, CASCADE_DIRECTION_STILL = 0;

let lastFrameTimestamp;

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function init() {
    console.log('loading destinations');
    const destinationsResponse = await fetch('destinations.json');
    const destinationsJson = await destinationsResponse.json();
    destinations = destinationsJson.destinations;
    stayPutWeight = destinationsJson.stayPutWeight;

    console.log('loading elements');
    const elementsResponse = await fetch('elements.json');
    const elementsJson = await elementsResponse.json();
    elements = [];
    for (const elementJson of elementsJson) {
        // parse string color value to integer -- comparing integers is faster than comparing strings.
        // json doesn't support hex literals, so this way we can use either hex string or decimal integer
        // in the json file, but the actual object will always use integers.
        const element = {
            ...elementJson,
            r: parseInt(elementJson.r),
            g: parseInt(elementJson.g),
            b: parseInt(elementJson.b)
        };
        elements.push(element);
    }

    const selectableElements = elements.filter(x => !x.hidden);

    // take off the default element, add it to the end
    const defaultElement = selectableElements.shift();
    selectableElements.push(defaultElement);

    const elementOptions = selectableElements.map((element, i) => {
        const elementOption = document.createElement('option');

        elementOption.setAttribute('value', element.name);
        if (i === 0) {
            elementOption.selected = true;
        }

        let displayName;
        if (i == selectableElements.length - 1) {
            displayName = 'Eraser';
        }
        else {
            displayName = capitalize(element.name);
        }
        const textContent = document.createTextNode(displayName);
        elementOption.appendChild(textContent);
        return elementOption;
    });

    elementDropDown.innerText = '';
    for (const option of elementOptions) {
        elementDropDown.appendChild(option);
    }

    selectedElement = elements.find(element => element.name === selectableElements[0].name);

    const bounding = canvas.getBoundingClientRect();
    await clearCanvas(ctx);
    imageData = ctx.getImageData(0, 0, bounding.width, bounding.height);
    totalRows = imageData.width;
    totalColumns = imageData.height;
}

function step() {
    draw();
    const timestampNow = performance.now();

    if (showFps) {
        if (lastFrameTimestamp) {
            var msDifference = timestampNow - lastFrameTimestamp;
            var fps = Math.floor(1000 / msDifference);
            fpsCounter.innerText = `${fps} FPS`;
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
            markPixel(x, y, elements[0]);
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
        markPixel(x, 0, elements[0]);
        markPixel(x, totalRows - 1, elements[0]);
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

function cascadeRow(y, direction) {
    // loop through every pixel of this row
    for (let x = 0; x < totalColumns; ++x) {
        const element = getElementAtPixel(x, y);

        // if cascading down, process still and downward elements. If cascading up, only process upward elements
        if (element.name === 'empty' ||
            direction === CASCADE_DIRECTION_DOWN && element.direction === CASCADE_DIRECTION_UP ||
            direction === CASCADE_DIRECTION_UP && element.direction !== CASCADE_DIRECTION_UP) {
                continue;
            }

        if (element.mortality) {
            // delete the pixel according to its "mortality" rate
            if (element.mortality >= 100 || Math.floor(Math.random() * 100) < element.mortality) {
                if (element.resurrectsInto) {
                    markPixel(x, y, getElementByName(element.resurrectsInto))
                }
                else {
                    markPixel(x, y, elements[0]);
                }
                // once dead, move to the next pixel
                continue;
            }
        }

        // mark surrounding pixels with this element if the pixel contains an "engulfs" element.
        // TODO: Maybe we can improve this, I think this is going slow
        if (element.engulfs) {
            for (const engulf of element.engulfs) {
                let elementToEngulfWith;
                if (engulf.into) {
                    elementToEngulfWith = getElementByName(engulf.into);
                } else {
                    elementToEngulfWith = element;
                }

                const radius = engulf.radius || 1;

                for (let i = x - radius; i <= x + radius; ++i) {
                    for (let j = y - radius; j <= y + radius; ++j) {
                        if (i > 0 && i < totalColumns && j > 0 && j < totalRows) {
                            const destElement = getElementAtPixel(i, j)
                            if (destElement.name === engulf.dest) {
                                markPixel(i, j, elementToEngulfWith)
                            }
                        }
                    }
                }
            }
        }

        // no need to process further for elements that don't move
        if (element.direction === CASCADE_DIRECTION_STILL) {
            continue;
        }

        // look through the destinations table and get a list of possible destinations for this pixel to move
        const possibleDestinations = [];
        let totalWeight = 0;
        for (const dest of destinations) {
            // add the deltas to the current pixel
            var potentialDestination = {
                x: x + dest.deltaX,
                y: y + dest.deltaY * element.direction,
                weight: dest.weight
            };

            // see if that's a space this pixel can move to
            if (potentialDestination.x > 0
                && potentialDestination.x < totalColumns - 1
                && isPossibleDestination(potentialDestination.x, potentialDestination.y, element)) {
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
        const destOriginalElement = getElementAtPixel(finalDestination.x, finalDestination.y);
        markPixel(x, y, destOriginalElement);
        markPixel(finalDestination.x, finalDestination.y, element)
    }
}


function isPossibleDestination(destX, destY, sourceElement) {
    const destElement = getElementAtPixel(destX, destY);
    if (destElement.name === 'empty') {
        return true;
    }
    if (sourceElement.penetrates) {
        for (const penetrated of sourceElement.penetrates) {
            if (penetrated === destElement.name) {
                return true;
            }
        }
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

function getElementAtPixel(x, y) {
    const pixelIndex = getImageDataPixelIndex(x, y);
    const actualR = imageData.data[pixelIndex];
    const actualG = imageData.data[pixelIndex + 1];
    const actualB = imageData.data[pixelIndex + 2];

    const actualColors = {
        r: actualR,
        g: actualG,
        b: actualB
    }

    for (const element of elements) {
        if (isElement(actualColors, element)) {
            return element;
        }
    }
    // default to the first in the list (best this is set to "empty")
    return elements[0];
}

function getElementByName(name) {
    for (const element of elements) {
        if (element.name === name) {
            return element;
        }
    }
}

function isElement(actualColors, element) {
    return actualColors.r === element.r
        && actualColors.g === element.g
        && actualColors.b === element.b;
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

function markPixel(x, y, element) {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return;
    }

    var pixels = imageData.data;
    var pixelIndex = y * (imageData.width * 4) + x * 4;
    pixels[pixelIndex] = element.r;
    pixels[pixelIndex + 1] = element.g;
    pixels[pixelIndex + 2] = element.b;
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
    const elementName = event.target.value;
    for (const element of elements) {
        if (element.name === elementName) {
            console.log(element);
            selectedElement = element;
            return;
        }
    }
    console.error(`invalid element: ${elementName}`);
})
