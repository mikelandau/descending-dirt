const elementDropDown = document.getElementById('element');

const canvas = document.getElementById('ddCanvas');

const ctx = canvas.getContext('2d');

let imageData;

let mouseButtonPressed = false;
let clientMouseX = 0;
let clientMouseY = 0;

let allowCascade = true;

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
    }
};

async function init() {
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
    for (let y = totalRows - 1; y >= 0; --y) {
        for (let x = 0; x < totalColumns; ++x) {
            const element = getElementAtPixel(x, y);

            if (element === 'empty' || element === 'wall') {
                continue;
            }

            const potentialDestinations = [
                {
                    x: x,
                    y: y+1,
                    weight: 20
                },
                {
                    x: x+1,
                    y: y+1,
                    weight: 1
                },
                {
                    x: x-1,
                    y: y+1,
                    weight: 1
                },
                {
                    x: x-2,
                    y: y+1,
                    weight: 1
                },
                {
                    x: x+2,
                    y: y+1,
                    weight: 1
                },
                {
                    x: x+1,
                    y: y,
                    weight: 1
                },
                {
                    x: x-1,
                    y: y,
                    weight: 1
                }
            ];

            const stayPutWeight = 2;

            const possibleDestinations = [];
            let finalDestination;
            let totalWeight = 0;

            for (const dest of potentialDestinations) {
                if (dest.x > 0 && dest.x < totalColumns - 1 && getElementAtPixel(dest.x, dest.y) === 'empty') {
                    possibleDestinations.push(dest);
                    totalWeight += dest.weight;
                }
            }

            if (possibleDestinations.length === 0) {
                continue;
            }

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


            markPixel(x, y, 'empty');
            markPixel(finalDestination.x, finalDestination.y, element)
        }
    }
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

    if (actualR === elements.empty.r && actualG === elements.empty.g && actualB === elements.empty.b) {
        return 'empty';
    }
    else if (actualR === elements.sand.r && actualG === elements.sand.g && actualB === elements.sand.b) {
        return 'sand';
    }
    else if (actualR === elements.wall.r && actualG === elements.wall.g && actualB === elements.wall.b) {
        return 'wall';
    }
    else {
        return 'empty';
    }
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
