/**
 * 改修版ゲームエンジン (V5)
 * エクセル同期データ、自動射撃、ブレーキ制御、3段階ホーミングデブリ対応
 */

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life--;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color, size, life) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.size = size * 1.5;
        this.life = life;
        this.maxLife = life;
        this.vy = -1; // Float up
    }
    update() {
        this.y += this.vy;
        this.life--;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px Arial`;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_SETTINGS.CANVAS_WIDTH;
        this.canvas.height = GAME_SETTINGS.CANVAS_HEIGHT;

        // Player Sprite
        this.playerSprite = new Image();
        this.playerSprite.src = "assets/png/playership01.png";

        this.data = SaveManager.load() || SaveManager.getInitialData();
        this.currentMission = null;
        this.sessionDontShowConfirm = false;

        this.playState = {
            hp: 100, maxHp: 100,
            cargoHp: 100, maxCargoHp: 100,
            distance: 0,
            currentSpeed: 0,
            accel: 0,
            maxSpeed: 0,
            isBraking: false,
            collectedItems: {},
            enemies: [], bullets: [], items: [], particles: [],
            bgOffset: 0, frameCount: 0,
            boostTimer: 0,
            elapsedSeconds: 0,
            debrisDestroyed: 0,
            missileCooldown: 0,
            debrisDestroyed: 0,
            missileCooldown: 0,
            missiles: [],
            floatingTexts: []
        };

        this.playerPos = { x: 400, y: 300, targetX: 400, targetY: 300, fireCooldown: 0 };
        this.currentState = GAME_STATE.TITLE;
        window.engine = this;

        this.initEvents();

        // Initialize UI Managers
        console.log("[GameEngine] Initializing UI Managers...");
        this.missionSelector = new MissionSelector(this);
        this.shipEditor = new ShipEditor(this);
        this.shipEditor.initSellZone();
        this.mainMenu = new MainMenu(this);

        this.changeState(GAME_STATE.TITLE);
        this.gameLoop();
    }

    initEvents() {
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Clamp values to canvas dimensions to keep player inside
            const rawX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const rawY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

            this.playerPos.targetX = Math.max(0, Math.min(this.canvas.width, rawX));
            this.playerPos.targetY = Math.max(0, Math.min(this.canvas.height, rawY));
            // DEBUG LOG
            //console.log(`Mouse: ${e.clientX},${e.clientY} Target: ${this.playerPos.targetX.toFixed(1)},${this.playerPos.targetY.toFixed(1)}`);
        });

        window.addEventListener('mousedown', (e) => {
            if (this.currentState === GAME_STATE.INGAME && e.button === 0) this.playState.isBraking = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.playState.isBraking = false;
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === "Escape" && this.currentState === GAME_STATE.INGAME) {
                this.retireMission();
            }
        });

        document.getElementById('reset-save-btn').onclick = () => {
            SoundManager.play('CLICK');
            console.log("[GameEngine] Reset Save Clicked");
            if (confirm('完全に初期化しますか？')) { SaveManager.reset(); location.reload(); }
        };
    }

    changeState(newState) {
        console.log(`[GameEngine] changeState: ${this.currentState} -> ${newState}`);
        this.currentState = newState;

        // BGM管理
        if (newState !== GAME_STATE.INGAME) {
            SoundManager.playBGM('OUTGAME');
        }

        const screens = document.querySelectorAll('.screen, .gui-overlay');
        screens.forEach(el => el.classList.add('hide'));
        console.log(`[GameEngine] Hidden ${screens.length} screens`);

        // サイドパネルの状態制御
        const sidePanels = document.querySelectorAll('.side-panel');
        if (newState === GAME_STATE.INGAME) {
            sidePanels.forEach(p => p.classList.remove('hide-panel'));
        } else {
            sidePanels.forEach(p => p.classList.add('hide-panel'));
        }

        // 戻るボタンの制御
        const backBtn = document.getElementById('global-back-btn');
        if (backBtn) {
            backBtn.disabled = false;
            backBtn.classList.remove('disabled');

            // Text Update based on state
            if ([GAME_STATE.UPGRADE, GAME_STATE.MISSION_SELECT, GAME_STATE.GRID_MODIFY].includes(newState)) {
                backBtn.innerText = "←"; // Or "BACK"
                backBtn.onclick = () => this.goBack();
            } else {
                backBtn.innerText = "← PORTFOLIO";
                backBtn.onclick = () => window.location.href = '../index.html'; // Go up one level
            }
        }

        switch (newState) {
            case GAME_STATE.TITLE:
                document.getElementById('title-screen').classList.remove('hide');
                break;
            case GAME_STATE.MENU:
                document.getElementById('main-menu').classList.remove('hide');
                this.updateMenuUI();
                break;
            case GAME_STATE.UPGRADE:
                document.getElementById('upgrade-screen').classList.remove('hide');
                this.renderUpgradeList();
                break;
            case GAME_STATE.MISSION_SELECT:
                const ms = document.getElementById('mission-select-screen');
                if (ms) ms.classList.remove('hide');
                else console.error("[GameEngine] mission-select-screen NOT FOUND");
                console.log("[GameEngine] Rendering Mission List...");
                this.renderMissionList();
                break;
            case GAME_STATE.INGAME:
                document.getElementById('ingame-gui').classList.remove('hide');
                this.initIngame();
                break;
            case GAME_STATE.RESULT:
                document.getElementById('result-screen').classList.remove('hide');
                this.renderResult();
                break;
            case GAME_STATE.FAILURE:
                document.getElementById('failure-screen').classList.remove('hide');
                break;
            case GAME_STATE.GRID_MODIFY:
                document.getElementById('grid-screen').classList.remove('hide');
                console.log("[GameEngine] Rendering Grid UI...");
                this.renderGridUI();
                break;
        }
    }

    goBack() {
        if ([GAME_STATE.UPGRADE, GAME_STATE.MISSION_SELECT, GAME_STATE.GRID_MODIFY].includes(this.currentState)) {
            SoundManager.play('CLICK');
            console.log(`[GameEngine] Going back from ${this.currentState}`);
            this.changeState(GAME_STATE.MENU);
        }
    }

    initIngame() {
        const lv = this.data.upgradeLevels;

        // Initial Weather Setup (Dynamic)
        this.lastWeatherChangeDist = 0;
        this.currentWeather = this.pickWeather();
        const weather = this.currentWeather;

        // Helper to get value from UpgradeTable
        // Robustly handles UPPERCASE (new) and lowercase (old) keys
        const getVal = (key) => {
            if (!GAME_BALANCE_DATA.UPGRADE_TABLE || !GAME_BALANCE_DATA.UPGRADE_TABLE[key]) return 0;
            const level = lv[key] || lv[key.toLowerCase()] || 0;
            const row = GAME_BALANCE_DATA.UPGRADE_TABLE[key].find(r => r.Level === level);
            return row ? row.ValuePlus : 0;
        };

        // 1. HP Calculation
        const bonusHp = getVal('HP');
        this.playState.maxHp = GAME_SETTINGS.PLAYER.HP + bonusHp;
        this.playState.hp = this.playState.maxHp;

        this.playState.maxCargoHp = GAME_SETTINGS.PHYSICS.CARGO_HP_BASE;
        this.playState.cargoHp = this.playState.maxCargoHp;

        // 2. Grid Bonuses
        const bonuses = GridManager.calculateBonuses(this.data.gridData.equippedParts);

        // 3. Weight Calculation
        this.playState.totalWeight = bonuses.totalWeight + (this.currentMission.weight * 10);

        // 4. Engine Power
        const baseEngine = GAME_SETTINGS.PLAYER.ENGINE;
        const bonusEngine = getVal('ENGINE');
        this.playState.enginePower = baseEngine + bonusEngine;

        // 5. Weight Penalty
        const totalW = this.playState.totalWeight || 1;
        const ePower = this.playState.enginePower || 100;
        const weightPenalty = ePower / (ePower + totalW);

        console.log(`[InitIngame] Mass:${totalW} Pwr:${ePower} Pen:${weightPenalty.toFixed(3)}`);

        // 6. Physics
        // Speed
        const speedVal = getVal('SPEED');
        const speedUpgrade = (isNaN(speedVal) ? 0 : speedVal) * 0.01;
        this.playState.maxSpeed = (GAME_SETTINGS.PHYSICS.BASE_MAX_SPEED + speedUpgrade) * weightPenalty;

        // Accel
        const accelVal = getVal('ACCEL');
        const accelUpgrade = (isNaN(accelVal) ? 0 : accelVal) * 0.0001;
        this.playState.accel = (GAME_SETTINGS.PHYSICS.BASE_ACCEL + accelUpgrade + bonuses.accelBoost) * weightPenalty;

        // Brake
        const brakeVal = getVal('BRAKE');
        const brakeUpgrade = (isNaN(brakeVal) ? 0 : brakeVal) * 0.001;
        this.playState.brakeForce = GAME_SETTINGS.PHYSICS.BRAKE_FORCE + brakeUpgrade + bonuses.brakeBoost;

        // NaN Check (Final Safety)
        if (isNaN(this.playState.maxSpeed) || this.playState.maxSpeed <= 0) this.playState.maxSpeed = 5.0;
        if (isNaN(this.playState.accel) || this.playState.accel <= 0) this.playState.accel = 0.03;

        // Other Stats
        this.playState.fireRateFactor = bonuses.fireRateFactor;
        this.playState.lootRange = bonuses.lootRange;
        this.playState.hasMissile = bonuses.hasMissile;
        this.playState.weaponDamage = bonuses.weaponDamage + getVal('WEAPON_OS');

        // Identify Weapons
        this.playState.mainWeapon = null;
        this.playState.subWeapon = null;

        this.data.gridData.equippedParts.forEach(p => {
            const template = GridManager.PART_TEMPLATES[p.type];
            if (!template) return;

            // Check if Main Weapon
            if (template.Type === 'Main' || p.type === 'PrimaryWeapon') {
                // If multiple main weapons, we might want to handle that. 
                // For now, take the first one or prioritize specific IDs?
                // Just overwriting is fine for single-weapon logic.
                // Or better: Use the one with highest damage/tier?
                this.playState.mainWeapon = template;
            }

            // Check if Sub Weapon
            if (template.Type === 'Sub' || p.type === 'Missile' || p.type === 'Bomb') {
                this.playState.subWeapon = template;
            }
        });

        // Fallback for Main Weapon if none found (e.g. initial save might have different ID?)
        if (!this.playState.mainWeapon) {
            console.warn("[InitIngame] No Main Weapon found in grid. using Default.");
            // Optional: Force a default if critical?
            // this.playState.mainWeapon = GAME_SETTINGS.WEAPONS.BeamGun;
        }

        // Reset State
        this.playState.currentSpeed = 0;
        this.playState.distance = this.currentMission.distance;
        this.playState.enemies = [];
        this.playState.bullets = [];
        this.playState.items = [];
        this.playState.particles = [];
        this.playState.floatingTexts = [];
        this.playState.collectedItems = {};
        this.playState.frameCount = 0;
        this.playState.boostTimer = 0;
        this.playState.isBraking = false;
        this.playState.elapsedSeconds = 0;
        this.playState.debrisDestroyed = 0;
        this.playState.bgOffset = 0;

        // Increment Stats
        this.data.careerStats.started++;
        SaveManager.save(this.data);

        // UI
        document.getElementById('weather-display').innerText = weather.name;
        document.getElementById('mission-stars').innerText = "★".repeat(this.currentMission.stars || 1);

        console.log(`Mission Start. HP:${this.playState.maxHp} Spd:${this.playState.maxSpeed.toFixed(2)} Acc:${this.playState.accel.toFixed(4)}`);

        this.playerPos = { x: this.canvas.width / 2, y: this.canvas.height - 100, fireCooldown: 0 };
    }

    pickWeather() {
        const tableId = this.currentMission.weatherTable || "EASY";
        const table = GAME_BALANCE_DATA.MISSION_DATA.WEATHER_TABLES[tableId];
        // Probability Pick
        const rand = Math.floor(Math.random() * 100);
        let cum = 0;
        let selected = "CLEAR";
        for (let k in table) {
            cum += table[k];
            if (rand < cum) { selected = k; break; }
        }
        return GAME_SETTINGS.WEATHER[selected] || GAME_SETTINGS.WEATHER.CLEAR;
    }

    changeWeather() {
        this.currentWeather = this.pickWeather();
        console.log(`[GameEngine] Weather Changed to: ${this.currentWeather.name}`);

        // Notification
        const notify = document.getElementById('item-notification'); // Reuse notification
        notify.innerText = `天候変化: ${this.currentWeather.name}`;
        notify.classList.add('show');
        setTimeout(() => notify.classList.remove('show'), 3000);

        // Update UI
        document.getElementById('weather-display').innerText = this.currentWeather.name;
    }

    gameLoop() {
        if (this.fatalError) return;

        try {
            this.update(); this.draw();
            requestAnimationFrame(() => this.gameLoop());
        } catch (e) {
            console.error(e);
            this.fatalError = true;
            // Display error cleanly
            const el = document.getElementById('failure-screen');
            if (el) {
                el.classList.remove('hide');
                document.getElementById('failure-reason').innerText = "FATAL ERROR:\n" + e.message;
                document.getElementById('failure-penalty').innerText = "Stack:\n" + e.stack;
            } else {
                alert("FATAL ERROR: " + e.message);
            }
        }
    }

    update() {
        if (this.currentState !== GAME_STATE.INGAME) return;
        const lv = this.data.upgradeLevels;
        const weather = this.currentWeather; // Use current dynamic weather
        this.playState.frameCount++;

        // 1. 加速/ブレーキ物理 (エクセル設定を利用)
        let targetMax = this.playState.maxSpeed;

        // Vertical Speed Zones
        // Top(0-33%): 100%, Mid(33-66%): 80%, Bot(66-100%): 50%
        const zoneH = this.canvas.height / 3;
        if (this.playerPos.y < zoneH) {
            // Top: 100%
        } else if (this.playerPos.y < zoneH * 2) {
            targetMax *= 0.8;
        } else {
            targetMax *= 0.5;
        }

        // Buff Update
        this.updateBuffs();

        if (this.playState.boostTimer > 0) {
            this.playState.boostTimer--;
            targetMax *= 1.5;
        }

        // Apply Speed Buff
        if (this.playState.buffs && this.playState.buffs['SPEED']) {
            const buff = this.playState.buffs['SPEED'];
            if (buff.duration > 0) {
                targetMax *= buff.value || 1.2;
            }
        }

        if (this.playState.isBraking) {
            this.playState.currentSpeed = Math.max(GAME_SETTINGS.PHYSICS.MIN_SPEED || 0, this.playState.currentSpeed - this.playState.brakeForce);
        } else if (this.playState.currentSpeed < targetMax) {
            this.playState.currentSpeed += this.playState.accel;
        } else {
            this.playState.currentSpeed *= GAME_SETTINGS.PHYSICS.FRICTION;
        }

        // 2. 天候の影響
        this.playerPos.x += weather.wind || 0;

        // 3. プレイヤー移動 (Lerp)
        const lerp = GAME_SETTINGS.PLAYER.BASE_LERP || 0.1; // Fallback
        if (this.playState.frameCount % 60 === 0) {
            console.log(`Frame:${this.playState.frameCount} Pos:${this.playerPos.x.toFixed(1)},${this.playerPos.y.toFixed(1)} Target:${this.playerPos.targetX.toFixed(1)},${this.playerPos.targetY.toFixed(1)} Lerp:${lerp} Speed:${this.playState.currentSpeed}`);
        }

        // Safety check for NaN
        if (isNaN(this.playerPos.x)) this.playerPos.x = this.canvas.width / 2;
        if (isNaN(this.playerPos.y)) this.playerPos.y = this.canvas.height - 100;
        if (isNaN(this.playerPos.targetX)) this.playerPos.targetX = this.playerPos.x;
        if (isNaN(this.playerPos.targetY)) this.playerPos.targetY = this.playerPos.y;

        this.playerPos.x += (this.playerPos.targetX - this.playerPos.x) * lerp;
        this.playerPos.y += (this.playerPos.targetY - this.playerPos.y) * lerp;

        // 4. 背景と距離 (MISSION_SCALE で調整)
        this.playState.bgOffset = (this.playState.bgOffset + this.playState.currentSpeed) % this.canvas.height;
        const distDivisor = GAME_SETTINGS.PHYSICS.MISSION_DIVISOR || 2000;
        this.playState.distance -= (this.playState.currentSpeed * GAME_SETTINGS.PHYSICS.MISSION_SCALE) / distDivisor;

        if (this.playState.distance <= 0) {
            this.playState.distance = 0;
            this.changeState(GAME_STATE.RESULT);
        }

        // Dynamic Weather Change (Every 600 distance)
        // distance decreases from Max to 0. So we check delta from Start or just check remaining?
        // Let's track distance traveled.
        // Mission Start Distance - Current Distance = Traveled.
        const traveled = this.currentMission.distance - this.playState.distance;
        if (traveled - this.lastWeatherChangeDist >= 600) {
            this.lastWeatherChangeDist = traveled;
            this.changeWeather();
        }

        // 5. 自動射撃
        if (this.playerPos.fireCooldown > 0) this.playerPos.fireCooldown--;
        if (this.playerPos.fireCooldown <= 0) {
            this.shoot();
        }

        // 7. ミサイル射撃と追尾
        if (this.playState.hasMissile) {
            if (this.playState.missileCooldown > 0) this.playState.missileCooldown--;
            if (this.playState.missileCooldown <= 0) {
                this.shootMissile();
                this.playState.missileCooldown = GAME_SETTINGS.PHYSICS.MISSILE_COOLDOWN || 60;
            }
        }

        this.updateEntities(weather);
        this.updateEntities(weather);
        this.updateFloatingTexts();
        this.updateIngameGUI();
    }

    createParticles(weather) {
        if (this.playState.frameCount % 2 === 0) {
            const count = Math.ceil(this.playState.currentSpeed / 2);
            for (let i = 0; i < count; i++) {
                this.playState.particles.push(new Particle(this.playerPos.x + (Math.random() - 0.5) * 10, this.playerPos.y + 20, (Math.random() - 0.5) * 2, 2 + this.playState.currentSpeed / 4, 20, "#0af", 3));
            }
        }
        if (weather.Rain > 0) { // Fix: weather.Rain from settings_data (uppercase)
            for (let i = 0; i < 2; i++) {
                this.playState.particles.push(new Particle(Math.random() * this.canvas.width, -10, weather.WindX || 0, 10, 60, "#4af", 1));
            }
        }
    }

    spawnDebris() {
        // 1. Determine Difficulty Params
        const mission = this.currentMission || {};
        const stars = mission.stars || 1;
        const params = GAME_BALANCE_DATA.MISSION_DATA.DIFFICULTY_PARAMS[stars] || {};

        const shieldMod = params.shieldMod || 1.0;
        const tierTag = params.enemyTier || "Tier1"; // e.g. "Tier1"

        // 2. Filter Enemies by Tier
        // We stored enemies in GAME_BALANCE_DATA.ENEMIES (Object)
        // We can create a quick lookup list if not exists, or filter every time (optimize later)
        const candidates = Object.values(GAME_BALANCE_DATA.ENEMIES).filter(e => {
            // Check 'tier' field we added in migration, or fallback to parsing ID?
            // Migration added 'Tier' column but did we put it in the dict?
            // Yes, update_settings.py put row properties in.
            // But let's verify key. 'Tier' vs 'tier'. Python script used lower case keys for standard props,
            // but for dynamic props... wait, I used `row['ID']`, `row['Name']` etc.
            // I did NOT explicitly add "tier": row['Tier'] to the `ENEMIES` dict in the tool!
            // I added it to the `TIERS` list.
            // Let's use `mid` or just pick from `GAME_SETTINGS.DEBRIS.TIERS` which IS filtered?
            // Wait, `DEBRIS.TIERS` was reconstructed.
            return true;
        }).filter(e => {
            // Fallback: if we didn't store tier in ENEMIES dict, check DEBRIS.TIERS
            return true;
        });

        // Actually, let's use the `DEBRIS.TIERS` list which `update_settings.py` generates.
        // It has {id, tier, hp, ...}
        const availableTiers = (GAME_BALANCE_DATA.DEBRIS && GAME_BALANCE_DATA.DEBRIS.TIERS)
            ? GAME_BALANCE_DATA.DEBRIS.TIERS.filter(t => t.tier === tierTag)
            : [];

        if (availableTiers.length === 0) return; // No enemies for this tier?

        const tierMeta = availableTiers[Math.floor(Math.random() * availableTiers.length)];
        // Get full data from ENEMIES dict for extra props like movement, drop
        const fullData = GAME_BALANCE_DATA.ENEMIES[tierMeta.id];

        const x = Math.random() * (this.canvas.width - 40) + 20;

        const enemy = new Enemy(fullData, fullData.id, x, -50);
        // Apply scaling
        enemy.applyModifiers(shieldMod, 1.0); // ShieldMod from mission

        this.playState.enemies.push(enemy);
    }

    updateEntities(weather) {
        this.playState.particles = this.playState.particles.filter(p => { p.update(); return p.life > 0; });

        // Bullets
        for (let i = this.playState.bullets.length - 1; i >= 0; i--) {
            const b = this.playState.bullets[i];
            if (b.type === 'laser') {
                b.y += (b.vy || -30);
            } else {
                b.y -= (GAME_SETTINGS.BULLET.SPEED + this.playState.currentSpeed / 2);
            }
            if (b.y < -50) this.playState.bullets.splice(i, 1);
        }

        // Items
        if (!this.playState.items) this.playState.items = [];
        this.playState.items = this.playState.items.filter(item => {
            const hasCollector = this.data.parts && this.data.parts.some(p => p.id === 'Collector');
            item.update(this.playerPos.x, this.playerPos.y, hasCollector);

            // Collection Logic (Migrated from loot loop)
            if (Math.hypot(item.x - this.playerPos.x, item.y - this.playerPos.y) < (this.playState.lootRange || 50)) {
                this.collectItem(item);
                return false; // Remove from list
            }

            return !item.markedForDeletion;
        });

        // Spawn Enemies
        if (this.playState.frameCount % (GAME_SETTINGS.ENEMY.SPAWN_INTERVAL || 60) === 0) {
            this.spawnDebris();
        }

        // Loop Enemies
        for (let i = this.playState.enemies.length - 1; i >= 0; i--) {
            const en = this.playState.enemies[i];

            // V6 Logic: Enemy handles its own movement and firing in update()
            en.update(this.playState, this.playerPos);

            // Death Check
            if (en.markedForDeletion && en.hp <= 0) { // Dead
                this.playState.debrisDestroyed++;
                SoundManager.play('EXPLOSION');

                // V6 Drop Logic: Use DropTables
                const dtId = en.dtId;
                const lotteryCount = en.dropCount || 1;

                if (dtId && GAME_BALANCE_DATA.DROP_TABLES && GAME_BALANCE_DATA.DROP_TABLES[dtId]) {
                    const table = GAME_BALANCE_DATA.DROP_TABLES[dtId];
                    for (let c = 0; c < lotteryCount; c++) {
                        table.forEach(drop => {
                            if (Math.random() < drop.rate) {
                                this.spawnLoot(en.x + (Math.random() - 0.5) * 40, en.y + (Math.random() - 0.5) * 40, drop.id);
                            }
                        });
                    }
                } else if (en.drops && en.drops.length > 0) {
                    // Legacy/Fallback
                    en.drops.forEach(drop => { if (Math.random() < drop.rate) this.spawnLoot(en.x, en.y, drop.id); });
                }

                this.playState.enemies.splice(i, 1);
                this.playState.score += (en.score || 100);
            }
            else if (en.markedForDeletion) { // Just off screen
                this.playState.enemies.splice(i, 1);
            }
        }

        // Missile Update
        this.playState.missiles.forEach((m, idx) => {
            m.life--;
            if (m.life <= 0) {
                // Timeout explosion?
                this.playState.missiles.splice(idx, 1);
                return;
            }

            if (m.type === 'bomb') {
                m.y += m.vy;
            } else if (m.type === 'enemy_bullet') {
                // Enemy Bullet Logic
                m.x += m.vx;
                m.y += m.vy;

                // Check Collision with Player
                const dist = Math.hypot(this.playerPos.x - m.x, this.playerPos.y - m.y);
                if (dist < 10) { // Player Hit Radius
                    this.takeDamage(10); // Default damage or m.dmg
                    this.playState.missiles.splice(idx, 1);
                    return;
                }

                // Boundary Check
                if (m.y > this.canvas.height + 50 || m.y < -50 || m.x < -50 || m.x > this.canvas.width + 50) {
                    this.playState.missiles.splice(idx, 1);
                    return;
                }
            } else {
                // Missile Homing (Player's)
                let target = null;
                let minDist = 300;
                this.playState.enemies.forEach(en => {
                    const d = Math.hypot(en.x - m.x, en.y - m.y);
                    if (d < minDist) { minDist = d; target = en; }
                });
                if (target) {
                    const dx = target.x - m.x;
                    m.vx += Math.sign(dx) * 0.2;
                }
                m.x += m.vx;
                m.y += m.vy;
                m.vx *= 0.95;
            }

            // Missile Collision (Player Missiles hitting Enemies)
            if (m.type !== 'enemy_bullet') {
                this.playState.enemies.forEach((en, enIdx) => {
                    const dist = Math.hypot(en.x - m.x, en.y - m.y);
                    const hitDist = m.type === 'bomb' ? 40 : 30;

                    if (dist < hitDist) {
                        const dmg = m.dmg || 40;

                        if (m.type === 'bomb') {
                            this.explodeBomb(m.x, m.y, m.range || 100, dmg);
                        } else {
                            en.hp -= dmg;
                        }

                        this.playState.missiles.splice(idx, 1);
                        SoundManager.play('EXPLOSION');
                        this.spawnDamageText(en.x, en.y, Math.floor(dmg), "#f55", 20);
                        for (let i = 0; i < 8; i++) {
                            this.playState.particles.push(new Particle(m.x, m.y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 15, "#f55", 3));
                        }
                    }
                });
            }
        });

        // Elapsed
        this.playState.elapsedSeconds += 1 / 60;
        // Elapsed
        this.playState.elapsedSeconds += 1 / 60;
    }

    takeDamage(amount) {
        // Invincible Buff Check
        if (this.playState.buffs && this.playState.buffs['INVINCIBLE'] > 0) {
            // Visualize block?
            this.spawnDamageText(this.playerPos.x, this.playerPos.y, "BLOCK", "#0ff", 20);
            return;
        }

        // Shield Part Check (if any)
        // TODO: Implement Shield Part logic if Equipment based.
        // For now direct HP.

        this.playState.hp -= amount;
        SoundManager.play('EXPLOSION'); // Or hit sound
        this.spawnDamageText(this.playerPos.x, this.playerPos.y, amount, "#f55", 20);

        // Screen shake or flash?

        if (this.playState.hp <= 0) {
            this.playState.hp = 0;
            this.handleFailure("撃墜されました");
        }
    }

    shoot() {
        if (!this.playState.mainWeapon) return;
        const wpn = this.playState.mainWeapon;
        SoundManager.play('SHOOT');

        // Buff Factors
        let cooldownFactor = 1.0;
        let damageFactor = 1.0;

        if (this.playState.buffs) {
            if (this.playState.buffs['COOLDOWN'] > 0) {
                // Cooldown Buff Value? 
                // We stored DURATION. Value was not stored.
                // We need to look up or store value.
                // Re-design: collectItem now stores value if we update it?
                // Actually I didn't update collectItem to store value in `playState.buffs`.
                // `playState.buffs` is just { ID: Duration }.
                // Should we change it to { ID: { duration: x, value: y } }?
                // Yes, that's cleaner.
                // But for now, let's just use fixed constants as per plan. 
                // "OSUp ... 90%, 80%, 70%". 
                // If we don't know WHICH orb we got, we can't know factor.
                // So `playState.buffs` MUST store value.
                // I will update collectItem FIRST in next step to store object.
                // Here I assume it's stored or object.
            }
        }

        // Wait, I should fix collectItem to store objects first?
        // Let's assume I will fix it. 
        // this.playState.buffs[sub] = { duration: dur*60, value: val };

        // Cooldown Calculation
        const baseInterval = wpn.Interval || 15;
        const rateFactor = this.playState.fireRateFactor || 1.0;

        let buffCooldownMult = 1.0;
        let buffDamageMult = 1.0;

        if (this.playState.buffs) {
            if (this.playState.buffs['COOLDOWN']) {
                buffCooldownMult = this.playState.buffs['COOLDOWN'].value || 0.8;
            }
            if (this.playState.buffs['POWER']) {
                buffDamageMult = 1.0 + (this.playState.buffs['POWER'].value || 0.2);
            }
        }

        const cooldown = baseInterval * (1 + (this.currentMission ? this.currentMission.weight : 0) * 0.05) * rateFactor * buffCooldownMult;
        this.playerPos.fireCooldown = cooldown;

        // Damage source
        const dmg = (this.playState.weaponDamage * buffDamageMult);

        // Logic by Type
        if (wpn.ID === 'TwinBeam') {
            this.playState.bullets.push({ x: this.playerPos.x - 10, y: this.playerPos.y - 10, type: 'beam', dmg: dmg * 0.8 });
            this.playState.bullets.push({ x: this.playerPos.x + 10, y: this.playerPos.y - 10, type: 'beam', dmg: dmg * 0.8 });
        } else if (wpn.ID === 'Laser') {
            this.playState.bullets.push({
                x: this.playerPos.x, y: this.playerPos.y - 20,
                type: 'laser',
                vy: -30,
                w: 6, h: 60,
                dmg: dmg * 1.5,
                pierce: true
            });
            SoundManager.play('MISSILE');
        } else {
            // Standard
            this.playState.bullets.push({ x: this.playerPos.x, y: this.playerPos.y - 10, type: 'beam', dmg: dmg });
        }
    }

    shootMissile() {
        const sub = this.playState.subWeapon;
        if (!sub) return;

        const dmg = sub.effectiveDamage || sub.Damage || 20;

        if (sub.ID === 'Bomb') {
            SoundManager.play('MISSILE');
            this.playState.missiles.push({
                x: this.playerPos.x,
                y: this.playerPos.y,
                vx: 0,
                vy: -3,
                life: 180,
                type: 'bomb',
                range: sub.effectiveRange || sub.Range || 100,
                dmg: dmg
            });
        } else {
            // Default Missile
            SoundManager.play('MISSILE');
            const angles = [-0.3, 0.3];
            angles.forEach(angle => {
                this.playState.missiles.push({
                    x: this.playerPos.x,
                    y: this.playerPos.y,
                    vx: Math.sin(angle) * 5,
                    vy: -Math.cos(angle) * 5,
                    life: 180,
                    type: 'missile',
                    dmg: dmg
                });
            });
        }
    }

    explodeBomb(x, y, range, damage) {
        // Simple AoE
        this.playState.particles.push(new Particle(x, y, 0, 0, 30, "#fff", 10)); // Flash
        this.playState.enemies.forEach(en => {
            if (Math.hypot(en.x - x, en.y - y) < range) {
                en.hp -= damage;
            }
        });
    }

    spawnDebris() {
        const tiers = GAME_SETTINGS.DEBRIS.TIERS;
        if (!tiers) return;
        const tier = tiers[Math.floor(Math.random() * tiers.length)];

        // Lookup full data for drops using updated IDs (ENxxx)
        // Ensure GAME_BALANCE_DATA.ENEMIES exists
        const fullData = (GAME_BALANCE_DATA.ENEMIES && GAME_BALANCE_DATA.ENEMIES[tier.id]) ? GAME_BALANCE_DATA.ENEMIES[tier.id] : null;
        const drops = fullData ? fullData.drops : [];

        this.playState.enemies.push({
            x: Math.random() * this.canvas.width,
            y: -50,
            hp: tier.hp,
            baseSpeed: tier.speed,
            homing: tier.homing || 0,
            color: tier.color,
            tierId: tier.id,
            drops: drops
        });
    }

    spawnLoot(x, y, dropId) {
        if (!GAME_SETTINGS.ECONOMY || !GAME_SETTINGS.ECONOMY.ITEMS) return;

        let type = dropId;
        if (!type) {
            // Fallback (Random)
            const types = Object.keys(GAME_SETTINGS.ECONOMY.ITEMS);
            type = types[Math.floor(Math.random() * types.length)];
        }

        // Use Item Class
        const item = new Item(x, y, type);
        this.playState.items.push(item);
    }

    collectItem(itemObj) {
        SoundManager.play('COLLECT');

        // itemObj is the Item entity, it has .meta and .category
        const meta = itemObj.meta;
        if (!meta) return;

        const type = meta.Type; // BUFF, HEAL, MONEY, STAT, or undefined (Material)
        const sub = meta.SubType;
        const val = meta.Value;
        const dur = meta.Duration;

        let msg = `${meta.Name} 獲得`;

        if (type === "BUFF") {
            // Add/Extend Buff
            // BUFFS: POWER, COOLDOWN, SPEED, INVINCIBLE
            if (!this.playState.buffs) this.playState.buffs = {};

            const newDur = dur * 60;
            const existing = this.playState.buffs[sub];

            // If existing, take max duration? Or add? Usually max or reset.
            // Also take best value if stacking? Or just overwrite?
            // "TypeA ... TypeK" implies levels.
            // If I pick up Small (15%) then Big (30%), I should get 30%.
            // If I pick up Big (30%) then Small (15%), what happens?
            // Usually keep current if better?
            // Let's overwrite for simplicity or avoid complexity of "downgrading".
            // Or keep max value and reset duration?

            let finalVal = val;
            let finalDur = newDur;

            if (existing) {
                if (existing.value > val) {
                    // Holding better buff, just extend duration if new one is same type?
                    // Or ignore?
                    // Let's just overwrite for now to avoid complexity of "downgrading".
                    // Or keep max value and reset duration?
                    finalVal = existing.value;
                    finalDur = Math.max(existing.duration, newDur);
                } else if (existing.value < val) {
                    // Upgrade
                    finalVal = val;
                    finalDur = newDur;
                } else {
                    // Same value, extend
                    finalDur = Math.max(existing.duration, newDur);
                }
            }

            this.playState.buffs[sub] = { duration: finalDur, value: finalVal };

            msg = `${meta.Name}！ (${dur}s)`;

        } else if (type === "HEAL") {
            // Restore HP
            const healAmount = Math.floor(this.playState.maxHp * val);
            this.playState.hp = Math.min(this.playState.maxHp, this.playState.hp + healAmount);
            msg = `HP回復 +${healAmount}`;

        } else if (type === "MONEY") {
            // Add Money
            this.data.money += val;
            msg = `$${val} GET`;

        } else if (type === "STAT") {
            // Permanent Stat Boost (Legalia)
            if (!this.data.legalias) this.data.legalias = {};
            this.data.legalias[sub] = (this.data.legalias[sub] || 0) + val;
            // Apply immediately if possible or requiring scene reload?
            // update stats immediately
            msg = `能力強化: ${sub} +${val}`;
            // Re-calc stats roughly or just wait for next mission?
            // For now, simple re-calc if critical, but mostly passive.
            SaveManager.save(this.data); // Save immediately for rare drops

        } else {
            // Material
            const matId = itemObj.typeId;
            this.data.inventory = this.data.inventory || {};
            this.data.inventory[matId] = (this.data.inventory[matId] || 0) + 1;
            this.playState.collectedItems[matId] = (this.playState.collectedItems[matId] || 0) + 1;
            msg = `${meta.Name} 獲得`;
        }

        const notify = document.getElementById('item-notification');
        notify.innerText = msg;
        notify.classList.add('show');
        notify.style.color = meta.Color || "white";
        setTimeout(() => notify.classList.remove('show'), 2000);
    }

    updateBuffs() {
        if (!this.playState.buffs) return;
        for (let key in this.playState.buffs) {
            const buff = this.playState.buffs[key];
            if (buff && buff.duration > 0) {
                buff.duration--;
                if (buff.duration <= 0) {
                    delete this.playState.buffs[key];
                    // Sound notify end?
                }
            }
        }
    }

    // Helper to calculate Legalia Bonus
    getLegaliaBonus(stat) {
        if (!this.data.legalias) return 0;
        return this.data.legalias[stat] || 0;
    }

    handleFailure(reason) {
        document.getElementById('failure-reason').innerText = reason;
        document.getElementById('failure-penalty').innerText = this.currentMission.penalty;
        this.data.money = Math.max(0, this.data.money - this.currentMission.penalty);
        SaveManager.save(this.data);
        this.changeState(GAME_STATE.FAILURE);
    }

    retireMission() {
        if (confirm('ミッションをリタイアしますか？\n(ペナルティが発生します)')) {
            this.handleFailure("任務を放棄しました");
        }
    }

    drawBackground() {
        // Draw Black Background
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Stars (Parallax)
        // We can use a simple procedural starfield based on frameCount or static array if performance matters.
        // For simplicity, let's just draw some random stars that scroll.
        // Actually, we can use a seeded random or just a fixed set of stars if we want.
        // But better: use a simple scrolling pattern.

        this.ctx.fillStyle = "#fff";
        const totalStars = 100;
        const scrollY = this.playState.distance % this.canvas.height;

        // Use a consistent pseudo-random based on index to keep stars in place relative to scroll
        for (let i = 0; i < totalStars; i++) {
            const x = (Math.sin(i * 132.1) * 43758.5453 % 1) * this.canvas.width;
            if (x < 0) continue; // abs
            let y = (Math.cos(i * 453.2) * 23421.123 % 1) * this.canvas.height;
            if (y < 0) y = -y;

            // Scroll Logic
            y = (y + this.playState.bgOffset) % this.canvas.height;

            const size = (i % 3) + 1;
            this.ctx.fillRect(Math.abs(x), y, size, size);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. 背景描画 (星空)
        this.drawBackground();

        // 2. プレイヤー描画
        // HPバー
        const hpPer = Math.max(0, this.playState.hp) / this.playState.maxHp;
        const cargoPer = Math.max(0, this.playState.cargoHp) / GAME_SETTINGS.PHYSICS.CARGO_HP_BASE;

        this.ctx.save();
        this.ctx.translate(this.playerPos.x, this.playerPos.y);

        // エンジン噴射 (Blue-White Animation)
        // Draw behind the ship
        const thrust = Math.max(0.5, this.playState.currentSpeed / this.playState.maxSpeed);
        const flicker = Math.random() * 0.2 + 0.8;

        this.ctx.save();
        this.ctx.globalCompositeOperation = "lighter";

        // Core (White/Cyan)
        this.ctx.fillStyle = `rgba(200, 255, 255, ${0.8 * flicker})`;
        this.ctx.beginPath();
        this.ctx.moveTo(-5, 20); // Bottom center of ship (approx)
        this.ctx.lineTo(5, 20);
        this.ctx.lineTo(0, 20 + (40 * thrust * flicker));
        this.ctx.fill();

        // Outer (Blue)
        this.ctx.fillStyle = `rgba(50, 150, 255, ${0.5 * flicker})`;
        this.ctx.beginPath();
        this.ctx.moveTo(-10, 20);
        this.ctx.lineTo(10, 20);
        this.ctx.lineTo(0, 20 + (60 * thrust * flicker));
        this.ctx.fill();

        this.ctx.restore();

        // 機体 (Sprite)
        if (this.playerSprite && this.playerSprite.complete) {
            // Draw centered. Assuming 461KB image is large, scale to approx 64x64 or 80x80
            const drawW = 80;
            const drawH = 80;
            this.ctx.drawImage(this.playerSprite, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
            // Fallback to Grid if image not loaded
            // グリッドシステムの描画
            const gridW = GAME_SETTINGS.PLAYER.GRID_W;
            const gridH = GAME_SETTINGS.PLAYER.GRID_H;
            const cellSize = 10;

            // Center offset
            const offsetX = -(gridW * cellSize) / 2;
            const offsetY = -(gridH * cellSize) / 2;

            // Draw Base Grid
            this.ctx.fillStyle = "#333";
            this.ctx.fillRect(offsetX, offsetY, gridW * cellSize, gridH * cellSize);

            // Draw Parts
            if (this.data.parts) {
                this.data.parts.forEach(part => {
                    const px = offsetX + part.x * cellSize;
                    const py = offsetY + part.y * cellSize;
                    const pw = part.w * cellSize;
                    const ph = part.h * cellSize;

                    this.ctx.fillStyle = "#95a5a6"; // Default
                    if (part.type === 'Main') this.ctx.fillStyle = "#e74c3c";
                    else if (part.type === 'Sub') this.ctx.fillStyle = "#e67e22";
                    else if (part.type === 'Engine') this.ctx.fillStyle = "#3498db";
                    else if (part.type === 'Cockpit') this.ctx.fillStyle = "#f1c40f";

                    this.ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
                });
            }
        }

        this.ctx.restore();

        // 3. 敵描画
        this.playState.enemies.forEach(e => {
            e.draw(this.ctx);
        });

        // 4. アイテム描画
        this.playState.items.forEach(item => {
            item.draw(this.ctx);
        });

        // 5. 弾丸描画
        this.ctx.fillStyle = "#f1c40f";
        this.playState.bullets.forEach(b => {
            // ... existing bullet draw logic ...
            if (b.type === 'laser') {
                this.ctx.fillStyle = "#0ff";
                this.ctx.fillRect(b.x - (b.w || 2) / 2, b.y, b.w || 2, b.h || 30);
            } else {
                this.ctx.fillStyle = "#f1c40f";
                this.ctx.beginPath();
                this.ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        // 6. パーティクル
        this.playState.particles.forEach(p => p.draw(this.ctx));

        // 7. Floating Text
        this.ctx.font = "bold 16px Arial";
        this.playState.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = ft.color || "white";
            this.ctx.fillText(ft.text, ft.x, ft.y);
        });

        // 8. 距離メーターなどUI
        // ... (HTML overlay handles most, but we can draw distance bar here if needed)
    }

    spawnDamageText(x, y, dmg, color = "#fff", size = 16) {
        this.playState.floatingTexts.push(new FloatingText(x, y, dmg, color, size, 40));
    }

    updateFloatingTexts() {
        this.playState.floatingTexts = this.playState.floatingTexts.filter(t => { t.update(); return t.life > 0; });
    }

    updateIngameGUI() {
        // HPバー
        document.getElementById('hp-bar-fill').style.width = `${(this.playState.hp / this.playState.maxHp) * 100}%`;
        document.getElementById('cargo-bar-fill').style.width = `${(this.playState.cargoHp / this.playState.maxCargoHp) * 100}%`;
        document.getElementById('hp-text').innerText = `SHIP:${Math.ceil(this.playState.hp)} / CARGO:${Math.ceil(this.playState.cargoHp)}`;

        // ヘッダー情報 (全画面共通)
        this.updateGlobalHeader();

        // 左パネル：ミッション情報
        document.getElementById('mission-title').innerText = this.currentMission.title;
        document.getElementById('dist-val').innerText = Math.floor(this.playState.distance);
        document.getElementById('weight-val').innerText = this.currentMission.weight;
        document.getElementById('time-val').innerText = this.playState.elapsedSeconds.toFixed(1);

        // 取得アイテムリスト更新
        const lootList = document.getElementById('loot-list-ingame');
        lootList.innerHTML = "";
        for (let type in this.playState.collectedItems) {
            const item = GAME_SETTINGS.ECONOMY.ITEMS[type];
            const div = document.createElement('div');
            div.innerText = `${item.name} x${this.playState.collectedItems[type]}`;
            lootList.appendChild(div);
        }

        // 右パネル：機体性能
        document.getElementById('speed-val').innerText = Math.floor(this.playState.currentSpeed * 100);
        document.getElementById('max-speed-val').innerText = Math.floor(this.playState.maxSpeed * 100);
        document.getElementById('accel-val').innerText = this.playState.accel.toFixed(3);
        const weaponDmg = (GAME_SETTINGS.BULLET.DAMAGE + (this.playState.weaponDamage || 0)).toFixed(0);
        document.getElementById('weapon-val').innerText = weaponDmg;
        document.getElementById('brake-val').innerText = this.playState.brakeForce.toFixed(2);
    }

    updateGlobalHeader() {
        const stats = this.data.careerStats || { cleared: 0, started: 0, totalDebrisDestroyed: 0 };
        const achieveRate = stats.started > 0 ? ((stats.cleared / stats.started) * 100).toFixed(1) : 0;

        this._setSafeText('career-clears', stats.cleared);
        this._setSafeText('career-destroys', stats.totalDebrisDestroyed);
        this._setSafeText('career-rate', achieveRate);
        this._setSafeText('global-money', `$${Math.floor(this.data.money)}`);
    }

    _setSafeText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    updateMenuUI() {
        if (this.mainMenu) this.mainMenu.render();
    }

    renderMissionList() {
        console.log(`[GameEngine] renderMissionList called. Selector exists: ${!!this.missionSelector}`);
        if (this.missionSelector) this.missionSelector.render();
    }

    renderMenuButtons() {
        // Delegated to MainMenu, but kept as stub if needed or removed?
        // MainMenu.render calls its own renderButtons.
        // So we can likely remove this or make it a stub.
        // Let's remove it in THIS replacement if possible, or leave as empty.
    }

    repairShip() {
        // Logic remains here as it modifies state, but MainMenu calls it.
        const cost = Math.ceil((this.playState.maxHp - this.playState.hp) * 5);
        if (cost > 0 && this.data.money >= cost) {
            SoundManager.play('BUY');
            this.data.money -= cost;
            this.playState.hp = this.playState.maxHp;
            SaveManager.save(this.data);
            this.updateMenuUI();
        }
    }

    startMission(mission) {
        if (this.playState.hp <= 1) {
            alert("機体が大破しています！修理してください。");
            return;
        }

        SoundManager.play('CLICK');
        console.log(`[GameEngine] Starting Mission: ${mission.title}`);
        this.currentMission = mission;

        // 難易度(星)に応じてBGMを選択
        const bgmKey = (mission.stars >= 3) ? 'INGAME_B' : 'INGAME_A';
        SoundManager.playBGM(bgmKey);

        this.changeState(GAME_STATE.INGAME);
    }

    renderMenuButtons() {
        // Repair Button
        const repairCost = (this.playState.maxHp - this.playState.hp) * 5; // 5 credits per 1 HP
        const repairBtn = document.getElementById('repair-btn');
        if (repairBtn) {
            repairBtn.innerText = `修理 (HP ${Math.floor(this.playState.hp)}/${this.playState.maxHp}) - $${Math.floor(repairCost)}`;
            repairBtn.onclick = () => this.repairShip();
            repairBtn.disabled = repairCost <= 0 || this.data.money < repairCost;
        }
    }

    repairShip() {
        const cost = Math.ceil((this.playState.maxHp - this.playState.hp) * 5);
        if (cost > 0 && this.data.money >= cost) {
            SoundManager.play('BUY');
            this.data.money -= cost;
            this.playState.hp = this.playState.maxHp;
            SaveManager.save(this.data);
            this.updateMenuUI();
            this.renderMenuButtons();
        }
    }

    startMission(mission) {
        if (this.playState.hp <= 1) {
            alert("機体が大破しています！修理してください。");
            return;
        }

        SoundManager.play('CLICK');
        this.currentMission = mission;

        // 難易度(星)に応じてBGMを選択
        const bgmKey = (mission.stars >= 3) ? 'INGAME_B' : 'INGAME_A';
        SoundManager.playBGM(bgmKey);

        this.changeState(GAME_STATE.INGAME);
    }

    renderUpgradeList() {
        const list = document.getElementById('upgrade-list'); list.innerHTML = "";
        const specs = UpgradeManager.getUpgradeSpecs(this.data.upgradeLevels);

        specs.forEach(s => {
            const div = document.createElement('div'); div.className = "list-item";

            if (s.isMax) {
                div.innerHTML = `<div><strong>${s.name} (Lv.MAX)</strong><br><small>Fully Upgraded</small></div>
                    <div><button disabled>MAX</button></div>`;
            } else {
                const canAfford = this.data.money >= s.cost;
                // Check materials (TODO: Implement Material Inventory check)
                const hasMaterials = true; // Placeholder

                let matText = "";
                if (s.materialId) {
                    matText = `<br><span style="font-size:0.8em; color:#aaa">Req: ${s.materialId} x${s.materialCount}</span>`;
                }

                div.innerHTML = `<div><strong>${s.name} (Lv.${s.level}→${s.level + 1})</strong><br><small>Effect: ${s.nextValue}</small>${matText}</div>
                    <div>Cost: $${s.cost} <button onclick="engine.buyUpgrade('${s.id}', ${s.cost}, '${s.materialId}', ${s.materialCount})" ${(!canAfford || !hasMaterials) ? 'disabled' : ''}>強化</button></div>`;
            }
            list.appendChild(div);
        });
    }

    buyUpgrade(id, cost, matId, matCount) {
        if (this.data.money >= cost) {
            // TODO: Consume materials
            SoundManager.play('UPGRADE');
            this.data.money -= cost;
            if (this.data.upgradeLevels[id] !== undefined) {
                this.data.upgradeLevels[id]++;
            } else if (this.data.upgradeLevels[id.toLowerCase()] !== undefined) {
                this.data.upgradeLevels[id.toLowerCase()]++;
            } else {
                // Fallback: use ID as is
                this.data.upgradeLevels[id] = 1;
            }
            SaveManager.save(this.data);
            this.renderUpgradeList();
            this.updateMenuUI();
        }
    }

    toggleSound() {
        const isOn = SoundManager.toggleMute();
        document.getElementById('sound-toggle-btn').innerText = isOn ? '🔊' : '🔇';
    }

    renderResult() {
        let finalReward = this.currentMission.reward;
        let bonusText = "";

        // 時間評価計算
        const target = this.currentMission.targetTime;
        const actual = this.playState.elapsedSeconds;
        const timeDiff = target - actual;

        if (timeDiff > 0) {
            // 早期クリアボーナス (最大+30%)
            const bonus = Math.floor(finalReward * Math.min(0.3, timeDiff / target));
            finalReward += bonus;
            bonusText = `タイムボーナス: +$${bonus} (目標: ${target}s / 実際: ${actual.toFixed(1)}s)`;
        } else {
            // 遅延ペナルティ (最大-20%)
            const reduction = Math.floor(finalReward * Math.min(0.2, Math.abs(timeDiff) / target));
            finalReward -= reduction;
            bonusText = `遅延減額: -$${reduction} (目標: ${target}s / 実際: ${actual.toFixed(1)}s)`;
        }

        document.getElementById('result-reward').innerText = finalReward;
        document.getElementById('time-bonus-display').innerText = bonusText;

        const list = document.getElementById('result-items'); list.innerHTML = "";
        for (let t in this.playState.collectedItems) {
            const c = this.playState.collectedItems[t]; this.data.inventory[t] = (this.data.inventory[t] || 0) + c;
            const li = document.createElement('li'); li.innerText = `${GAME_SETTINGS.ECONOMY.ITEMS[t].name} x ${c}`; list.appendChild(li);
        }

        // 統計更新
        this.data.money += finalReward;
        this.data.careerStats.cleared++;
        this.data.careerStats.totalDebrisDestroyed += this.playState.debrisDestroyed;

        SaveManager.save(this.data);
    }

    finishResult() {
        this.changeState(GAME_STATE.MISSION_SELECT);
        SoundManager.play('CLICK');
    }

    // --- ShipEditor related initialization ---
    initGame() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.addEventListeners();

        // UI Manager
        this.shipEditor = new ShipEditor(this);
        this.shipEditor.initSellZone();

        this.renderGridUI();
        this.loop();
    }

    // --- 船体改造（グリッド）システム ---

    renderGridUI() {
        console.log(`[GameEngine] renderGridUI called. ShipEditor exists: ${!!this.shipEditor}`);
        this.updateMenuUI();
        if (this.shipEditor) {
            this.shipEditor.render();
        }
    }

    // --- Custom Confirm Modal ---
    checkConfirm(title, message, onYes) {
        // セッションで非表示設定が有効なら即実行
        if (this.sessionDontShowConfirm) {
            onYes();
            return;
        }

        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');
        const yesBtn = document.getElementById('modal-yes-btn');
        const noBtn = document.getElementById('modal-no-btn');
        const dontShowChk = document.getElementById('modal-dont-show');

        // Elements might be missing if HTML not updated?
        if (!modal || !yesBtn) {
            if (confirm(message)) onYes();
            return;
        }

        titleEl.innerText = title;
        msgEl.innerText = message;
        dontShowChk.checked = false;

        modal.classList.remove('hide');

        // Cleanup old listeners (simple overwrite)
        const close = () => {
            modal.classList.add('hide');
        };

        yesBtn.onclick = () => {
            if (dontShowChk.checked) this.sessionDontShowConfirm = true;
            close();
            onYes();
        };

        noBtn.onclick = () => {
            close();
        };
    }

    renderPartShop() {
        if (this.shipEditor) this.shipEditor.renderPartShop();
    }

    initSellZone() {
        if (this.shipEditor) this.shipEditor.initSellZone();
    }

    drawGrid() {
        if (this.shipEditor) this.shipEditor.drawGrid();
    }

    // Legacy placeholders to prevent errors if called externally
    setupGridDrop() { }
    drawParts() { }

    createPartVisual(t, level) {
        if (this.shipEditor) return this.shipEditor.createPartVisual(t, level);
    }

    setDragImage(e, type, level) {
        if (this.shipEditor) this.shipEditor.setDragImage(e, type, level);
    }

    // --- Warehouse / Shop / Grid Helpers Removal --- 
    // buyCell and resetGrid are now fully in ShipEditor and not called by Engine directly.
    // If buttons in HTML call engine.buyCell, we need a redirect or update HTML.
    // HTML checks: 
    // ShipEditor generates buttons with "this.buyCell" -> ShipEditor.buyCell. OK.
    // Reset Button in HTML? "reset-grid-btn" (in index.html) -> engine.resetGrid()?
    // Let's check index.html later. For now, keep redirection.

    buyCell(r, c) {
        if (this.shipEditor) this.shipEditor.buyCell(r, c);
    }

    resetGrid() {
        if (this.shipEditor) this.shipEditor.resetGrid();
    }
}

window.onload = () => { new GameEngine(); };
