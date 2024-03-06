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

const elements = {
    empty: {
        r: 0x00,
        g: 0x00,
        b: 0x00
    },
    sand: {
        r: 0xff,
        g: 0xcb,
        b: 0x6b
    },
    wall: {
        r: 0xaa,
        g: 0xaa,
        b: 0xaa
    },
    water: {
        r: 0x20,
        g: 0x40,
        b: 0xff
    },
    oil: {
        r: 0x87,
        g: 0x5d,
        b: 0x3a
    },
    fire: {
        r: 0xff,
        g: 0x00,
        b: 0x00
    }
};

async function init() {
    console.log('loading destinations');
    const destinationsResponse = await fetch('destinations.json');
    const destinationsJson = await destinationsResponse.json();
    destinations = destinationsJson.destinations;
    stayPutWeight = destinationsJson.stayPutWeight;

    const bounding = canvas.getBoundingClientRect();
    await clearCanvas(ctx);
    imageData = ctx.getImageData(0, 0, bounding.width, bounding.height);
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
        const element = elementDropDown.value

        for (let i = mouse.X - 5; i < mouse.X + 5; ++i) {
            for (let j = mouse.Y - 5; j < mouse.Y + 5; ++j) {
                markSquare(mouse.X, mouse.Y, 5, element);
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
    const totalRows = imageData.height;
    const totalColumns = imageData.width;
    
    // clear bottom row
    for (let x = 0; x < totalColumns; ++x) {
        markPixel(x, totalRows - 1, 'empty');
    }

    // start from next to bottom row and work up
    for (let y = totalRows - 2; y >= 0; --y) {
        // loop through every pixel of this row
        for (let x = 0; x < totalColumns; ++x) {
            const element = getElementAtPixel(x, y);

            // don't move these
            if (element === 'empty' || element === 'wall') {
                continue;
            }

            // look through the destinations table and get a list of possible destinations for this pixel to move
            const possibleDestinations = [];
            let totalWeight = 0;
            for (const dest of destinations) {
                // add the deltas to the current pixel
                var potentialDestination = {
                    x: x + dest.deltaX,
                    y: y + dest.deltaY,
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
}

function isPossibleDestination(destX, destY, sourceElement) {
    const destElement = getElementAtPixel(destX, destY);
    return destElement === 'empty' || (sourceElement === 'water' && destElement === 'oil');
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

    if (isElement(actualColors, elements.empty)) {
        return 'empty';
    }
    else if (isElement(actualColors, elements.sand)) {
        return 'sand';
    }
    else if (isElement(actualColors, elements.wall)) {
        return 'wall';
    }
    else if (isElement(actualColors, elements.water)) {
        return 'water';
    }
    else if (isElement(actualColors, elements.oil)) {
        return 'oil';
    }
    else if (isElement(actualColors, elements.fire)) {
        return 'fire';
    }
    else {
        return 'empty';
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

    const elementColors = elements[element];

    if (!elementColors) {
        console.error('bad element ' + element);
    }

    const r = elementColors.r;
    const g = elementColors.g;
    const b = elementColors.b;

    var pixels = imageData.data;
    var pixelIndex = y * (imageData.width * 4) + x * 4;
    pixels[pixelIndex] = r;
    pixels[pixelIndex + 1] = g;
    pixels[pixelIndex + 2] = b;
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
