/**
 * Sonic Cosmos - Ultra Interactive Edition
 */

class SoundJourney {
    constructor() {
        this.clientId = '067c567e47684a17b62e82ebc212c692'; 
        this.redirectUri = window.location.origin + window.location.pathname;
        if (this.redirectUri.endsWith('/')) this.redirectUri = this.redirectUri.slice(0, -1);

        this.scopes = ['user-top-read', 'user-read-private', 'user-read-email'];
        this.isPlaying = false;
        this.audio = null;
        this.currentRange = 'short_term';

        this.mouse = new THREE.Vector2(0, 0);
        this.targetMouse = new THREE.Vector2(0, 0);
        this.clickPulse = 0; // Fuerza de la explosión
        
        this.compliments = [
            "¡Sabía que tenías buen gusto!",
            "Tu playlist es puro fuego 🔥",
            "Vaya temazos tienes guardados...",
            "Tu vicio musical es de otro nivel ✨",
            "Esa canción es una joya 💎",
            "Tienes un estilo impecable 👌",
            "Tu historia musical es increíble 🚀"
        ];
        
        this.init();
    }

    async init() {
        this.setupGate(); 
        this.setupThreeJS();
        this.setupEventListeners();

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            await this.exchangeCodeForToken(code);
            window.history.replaceState({}, document.title, window.location.pathname); 
            this.revealApp(); 
        }

