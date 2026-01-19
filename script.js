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

// Touch events for mobile devices - only on canvas
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // Move mouse position off-screen when touch ends
    mouse.x = -1000;
    mouse.y = -1000;
}, { passive: false });

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

// Crear flores por toda la pantalla
function createBouquet() {
    const colors = ['#FFB7C5', '#F4C2C2', '#E6E6FA', '#FFDAB9', '#FADADD', '#D8BFD8', '#FFE4E1', '#FFC0CB', '#FFB6C1', '#FFA07A'];

    // Crear un patrón de flores distribuidas por toda la pantalla
    const rows = 8;
    const cols = 12;
    const marginX = 80;
    const marginY = 60;

    const availableWidth = canvas.width - (marginX * 2);
    const availableHeight = canvas.height - (marginY * 2);

    const spacingX = availableWidth / (cols - 1);
    const spacingY = availableHeight / (rows - 1);

    let delay = 0;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Añadir algo de aleatoriedad a la posición
            const randomOffsetX = (Math.random() - 0.5) * 40;
            const randomOffsetY = (Math.random() - 0.5) * 40;

            const x = marginX + (col * spacingX) + randomOffsetX;
            const y = marginY + (row * spacingY) + randomOffsetY;

            // Variar el tamaño de las flores
            const size = 8 + Math.random() * 8;

            setTimeout(() => {
                // Dibujar un tallo simple
                ctx.strokeStyle = "#4a7c59";
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x, y + size * 2);
                ctx.lineTo(x, y + size * 4);
                ctx.stroke();

                // Añadir hojas ocasionalmente
                if (Math.random() > 0.7) {
                    ctx.fillStyle = "#5a9c6f";
                    ctx.beginPath();
                    ctx.ellipse(x - 5, y + size * 3, 4, 8, -0.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(x + 5, y + size * 3.5, 4, 8, 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                createFlower(
                    x,
                    y,
                    size,
                    colors[Math.floor(Math.random() * colors.length)]
                );
            }, delay);

            delay += 30; // Reducir el delay para que aparezcan más rápido
        }
    }

    // Añadir flores adicionales aleatorias para llenar espacios
    for (let i = 0; i < 40; i++) {
        const x = marginX + Math.random() * availableWidth;
        const y = marginY + Math.random() * availableHeight;
        const size = 6 + Math.random() * 6;

        setTimeout(() => {
            ctx.strokeStyle = "#4a7c59";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y + size * 2);
            ctx.lineTo(x, y + size * 3.5);
            ctx.stroke();

            createFlower(
                x,
                y,
                size,
                colors[Math.floor(Math.random() * colors.length)]
            );
        }, delay);

        delay += 25;
    }
}

function animate() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);

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

const siButton = document.getElementById('siButton');
const noButton = document.getElementById('noButton');
const uiContainer = document.getElementById('ui-container');
const spotifyContainer = document.getElementById('spotify-container');
const words = document.getElementById('words');
const startDate = new Date("2024-01-01T00:00:00");

// Lógica para que el botón "No" se teletransporte lejos del puntero
let offsetX = 0;
let offsetY = 0;
let lastMoveTime = 0;
const teasingEmoji = document.getElementById('teasingEmoji');

document.addEventListener('mousemove', (e) => {
    const radius = 150; // Radio de detección
    const rect = noButton.getBoundingClientRect();
    const buttonCenterX = rect.left + rect.width / 2;
    const buttonCenterY = rect.top + rect.height / 2;

    const dx = buttonCenterX - e.clientX;
    const dy = buttonCenterY - e.clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Si el mouse está demasiado cerca, teletransportar el botón
    if (distance < radius) {
        const now = Date.now();
        // Limitar la frecuencia de teletransporte para evitar parpadeo
        if (now - lastMoveTime > 100) {
            // Mostrar emoji en la posición actual del botón
            teasingEmoji.style.left = `${buttonCenterX - 25}px`;
            teasingEmoji.style.top = `${buttonCenterY - 25}px`;
            teasingEmoji.style.display = 'block';

            // Reiniciar animación
            teasingEmoji.style.animation = 'none';
            setTimeout(() => {
                teasingEmoji.style.animation = 'teaseFade 0.8s ease-out forwards';
            }, 10);

            // Ocultar después de la animación
            setTimeout(() => {
                teasingEmoji.style.display = 'none';
            }, 800);

            // Calcular una nueva posición aleatoria lejos del mouse
            const angle = Math.random() * Math.PI * 2;
            const minDistance = 250; // Distancia mínima del mouse
            const randomDistance = minDistance + Math.random() * 150;

            const newOffsetX = Math.cos(angle) * randomDistance;
            const newOffsetY = Math.sin(angle) * randomDistance;

            // Limitar para que no se salga demasiado
            const maxOffsetX = 350;
            const maxOffsetYUp = 350;
            const maxOffsetYDown = 80;

            offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));

            if (newOffsetY > 0) {
                offsetY = Math.min(maxOffsetYDown, newOffsetY);
            } else {
                offsetY = Math.max(-maxOffsetYUp, newOffsetY);
            }

            noButton.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            lastMoveTime = now;
        }
    }
});

siButton.addEventListener('click', () => {
    uiContainer.style.opacity = '0';
    setTimeout(() => {
        uiContainer.style.display = 'none';
        spotifyContainer.style.display = 'block';
        words.style.display = 'block';
        words.style.opacity = '1';

        // Iniciar el reloj si existe el elemento (estaba comentado en HTML pero por si acaso)
        const clockElem = document.getElementById("elapseClock");
        if (clockElem) {
            timeElapse(startDate);
            setInterval(() => timeElapse(startDate), 1000);
        }
    }, 500);

    animate();
    createBouquet();
});