console.log("[SoundManager] Script Loading...");
window.SoundManager = {
    ctx: null,
    enabled: false,
    masterVolume: 1.0,

    // Backend Mode
    useHTML5: false, // Fallback flag if WebAudio fetch fails

    // Web Audio API Nodes
    bgmGainNode: null,
    seGainNode: null,

    // BGM Management
    bgmBuffers: {},   // { key: AudioBuffer } (WebAudio)
    bgmObjects: {},   // { key: Audio } (HTML5 Fallback)
    currentBgmSource: null, // WebAudio Source
    currentBgmKey: null,
    _loadingKeys: {},

    // SE Pooling (HTML5 Audio for simplicity & compatibility)
    SES: {
        CLICK: { url: 'sounds/click.wav', poolSize: 5, pool: [] },
        BUY: { url: 'sounds/buy.wav', poolSize: 5, pool: [] },
        SHOOT: { url: 'sounds/shoot.wav', poolSize: 10, pool: [] },
        HIT: { url: 'sounds/hit.wav', poolSize: 10, pool: [] },
        MISSILE: { url: 'sounds/missile.wav', poolSize: 5, pool: [] },
        EXPLOSION: { url: 'sounds/explosion.wav', poolSize: 10, pool: [] },
        COLLECT: { url: 'sounds/collect.wav', poolSize: 10, pool: [] },
        ERROR: { url: 'sounds/error.wav', poolSize: 3, pool: [] },
        UPGRADE: { url: 'sounds/upgrade.wav', poolSize: 3, pool: [] },
        PLACE: { url: 'sounds/click.wav', poolSize: 5, pool: [] },
        SELL: { url: 'sounds/buy.wav', poolSize: 5, pool: [] }
    },

    BGM_PATHS: {
        OUTGAME: 'sounds/Shooter_OutgameA.mp3',
        INGAME_A: 'sounds/Shooter_IngameA.mp3',
        INGAME_B: 'sounds/Shooter_IngameB.mp3'
    },

    init() {
        if (this.ctx) return;
        const initAudio = () => {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.enabled = true;

                // Master Gain Setup
                this.bgmGainNode = this.ctx.createGain();
                this.bgmGainNode.connect(this.ctx.destination);
                this.bgmGainNode.gain.value = this.masterVolume * 0.5;

                console.log("[SoundManager] Web Audio API Initialized");

                this.initPools(); // SE Pools

                // Start loading all BGMs
                this.loadAllBGM();
            }
        };
        window.addEventListener('click', initAudio, { once: true });
        window.addEventListener('keydown', initAudio, { once: true });
    },

    async loadAllBGM() {
        console.log("[SoundManager] Start loading all BGMs...");
        Object.keys(this.BGM_PATHS).forEach(key => this.loadBGM(key));
    },

    async loadBGM(key) {
        if (this.bgmBuffers[key] || (this.useHTML5 && this.bgmObjects[key])) return;

        if (this._loadingKeys[key]) return;
        this._loadingKeys[key] = true;

        const url = this.BGM_PATHS[key];

        // Force HTML5 on local file system to avoid CORS/Fetch errors
        if (window.location.protocol === 'file:') {
            this.useHTML5 = true;
        }

        if (this.useHTML5) {
            this._loadHTML5(key, url);
            this._loadingKeys[key] = false;
            return;
        }

        try {
            console.log(`[SoundManager] Fetching BGM: ${key}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.bgmBuffers[key] = audioBuffer;
            console.log(`[SoundManager] BGM Decoded (WebAudio): ${key}`);

            if (this.currentBgmKey === key) this.playBGM(key, true);

        } catch (e) {
            console.warn(`[SoundManager] WebAudio Fetch failed (${e.message}). Switching to HTML5 Audio Fallback.`);
            this.useHTML5 = true;
            this._loadHTML5(key, url);
        } finally {
            this._loadingKeys[key] = false;
        }
    },

    _loadHTML5(key, url) {
        if (this.bgmObjects[key]) return;
        console.log(`[SoundManager] Loading BGM (HTML5): ${key}`);
        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = this.masterVolume * 0.5;
        // Important: Preload to avoid delay
        audio.preload = 'auto';
        this.bgmObjects[key] = audio;

        if (this.currentBgmKey === key) this.playBGM(key, true);
    },

    initPools() {
        Object.keys(this.SES).forEach(key => {
            const se = this.SES[key];
            if (!se.url) return;
            se.pool = [];
            for (let i = 0; i < (se.poolSize || 3); i++) {
                const audio = new Audio(se.url);
                audio.volume = this.masterVolume * 0.4;
                audio.preload = 'auto';
                se.pool.push(audio);
            }
        });
        console.log("Audio Pools Initialized");
    },

    setMasterVolume(val) {
        this.masterVolume = val;
        // Update WebAudio Gain
        if (this.bgmGainNode) {
            this.bgmGainNode.gain.setTargetAtTime(val * 0.5, this.ctx.currentTime, 0.1);
        }
        // Update HTML5 BGM
        Object.values(this.bgmObjects).forEach(a => { if (!a.paused) a.volume = val * 0.5; });
        // Update HTML5 SE Pools
        Object.values(this.SES).forEach(se => {
            se.pool.forEach(a => a.volume = val * 0.4);
        });
    },

    playBGM(key, force = false) {
        if (!this.enabled) {
            this.currentBgmKey = key;
            return;
        }

        // Resume context
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();

        if (!force && this.currentBgmKey === key && (this.currentBgmSource || (this.useHTML5 && this.bgmObjects[key] && !this.bgmObjects[key].paused))) return;

        const oldKey = this.currentBgmKey;
        this.currentBgmKey = key;

        // Stop Old
        this.stopBGM();

        if (this.useHTML5) {
            // HTML5 Playback
            const audio = this.bgmObjects[key];
            if (audio) {
                audio.currentTime = 0;
                audio.volume = this.masterVolume * 0.5;
                audio.play().catch(e => console.warn("HTML5 Play failed:", e));
                console.log(`[SoundManager] Playing BGM (HTML5): ${key}`);
            } else {
                console.log(`[SoundManager] BGM ${key} not ready (HTML5), loading...`);
                this.loadBGM(key); // Lazy load
            }
        } else {
            // WebAudio Playback
            const buffer = this.bgmBuffers[key];
            if (!buffer) {
                console.log(`[SoundManager] BGM ${key} not ready (WebAudio), loading...`);
                this.loadBGM(key); // Lazy load
                return;
            }
            try {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                source.connect(this.bgmGainNode);
                source.start(0);
                this.currentBgmSource = source;
                console.log(`[SoundManager] Playing BGM (WebAudio): ${key}`);

                // Fade In
                this.bgmGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                this.bgmGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
                this.bgmGainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.5, this.ctx.currentTime + 1.0);
            } catch (e) {
                console.error("WebAudio Play failed:", e);
                // Fallback catch if WebAudio fails mid-flight?
            }
        }
    },

    stopBGM() {
        // Stop WebAudio
        if (this.currentBgmSource) {
            try { this.currentBgmSource.stop(this.ctx.currentTime + 0.1); } catch (e) { }
            this.currentBgmSource = null;
        }

        // Stop HTML5 (Pause all)
        Object.values(this.bgmObjects).forEach(a => {
            if (!a.paused) {
                a.pause();
                a.currentTime = 0;
            }
        });
    },

    toggleMute() {
        const newVol = this.masterVolume > 0 ? 0 : 1.0;
        this.setMasterVolume(newVol);
        return newVol > 0;
    },

    play(key) {
        if (!this.enabled || this.masterVolume <= 0) return;
        const se = this.SES[key];
        if (!se || !se.pool) return;

        let audio = se.pool.find(a => a.paused);
        if (!audio) {
            // Ring buffer strategy: reuse first one if valid
            if (se.pool.length > 0) {
                audio = se.pool[0];
                audio.currentTime = 0;
            }
        }
        if (audio) {
            audio.volume = this.masterVolume * 0.4;
            audio.play().catch(e => { });
        }
    }
};

window.SoundManager.init();