        this.accessToken = localStorage.getItem('spotify_access_token');
        if (this.accessToken) {
            await this.loadUserData();
            await this.fetchUserTopTracks(this.currentRange);
        }
    }

    // --- GATE LOGIC ---
    setupGate() {
        const btnNo = document.getElementById('btn-no');
        const btnSi = document.getElementById('btn-si');
        const container = document.getElementById('gate-cage');
        
        const teleport = () => {
            btnNo.style.position = 'absolute';
            const margin = 10;
            const maxX = container.clientWidth - btnNo.offsetWidth - margin;
            const maxY = container.clientHeight - btnNo.offsetHeight - margin;
            btnNo.style.left = `${Math.max(margin, Math.random() * maxX)}px`;
            btnNo.style.top = `${Math.max(margin, Math.random() * maxY)}px`;
        };

        window.addEventListener('mousemove', (e) => {
            const rect = btnNo.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(e.clientX - (rect.left + rect.width / 2), 2) + 
                Math.pow(e.clientY - (rect.top + rect.height / 2), 2)
            );
            if (distance < 80) teleport();
        });

        btnNo.addEventListener('mouseover', teleport);
        btnNo.addEventListener('click', (e) => { e.preventDefault(); teleport(); return false; });
        btnSi.addEventListener('click', () => this.revealApp());
    }

    revealApp() {
        const gate = document.getElementById('gate-overlay');
        const app = document.getElementById('app-content');
        gate.style.opacity = '0';
        setTimeout(() => { gate.style.visibility = 'hidden'; }, 1000);
        app.style.opacity = '1';
        app.style.pointerEvents = 'auto';
        document.body.style.overflowY = 'auto'; 
    }

    // --- SONIC COSMOS 3D ENGINE ---
    setupThreeJS() {
        const container = document.getElementById('three-container');
        if(!container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.z = 15;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Crear Ondas Musicales (Ribbons)
        this.ribbons = [];
        const numRibbons = 12;
        const pointsPerRibbon = 180;
        const ribbonWidth = 60;
        
        for (let r = 0; r < numRibbons; r++) {
            const positions = new Float32Array(pointsPerRibbon * 3);
            const initialY = (r - numRibbons / 2) * 2;
            for (let p = 0; p < pointsPerRibbon; p++) {
                positions[p * 3] = (p / pointsPerRibbon) * ribbonWidth - ribbonWidth / 2;
                positions[p * 3 + 1] = initialY;
                positions[p * 3 + 2] = (Math.random() - 0.5) * 5;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({ size: 0.1, color: 0x1DB954, transparent: true, opacity: 0.5 });
            const points = new THREE.Points(geo, mat);
            points.userData = { initialY: initialY, velocity: new Float32Array(pointsPerRibbon) };
            this.scene.add(points);
            this.ribbons.push(points);
        }

        // Añadir Orbes Interactivos
        this.orbs = [];
        const orbGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const orbMat = new THREE.MeshPhongMaterial({ 
            color: 0x1DB954, emissive: 0x1DB954, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 
        });
        const light = new THREE.PointLight(0x1DB954, 1, 50);
        this.scene.add(light);
        this.orbLight = light;

        for(let o=0; o<10; o++) {
            const orb = new THREE.Mesh(orbGeo, orbMat.clone());
            orb.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*20, (Math.random()-0.5)*10);
            orb.userData = { 
                velocity: new THREE.Vector3((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1),
                originalScale: 1
            };
            this.scene.add(orb);
            this.orbs.push(orb);
        }

        let count = 0;
        const animate = () => {
            requestAnimationFrame(animate);
            this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
            this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;

            if (this.clickPulse > 0) this.clickPulse *= 0.92; // Disminuir explosión

            const speedMult = this.isPlaying ? 2.5 : 1.0;
            const ampMult = this.isPlaying ? 2.0 : 0.5;

            // Animar Ondas
            this.ribbons.forEach((ribbon) => {
                const pos = ribbon.geometry.attributes.position.array;
                const initialY = ribbon.userData.initialY;
                for (let p = 0; p < pointsPerRibbon; p++) {
                    const x = pos[p * 3];
                    const z = pos[p * 3 + 2];
                    
                    let yOffset = Math.sin(x * 0.2 + count * 0.05 * speedMult) * ampMult;
                    
                    // Atracción magnética del mouse
                    const dx = x - (this.mouse.x * 30);
                    const dy = initialY - (this.mouse.y * 15);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < 6) {
                        yOffset += (6 - dist) * 1.5;
                    }

                    // Efecto Explosión (Click)
                    if (this.clickPulse > 0.1) {
                        yOffset += (Math.random()-0.5) * this.clickPulse * 5;
                    }

                    pos[p * 3 + 1] = initialY + yOffset;
                }
                ribbon.geometry.attributes.position.needsUpdate = true;
            });

            // Animar Orbes
            this.orbs.forEach(orb => {
                orb.position.add(orb.userData.velocity);
                
                // Rebote en bordes invisibles
                if (Math.abs(orb.position.x) > 25) orb.userData.velocity.x *= -1;
                if (Math.abs(orb.position.y) > 15) orb.userData.velocity.y *= -1;

                // Empujón del mouse
                const dx = orb.position.x - (this.mouse.x * 25);
                const dy = orb.position.y - (this.mouse.y * 15);
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 5) {
                    orb.userData.velocity.x += dx * 0.01;
                    orb.userData.velocity.y += dy * 0.01;
                    orb.material.emissiveIntensity = 2;
                } else {
                    orb.material.emissiveIntensity = 0.5;
                }

                // Pulso con la música
                const s = this.isPlaying ? 1 + Math.sin(count*0.2)*0.3 : 1;
                orb.scale.setScalar(s);
            });

            this.orbLight.position.set(this.mouse.x * 25, this.mouse.y * 15, 5);

            this.camera.position.x += (this.mouse.x * 2 - this.camera.position.x) * 0.05;
            this.camera.position.y += (-this.mouse.y * 2 + 5 - this.camera.position.y) * 0.05;
            this.camera.lookAt(0, 0, 0);

            count += 0.5;
            this.renderer.render(this.scene, this.camera);
        };
        animate();

        window.addEventListener('mousedown', () => {
            this.clickPulse = 2.0; // Iniciar explosión
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('mousemove', (e) => {
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    setupEventListeners() {
        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            const viewportH = window.innerHeight;
            const progress = Math.min(scroll / viewportH, 1);
            this.camera.position.z = 15 - (progress * 10);
            const hero = document.getElementById('hero');
            const listView = document.getElementById('list-view');
            hero.style.opacity = 1 - (progress * 2.5);
            if (progress > 0.4) {
                listView.classList.add('active-view');
                listView.style.opacity = (progress - 0.4) * 2.5;
            } else {
                listView.classList.remove('active-view');
                listView.style.opacity = 0;
            }
        });

        document.getElementById('login-btn-hero')?.addEventListener('click', () => this.login());
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentRange = btn.dataset.range;
                await this.fetchUserTopTracks(this.currentRange);
            });
        });
        document.querySelector('.play-pause-btn')?.addEventListener('click', () => this.togglePlay());
    }

    async loadUserData() {
        const user = await this.fetchWebApi('me');
        if (user) {
            const avatar = document.getElementById('user-avatar');
            if (avatar) {
                avatar.style.display = 'block';
                avatar.src = user.images[0]?.url || 'https://i.pravatar.cc/150';
            }
            const name = user.display_name.split(' ')[0];
            document.getElementById('hero-title').textContent = `¡Hola, ${name}!`;
        }
    }

    async fetchUserTopTracks(range) {
        const data = await this.fetchWebApi(`me/top/tracks?time_range=${range}&limit=20`);
        if (data && data.items) {
            this.renderSongs(data.items);
            document.getElementById('dynamic-compliment').textContent = this.compliments[Math.floor(Math.random()*this.compliments.length)];
        }
    }

    renderSongs(tracks) {
        const container = document.getElementById('song-list');
        container.innerHTML = '';
        tracks.forEach((track) => {
            const row = document.createElement('div');
            row.className = 'song-row';
            row.innerHTML = `
                <img src="${track.album.images[0]?.url}" alt="Art">
                <div class="song-info">
                    <div class="song-title">${track.name}</div>
                    <div class="song-artist">${track.artists[0].name}</div>
                </div>
                <div class="song-duration">${this.formatDuration(track.duration_ms)}</div>
            `;
            row.addEventListener('click', () => this.playSong({
                title: track.name, artist: track.artists[0].name,
                art: track.album.images[0]?.url, preview_url: track.preview_url
            }));
            container.appendChild(row);
        });
    }

    formatDuration(ms) {
        const m = Math.floor(ms / 60000);
        const s = ((ms % 60000) / 1000).toFixed(0);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    playSong(song) {
        this.isPlaying = true;
        const player = document.getElementById('player-bar');
        player.style.transform = 'translateX(-50%) translateY(0)';
        document.getElementById('current-title').textContent = song.title;
        document.getElementById('current-artist').textContent = song.artist;
        document.getElementById('current-album-art').src = song.art;
        document.querySelector('.play-pause-btn i').className = 'fas fa-pause';
        document.getElementById('player-comment').textContent = this.compliments[Math.floor(Math.random()*this.compliments.length)];
        if (song.preview_url) {
            if (this.audio) this.audio.pause();
            this.audio = new Audio(song.preview_url);
            this.audio.play();
        }
        gsap.killTweensOf('.progress-fill');
        gsap.fromTo('.progress-fill', { width: '0%' }, { width: '100%', duration: 30, ease: 'none' });
    }

    togglePlay() {
        if (!this.audio) return;
        this.isPlaying = !this.isPlaying;
        const icon = document.querySelector('.play-pause-btn i');
        if (this.isPlaying) { icon.className = 'fas fa-pause'; this.audio.play(); }
        else { icon.className = 'fas fa-play'; this.audio.pause(); }
    }

    generateRandomString(l) {
        let t = ''; const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < l; i++) t += p.charAt(Math.floor(Math.random() * p.length));
        return t;
    }

    async generateCodeChallenge(v) {
        const d = new TextEncoder().encode(v);
        const dg = await window.crypto.subtle.digest('SHA-256', d);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(dg)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async fetchWebApi(e) {
        const r = await fetch(`https://api.spotify.com/v1/${e}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('spotify_access_token')}` }
        });
        if (r.status === 401) { localStorage.removeItem('spotify_access_token'); this.login(); return null; }
        return await r.json();
    }

    async exchangeCodeForToken(code) {
        const verifier = localStorage.getItem('spotify_code_verifier');
        const body = new URLSearchParams({
            grant_type: 'authorization_code', code: code,
            redirect_uri: this.redirectUri, client_id: this.clientId, code_verifier: verifier,
        });
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        const data = await res.json();
        if (data.access_token) {
            localStorage.setItem('spotify_access_token', data.access_token);
            this.accessToken = data.access_token;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => new SoundJourney());