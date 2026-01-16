const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let flowers = [];
let growthQueue = [];
let mouse = { x: -1000, y: -1000 };
let isAnimating = false;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function createFlower(x, y, size, color) {
    flowers.push({
        x: x,
        y: y,
        originalX: x,
        originalY: y,
        size: size,
        color: color,
        seed: Math.random() * 100,
        opacity: 0
    });
}

function renderFlower(f) {
    const dx = mouse.x - f.x;
    const dy = mouse.y - f.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Interacción suave con el mouse
    if (dist < 120) {
        const force = (120 - dist) / 120;
        f.x -= dx * force * 0.08;
        f.y -= dy * force * 0.08;
    } else {
        f.x += (f.originalX - f.x) * 0.06;
        f.y += (f.originalY - f.y) * 0.06;
    }

    const sway = Math.sin(Date.now() * 0.0015 + f.seed) * 1.5;

    ctx.save();
    ctx.translate(f.x + sway, f.y + sway);
    ctx.rotate(f.seed + (sway * 0.03));
    ctx.globalAlpha = f.opacity;

    const petalCount = 5;
    for (let i = 0; i < petalCount; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2) / petalCount * i);

        ctx.beginPath();
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, f.size * 1.5);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.4, f.color);
        grad.addColorStop(1, f.color);
        ctx.fillStyle = grad;

        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(f.size, -f.size, f.size * 2, -f.size / 2, f.size * 1.5, 0);
        ctx.bezierCurveTo(f.size * 2, f.size / 2, f.size, f.size, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    // Centro
    ctx.beginPath();
    ctx.fillStyle = "#FFD700";
    ctx.arc(0, 0, f.size / 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (f.opacity < 1) f.opacity += 0.03;
}

function startGrowth(x, y, len, angle, thickness) {
    growthQueue.push({ x, y, len, angle, thickness });
}

function processGrowth() {
    if (growthQueue.length === 0) return;

    // Procesar hasta 3 ramas por frame para mayor fluidez sin saturar
    const branchesToProcess = Math.min(growthQueue.length, 3);

    for (let i = 0; i < branchesToProcess; i++) {
        const b = growthQueue.shift();
        if (b.len < 5) continue;

        const endX = b.x + b.len * Math.sin(b.angle * Math.PI / 180);
        const endY = b.y - b.len * Math.cos(b.angle * Math.PI / 180);

        // Dibujar rama inmediatamente
        ctx.beginPath();
        ctx.strokeStyle = "#5c4033";
        ctx.lineWidth = b.thickness;
        ctx.lineCap = 'round';
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Generar flores de forma tupida
        if (b.len < 45) {
            const colors = ['#FFB7C5', '#F4C2C2', '#E6E6FA', '#FFDAB9', '#FADADD', '#D8BFD8'];
            const count = b.len < 15 ? 5 : 2;
            for (let j = 0; j < count; j++) {
                createFlower(
                    endX + (Math.random() - 0.5) * 30,
                    endY + (Math.random() - 0.5) * 30,
                    4 + Math.random() * 6,
                    colors[Math.floor(Math.random() * colors.length)]
                );
            }
        }

        // Añadir hijos a la cola
        growthQueue.push({ x: endX, y: endY, len: b.len * 0.78, angle: b.angle - 28, thickness: b.thickness * 0.7 });
        growthQueue.push({ x: endX, y: endY, len: b.len * 0.78, angle: b.angle + 28, thickness: b.thickness * 0.7 });
        if (Math.random() > 0.7) {
            growthQueue.push({ x: endX, y: endY, len: b.len * 0.5, angle: b.angle + (Math.random() - 0.5) * 15, thickness: b.thickness * 0.6 });
        }
    }
}

function animate() {
    // Dibujamos las flores sobre las ramas ya dibujadas
    // Para que las ramas no desaparezcan, NO limpiamos todo el canvas indiscriminadamente
    // Usamos una técnica de capas:

    // 1. Guardar el estado actual de las ramas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0); // Redibujar ramas estáticas

        processGrowth();

        // Si seguimos creciendo, actualizar la "capa estática" de ramas
        if (growthQueue.length > 0) {
            tempCtx.drawImage(canvas, 0, 0);
        }

        flowers.forEach(f => renderFlower(f));
        requestAnimationFrame(loop);
    }
    loop();
}

function timeElapse(date) {
    const current = new Date();
    const seconds = (Date.parse(current) - Date.parse(date)) / 1000;
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    document.getElementById("elapseClock").innerHTML = `${days} días, ${hours} horas, ${minutes} minutos, ${remainingSeconds} segundos`;
}

const startButton = document.getElementById('startButton');
const uiContainer = document.getElementById('ui-container');
const words = document.getElementById('words');
const startDate = new Date("2024-01-01T00:00:00");

startButton.addEventListener('click', () => {
    uiContainer.style.display = 'none';
    setTimeout(() => {
        words.style.display = 'block';
        words.style.opacity = '1';
        timeElapse(startDate);
        setInterval(() => timeElapse(startDate), 1000);
    }, 1500);

    animate();
    startGrowth(canvas.width / 2, canvas.height * 0.85, 110, 0, 12);
});