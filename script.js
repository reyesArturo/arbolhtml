/**
 * The Sound Journey - Interactive Gate (Contained Fix)
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
            // Margen de seguridad para que no toque los bordes (5px)
            const margin = 10;
            const maxX = container.clientWidth - btnNo.offsetWidth - margin;
            const maxY = container.clientHeight - btnNo.offsetHeight - margin;
            
            const randomX = Math.max(margin, Math.random() * maxX);
            const randomY = Math.max(margin, Math.random() * maxY);
            
            btnNo.style.left = `${randomX}px`;
            btnNo.style.top = `${randomY}px`;
        };

        window.addEventListener('mousemove', (e) => {
            const rect = btnNo.getBoundingClientRect();
            const btnCenterX = rect.left + rect.width / 2;
            const btnCenterY = rect.top + rect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(e.clientX - btnCenterX, 2) + 
                Math.pow(e.clientY - btnCenterY, 2)
            );

            if (distance < 70) {
                teleport();
            }
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

    getRandomCompliment() {
        return this.compliments[Math.floor(Math.random() * this.compliments.length)];
    }

    // --- SPOTIFY LOGIC ---
    async login() {
        const verifier = this.generateRandomString(128);
        const challenge = await this.generateCodeChallenge(verifier);
        localStorage.setItem('spotify_code_verifier', verifier);
        const args = new URLSearchParams({
            response_type: 'code', client_id: this.clientId,
            scope: this.scopes.join(' '), redirect_uri: this.redirectUri,
            code_challenge_method: 'S256', code_challenge: challenge, show_dialog: true
        });
        window.location.href = `https://accounts.spotify.com/authorize?${args}`;
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
            document.getElementById('dynamic-compliment').textContent = this.getRandomCompliment();
        }
    }

    renderSongs(tracks) {
        const container = document.getElementById('song-list');
        container.innerHTML = '';
        tracks.forEach((track, index) => {
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

    setupThreeJS() {
        const container = document.getElementById('three-container');
        if(!container) return;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.z = 20;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);
        const amount = 100;
        const positions = new Float32Array(amount * amount * 3);
        const initialPositions = new Float32Array(amount * amount * 3);
        let idx = 0;
        for (let ix = 0; ix < amount; ix++) {
            for (let iy = 0; iy < amount; iy++) {
                const x = ix * 0.6 - (amount * 0.6) / 2;
                const z = iy * 0.6 - (amount * 0.6) / 2;
                positions[idx] = initialPositions[idx] = x;
                positions[idx + 1] = initialPositions[idx + 1] = 0;
                positions[idx + 2] = initialPositions[idx + 2] = z;
                idx += 3;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ size: 0.05, color: 0x1DB954, transparent: true, opacity: 0.4 });
        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);

        let count = 0;
        const animate = () => {
            requestAnimationFrame(animate);
            this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
            this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;
            const pos = this.points.geometry.attributes.position.array;
            let i = 0;
            const amp = this.isPlaying ? 2 : 0.5;
            for (let ix = 0; ix < amount; ix++) {
                for (let iy = 0; iy < amount; iy++) {
                    const ixPos = initialPositions[i];
                    const izPos = initialPositions[i + 2];
                    let newY = (Math.sin((ix + count) * 0.3) * amp) + (Math.sin((iy + count) * 0.5) * amp);
                    const dx = ixPos - (this.mouse.x * 20);
                    const dz = izPos - (-this.mouse.y * 20);
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    if (dist < 5) newY += (5 - dist) * 1.5;
                    pos[i + 1] = newY;
                    i += 3;
                }
            }
            this.points.geometry.attributes.position.needsUpdate = true;
            this.camera.position.x += (this.mouse.x * 2 - this.camera.position.x) * 0.05;
            this.camera.position.y += (-this.mouse.y * 2 + 8 - this.camera.position.y) * 0.05;
            this.camera.lookAt(0, 0, 0);
            count += this.isPlaying ? 0.08 : 0.03;
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    setupEventListeners() {
        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            const viewportH = window.innerHeight;
            const progress = Math.min(scroll / viewportH, 1);
            this.camera.position.z = 20 - (progress * 15);
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
        window.addEventListener('mousemove', (e) => {
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    playSong(song) {
        this.isPlaying = true;
        const player = document.getElementById('player-bar');
        player.style.transform = 'translateX(-50%) translateY(0)';
        document.getElementById('current-title').textContent = song.title;
        document.getElementById('current-artist').textContent = song.artist;
        document.getElementById('current-album-art').src = song.art;
        document.querySelector('.play-pause-btn i').className = 'fas fa-pause';
        document.getElementById('player-comment').textContent = this.getRandomCompliment();
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
}

window.addEventListener('DOMContentLoaded', () => new SoundJourney());