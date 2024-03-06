const elementDropDown = document.getElementById('element');

const canvas = document.getElementById('ddCanvas');

const ctx = canvas.getContext('2d');

let imageData;

let mouseButtonPressed = false;
let clientMouseX = 0;
let clientMouseY = 0;

let allowCascade = true;

let destinations = [];
let stayPutWeight = 1;

let elements = [];
let selectedElement;

let totalRows = 0, totalColumns = 0;

const CASCADE_DIRECTION_UP = -1, CASCADE_DIRECTION_DOWN = 1, CASCADE_DIRECTION_STILL = 0;

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

    const elementOptions = elements.map((element, i) => {
        const elementOption = document.createElement('option');
        elementOption.setAttribute('value', element.name);
        if (i === 0) {
            elementOption.selected = true;
        }
        var textContent = document.createTextNode(capitalize(element.name));
        elementOption.appendChild(textContent);
        return elementOption;
    });

    elementDropDown.innerText = '';
    for (const option of elementOptions) {
        elementDropDown.appendChild(option);
    }

    selectedElement = elements[0];

    const bounding = canvas.getBoundingClientRect();
    await clearCanvas(ctx);
    imageData = ctx.getImageData(0, 0, bounding.width, bounding.height);
    totalRows = imageData.width;
    totalColumns = imageData.height;
}

function step() {
    draw();
    window.requestAnimationFrame(step);
}

function draw() {
    if (allowCascade) {
        cascade();
    }
    
    if (mouseButtonPressed) {
        const mouse = getCanvasMousePosition();

        for (let i = mouse.X - 5; i < mouse.X + 5; ++i) {
            for (let j = mouse.Y - 5; j < mouse.Y + 5; ++j) {
                markSquare(mouse.X, mouse.Y, 5, selectedElement);
            }
        }
    }

    drawImageDataToCanvas(imageData);
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

    // TODO see if going down then up works
}

function cascadeRow(y, direction) {
    // loop through every pixel of this row
    for (let x = 0; x < totalColumns; ++x) {
        const element = getElementAtPixel(x, y);

        // only move elements for this direction
        if (element.direction !== direction) {
            continue;
        }

        if (element.mortality) {
            // delete the pixel according to its "mortality" rate
            const random = Math.floor(Math.random() * 100);
            if (random < element.mortality) {
                markPixel(x, y, elements[0]);
                // once dead, move to the next pixel
                continue;
            }
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

        possibleDestinations.push({
            x: x,
            y: y,
            weight: stayPutWeight
        });
        totalWeight += stayPutWeight;

        finalDestination = possibleDestinations[0];

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

        const destOriginalElement = getElementAtPixel(finalDestination.x, finalDestination.y);

        markPixel(x, y, destOriginalElement);
        markPixel(finalDestination.x, finalDestination.y, element)
    }
}


function isPossibleDestination(destX, destY, sourceElement) {
    const destElement = getElementAtPixel(destX, destY);
    return destElement.name === 'empty' || (sourceElement.name === 'water' && destElement.name === 'oil');
}

async function clearCanvas()
{
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawImageDataToCanvas()
{
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

function isElement(actualColors, element) {
    return actualColors.r === element.r 
        && actualColors.g === element.g 
        && actualColors.b === element.b;
}

function getImageDataPixelIndex(x, y) {
    return y * (imageData.width * 4) + x * 4;
}

function markSquare(x, y, radius, element)
{
    for (let i = x - (radius - 1); i < x + (radius - 1); ++i) {
        for (let j = y - (radius - 1); j < y + (radius - 1); ++j) {
            markPixel(i, j, element);
        }
    }
}

function markPixel(x, y, element)
{
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

document.addEventListener('keydown', function(event) {
    if (event.key === '.') {
        allowCascade = !allowCascade;
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
