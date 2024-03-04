const canvas = document.getElementById('ddCanvas');

const bounding = canvas.getBoundingClientRect();

const ctx = canvas.getContext('2d');

let imageData;

let mouseButtonPressed = false;
let clientMouseX = 0;
let clientMouseY = 0;

async function init() {
    await clearCanvas(ctx);
    imageData = ctx.getImageData(0, 0, bounding.width, bounding.height);
}

function step() {
    draw();
    window.requestAnimationFrame(step);
}

function draw() {
    if (mouseButtonPressed) {
        const mouseX = Math.floor(clientMouseX - bounding.x);
        const mouseY = Math.floor(clientMouseY - bounding.y);

        for (let i = mouseX - 5; i < mouseX + 5; ++i) {
            for (let j = mouseY - 5; j < mouseY + 5; ++j) {
                markSquare(mouseX, mouseY, 5);
            }
        }
    }

    drawImageDataToCanvas(imageData);
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

function markSquare(x, y, radius)
{
    for (let i = x - (radius - 1); i < x + (radius - 1); ++i) {
        for (let j = y - (radius - 1); j < y + (radius - 1); ++j) {
            markPixel(i, j, 0xFF, 0xFF, 0x00);
        }
    }
}

function markPixel(x, y, r, g, b)
{
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return;
    }

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
