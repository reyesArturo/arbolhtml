/**
 * Sonic Cosmos - Musical Objects & Fix Edition
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
        this.clickPulse = 0;
        
        this.compliments = [
            "¡Sabía que tenías buen gusto!",
            "Tu playlist es puro fuego 🔥",
            "Vaya temazos tienes guardados...",
            "Tu vicio musical es de otro nivel ✨",
            "Esa canción es una joya 💎"
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
            this.revealApp(); // FIX: Si ya hay token, saltar la pregunta
        }
    }

    // --- GATE LOGIC ---
    setupGate() {
        const btnNo = document.getElementById('btn-no');
        const btnSi = document.getElementById('btn-si');
        const container = document.getElementById('gate-cage');
        
        const teleport = () => {
            btnNo.style.position = 'absolute';
            const maxX = container.clientWidth - btnNo.offsetWidth;
            const maxY = container.clientHeight - btnNo.offsetHeight;
            btnNo.style.left = `${Math.random() * maxX}px`;
            btnNo.style.top = `${Math.random() * maxY}px`;
        };

        window.addEventListener('mousemove', (e) => {
            const rect = btnNo.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(e.clientX - (rect.left + rect.width / 2), 2) + 
                Math.pow(e.clientY - (rect.top + rect.height / 2), 2)
            );
            if (distance < 70) teleport();
        });

        btnNo.addEventListener('mouseover', teleport);
        btnSi.addEventListener('click', () => this.revealApp());
    }

    revealApp() {
        const gate = document.getElementById('gate-overlay');
        const app = document.getElementById('app-content');
        if (!gate || !app) return;
        gate.style.opacity = '0';
        setTimeout(() => { 
            gate.style.display = 'none'; // Quitar del DOM para que no bloquee clics
        }, 800);
        app.style.opacity = '1';
        app.style.pointerEvents = 'auto';
        document.body.style.overflowY = 'auto'; 
    }

    // --- 3D MUSICAL ENGINE ---
    setupThreeJS() {
        const container = document.getElementById('three-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.z = 15;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Ondas
        this.ribbons = [];
        const numRibbons = 10;
        for (let r = 0; r < numRibbons; r++) {
            const points = 150;
            const pos = new Float32Array(points * 3);
            const initialY = (r - 5) * 2;
            for(let p=0; p<points; p++) {
                pos[p*3] = (p/points)*50 - 25;
                pos[p*3+1] = initialY;
                pos[p*3+2] = (Math.random()-0.5)*5;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({ size: 0.1, color: 0x1DB954, transparent: true, opacity: 0.4 });
            const pts = new THREE.Points(geo, mat);
            pts.userData = { initialY };
            this.scene.add(pts);
            this.ribbons.push(pts);
        }

        // --- AÑADIR VINILOS 3D ---
        this.vinyls = [];
        const vinylGeo = new THREE.CylinderGeometry(2, 2, 0.1, 32);
        const vinylMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 100 });
        const labelGeo = new THREE.CircleGeometry(0.6, 32);
        const labelMat = new THREE.MeshBasicMaterial({ color: 0x1DB954 });

        for(let i=0; i<4; i++) {
            const group = new THREE.Group();
            const disc = new THREE.Mesh(vinylGeo, vinylMat);
            disc.rotation.x = Math.PI/2;
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.position.z = 0.06;
            group.add(disc);
            group.add(label);
            group.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*20, (Math.random()-0.5)*10);
            group.userData = { rotSpeed: 0.02 + Math.random()*0.02 };
            this.scene.add(group);
            this.vinyls.push(group);
        }

        // --- AÑADIR NOTAS MUSICALES ---
        this.notes = [];
        const noteGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const noteStemGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        for(let i=0; i<10; i++) {
            const note = new THREE.Group();
            const head = new THREE.Mesh(noteGeo, labelMat);
            const stem = new THREE.Mesh(noteStemGeo, labelMat);
            stem.position.set(0.2, 0.5, 0);
            note.add(head); note.add(stem);
            note.position.set((Math.random()-0.5)*50, (Math.random()-0.5)*30, (Math.random()-0.5)*15);
            this.scene.add(note);
            this.notes.push(note);
        }

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        const spot = new THREE.PointLight(0x1DB954, 2, 50);
        this.scene.add(spot);

        let count = 0;
        const animate = () => {
            requestAnimationFrame(animate);
            this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
            this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;

            const beat = this.isPlaying ? 1 + Math.sin(count*0.2)*0.2 : 1;

            // Animar Ondas
            this.ribbons.forEach(ribbon => {
                const p = ribbon.geometry.attributes.position.array;
                for(let i=0; i<p.length/3; i++) {
                    const x = p[i*3];
                    const dy = ribbon.userData.initialY - (this.mouse.y * 15);
                    const dist = Math.abs(x - (this.mouse.x * 30));
                    let offset = Math.sin(x*0.2 + count*0.05) * (this.isPlaying ? 2 : 0.5);
                    if (dist < 5) offset += (5-dist)*1.5;
                    p[i*3+1] = ribbon.userData.initialY + offset;
                }
                ribbon.geometry.attributes.position.needsUpdate = true;
            });

            // Animar Vinilos
            this.vinyls.forEach(v => {
                v.rotation.z += v.userData.rotSpeed * (this.isPlaying ? 3 : 1);
                v.scale.setScalar(beat);
                // Movimiento suave
                v.position.y += Math.sin(count*0.02 + v.position.x)*0.01;
            });

            // Animar Notas
            this.notes.forEach(n => {
                n.position.x += 0.02;
                if(n.position.x > 30) n.position.x = -30;
                n.rotation.y += 0.02;
            });

            spot.position.set(this.mouse.x*30, this.mouse.y*20, 10);
            this.camera.lookAt(0,0,0);
            count += 0.5;
            this.renderer.render(this.scene, this.camera);
        };
        animate();

        window.addEventListener('mousemove', (e) => {
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    setupEventListeners() {
        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            const progress = Math.min(scroll / window.innerHeight, 1);
            this.camera.position.z = 15 - (progress * 10);
            const hero = document.getElementById('hero');
            const listView = document.getElementById('list-view');
            hero.style.opacity = 1 - (progress * 2);
            if (progress > 0.4) {
                listView.classList.add('active-view');
                listView.style.opacity = (progress-0.4)*2;
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
            if (avatar) { avatar.style.display = 'block'; avatar.src = user.images[0]?.url; }
            document.getElementById('hero-title').textContent = `¡Hola, ${user.display_name.split(' ')[0]}!`;
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
        tracks.forEach(track => {
            const row = document.createElement('div');
            row.className = 'song-row';
            row.innerHTML = `<img src="${track.album.images[0].url}"><div><div class="song-title">${track.name}</div><div class="song-artist">${track.artists[0].name}</div></div><div class="song-duration">${this.formatDuration(track.duration_ms)}</div>`;
            row.addEventListener('click', () => this.playSong({
                title: track.name, artist: track.artists[0].name, art: track.album.images[0].url, preview_url: track.preview_url
            }));
            container.appendChild(row);
        });
    }

    formatDuration(ms) {
        const m = Math.floor(ms/60000); const s = ((ms%60000)/1000).toFixed(0);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    playSong(song) {
        this.isPlaying = true;
        document.getElementById('player-bar').style.transform = 'translateX(-50%) translateY(0)';
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
        gsap.fromTo('.progress-fill', { width: '0%' }, { width: '100%', duration: 30, ease: 'none' });
    }

    togglePlay() {
        if (!this.audio) return;
        this.isPlaying = !this.isPlaying;
        document.querySelector('.play-pause-btn i').className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        if (this.isPlaying) this.audio.play(); else this.audio.pause();
    }

    generateRandomString(l) {
        let t = ''; const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < l; i++) t += p.charAt(Math.floor(Math.random() * p.length));
        return t;
    }

    async generateCodeChallenge(v) {
        const d = new TextEncoder().encode(v);
        const dg = await window.crypto.subtle.digest('SHA-256', d);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(dg))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async fetchWebApi(e) {
        const r = await fetch(`https://api.spotify.com/v1/${e}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('spotify_access_token')}` }
        });
        if (r.status === 401) { localStorage.removeItem('spotify_access_token'); this.login(); return null; }
        return await r.json();
    }

    async login() {
        const v = this.generateRandomString(128);
        const c = await this.generateCodeChallenge(v);
        localStorage.setItem('spotify_code_verifier', v);
        const args = new URLSearchParams({
            response_type: 'code', client_id: this.clientId, scope: this.scopes.join(' '), redirect_uri: this.redirectUri, code_challenge_method: 'S256', code_challenge: c, show_dialog: true
        });
        window.location.href = `https://accounts.spotify.com/authorize?${args}`;
    }

    async exchangeCodeForToken(code) {
        const v = localStorage.getItem('spotify_code_verifier');
        const body = new URLSearchParams({ grant_type: 'authorization_code', code: code, redirect_uri: this.redirectUri, client_id: this.clientId, code_verifier: v });
        const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body });
        const data = await res.json();
        if (data.access_token) { localStorage.setItem('spotify_access_token', data.access_token); this.accessToken = data.access_token; }
    }
}

window.addEventListener('DOMContentLoaded', () => new SoundJourney());