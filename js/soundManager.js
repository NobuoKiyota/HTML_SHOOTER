/**
 * SoundManager - ゲームの音響管理クラス
 * Web Audio API (SE用) と HTML5 Audio (BGM用) を併用。
 */
const SoundManager = {
    ctx: null,
    enabled: false,
    masterVolume: 1.0,

    // BGM管理
    bgmPlayers: {}, // { key: Audio }
    currentBgmKey: null,
    outgameTime: 0, // アウトゲームの再生位置記憶

    // 効果音定義
    SES: {
        CLICK: { pitch: 880, dur: 0.1, type: 'sine', url: 'sounds/click.wav' },
        BUY: { pitch: 1320, dur: 0.3, type: 'triangle', url: 'sounds/buy.wav' },
        SHOOT: { pitch: 440, dur: 0.05, type: 'square', url: 'sounds/shoot.wav' },
        MISSILE: { pitch: 220, dur: 0.2, type: 'sawtooth', url: 'sounds/missile.wav' },
        EXPLOSION: { pitch: 100, dur: 0.4, type: 'sawtooth', url: 'sounds/explosion.wav' },
        COLLECT: { pitch: 1760, dur: 0.15, type: 'sine', url: 'sounds/collect.wav' },
        ERROR: { pitch: 220, dur: 0.3, type: 'sine', url: 'sounds/error.wav' }
    },

    // BGMパス定義
    BGM_PATHS: {
        OUTGAME: 'sounds/Shooter_OutgameA.mp3',
        INGAME_A: 'sounds/Shooter_IngameA.mp3', // ★1-2用
        INGAME_B: 'sounds/Shooter_IngameB.mp3'  // ★3以上用
    },

    init() {
        if (this.ctx) return;
        const initAudio = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.enabled = true;
                console.log("AudioContext Initialized");
                if (this.currentBgmKey) this.playBGM(this.currentBgmKey, true);
            }
        };
        window.addEventListener('click', initAudio, { once: true });
        window.addEventListener('keydown', initAudio, { once: true });
    },

    setMasterVolume(val) {
        this.masterVolume = val;
        // 再生中のすべてのBGMの音量を更新
        Object.values(this.bgmPlayers).forEach(p => {
            if (!p.paused) p.volume = val * 0.5;
        });
    },

    toggleMute() {
        const newVol = this.masterVolume > 0 ? 0 : 1.0;
        this.setMasterVolume(newVol);
        return newVol > 0;
    },

    /**
     * BGM再生 (フェード対応)
     * @param {string} key 'OUTGAME' | 'INGAME_A' | 'INGAME_B'
     * @param {boolean} force 再生を強制するか（初期化用）
     */
    async playBGM(key, force = false) {
        if (!force && this.currentBgmKey === key && this.bgmPlayers[key] && !this.bgmPlayers[key].paused) return;

        const oldKey = this.currentBgmKey;
        const oldPlayer = this.bgmPlayers[oldKey];

        // 旧BGMのフェードアウト
        if (oldPlayer && oldKey !== key) {
            this.fadeOut(oldPlayer, oldKey === 'OUTGAME');
        }

        this.currentBgmKey = key;
        if (!this.enabled) return;

        let player = this.bgmPlayers[key];
        if (!player) {
            player = new Audio(this.BGM_PATHS[key]);
            player.loop = true;
            this.bgmPlayers[key] = player;
        }

        if (player.paused || force) {
            player.volume = 0;
            // アウトゲームの場合は記憶位置から再開
            if (key === 'OUTGAME' && this.outgameTime > 0) {
                player.currentTime = this.outgameTime;
            }

            try {
                await player.play();
                this.fadeIn(player);
            } catch (e) {
                console.warn("BGM Play blocked:", e);
            }
        }
    },

    fadeIn(audio) {
        let vol = 0;
        const target = this.masterVolume * 0.5;
        const interval = setInterval(() => {
            if (!audio || audio.paused) { clearInterval(interval); return; }
            vol += 0.05;
            if (vol >= target) {
                audio.volume = target;
                clearInterval(interval);
            } else {
                audio.volume = vol;
            }
        }, 50);
    },

    fadeOut(audio, isOutgame = false) {
        if (!audio || audio.paused) return;
        let vol = audio.volume;
        const interval = setInterval(() => {
            vol -= 0.05;
            if (vol <= 0) {
                audio.volume = 0;
                if (isOutgame) {
                    this.outgameTime = audio.currentTime; // 位置を記憶
                } else {
                    audio.currentTime = 0;
                }
                audio.pause();
                clearInterval(interval);
            } else {
                audio.volume = vol;
            }
        }, 50);
    },

    play(key) {
        if (!this.enabled || this.masterVolume <= 0) return;
        const se = this.SES[key];
        if (!se) return;

        // WAVファイルを再生
        if (se.url) {
            const audio = new Audio(se.url);
            audio.volume = this.masterVolume * 0.4;
            audio.play().catch(e => {
                // ファイルがない場合はシンセ音をフォールバックに（任意）
                // this.playSynth(se);
                console.warn("SE Play failed:", se.url);
            });
        }
    }
};

SoundManager.init();
