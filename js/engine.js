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

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_SETTINGS.CANVAS_WIDTH;
        this.canvas.height = GAME_SETTINGS.CANVAS_HEIGHT;

        this.data = SaveManager.load() || SaveManager.getInitialData();
        this.currentMission = null;

        this.playState = {
            hp: 100, maxHp: 100,
            cargoHp: 100, maxCargoHp: 100,
            distance: 0,
            currentSpeed: 0,
            accel: 0,
            maxSpeed: 0,
            isBraking: false,
            collectedItems: {},
            enemies: [], bullets: [], loot: [], particles: [],
            bgOffset: 0, frameCount: 0,
            boostTimer: 0,
            elapsedSeconds: 0,
            debrisDestroyed: 0,
            missileCooldown: 0,
            missiles: []
        };

        this.playerPos = { x: 400, y: 300, targetX: 400, targetY: 300, fireCooldown: 0 };
        this.currentState = GAME_STATE.TITLE;
        window.engine = this;

        this.initEvents();
        this.changeState(GAME_STATE.TITLE);
        this.gameLoop();
    }

    initEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.playerPos.targetX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.playerPos.targetY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
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
            if (confirm('完全に初期化しますか？')) { SaveManager.reset(); location.reload(); }
        };
    }

    changeState(newState) {
        this.currentState = newState;

        // BGM管理
        if (newState !== GAME_STATE.INGAME) {
            SoundManager.playBGM('OUTGAME');
        }

        document.querySelectorAll('.screen, .gui-overlay').forEach(el => el.classList.add('hide'));

        // サイドパネルの状態制御
        const sidePanels = document.querySelectorAll('.side-panel');
        if (newState === GAME_STATE.INGAME) {
            sidePanels.forEach(p => p.classList.remove('hide-panel'));
        } else {
            sidePanels.forEach(p => p.classList.add('hide-panel'));
        }

        // 戻るボタンの制御
        const backBtn = document.getElementById('global-back-btn');
        if ([GAME_STATE.UPGRADE, GAME_STATE.MISSION_SELECT, GAME_STATE.GRID_MODIFY].includes(newState)) {
            backBtn.disabled = false;
            backBtn.classList.remove('disabled');
        } else {
            backBtn.disabled = true;
            backBtn.classList.add('disabled');
        }

        switch (newState) {
            case GAME_STATE.TITLE: document.getElementById('title-screen').classList.remove('hide'); break;
            case GAME_STATE.MENU: document.getElementById('main-menu').classList.remove('hide'); this.updateMenuUI(); break;
            case GAME_STATE.UPGRADE: document.getElementById('upgrade-screen').classList.remove('hide'); this.renderUpgradeList(); break;
            case GAME_STATE.MISSION_SELECT: document.getElementById('mission-select-screen').classList.remove('hide'); this.renderMissionList(); break;
            case GAME_STATE.INGAME: document.getElementById('ingame-gui').classList.remove('hide'); this.initIngame(); break;
            case GAME_STATE.RESULT: document.getElementById('result-screen').classList.remove('hide'); this.renderResult(); break;
            case GAME_STATE.FAILURE: document.getElementById('failure-screen').classList.remove('hide'); break;
            case GAME_STATE.GRID_MODIFY: document.getElementById('grid-screen').classList.remove('hide'); this.renderGridUI(); break;
        }
    }

    goBack() {
        if ([GAME_STATE.UPGRADE, GAME_STATE.MISSION_SELECT, GAME_STATE.GRID_MODIFY].includes(this.currentState)) {
            SoundManager.play('CLICK');
            this.changeState(GAME_STATE.MENU);
        }
    }

    initIngame() {
        const lv = this.data.upgradeLevels;
        const weather = GAME_SETTINGS.WEATHER[this.currentMission.weather] || GAME_SETTINGS.WEATHER.CLEAR;

        this.playState.maxHp = 100 + (lv.health * GAME_SETTINGS.UPGRADES.HEALTH_INC);
        this.playState.hp = this.playState.maxHp;
        this.playState.maxCargoHp = GAME_SETTINGS.PHYSICS.CARGO_HP_BASE;
        this.playState.cargoHp = this.playState.maxCargoHp;

        // グリッドパーツの効果と重量を計算
        const bonuses = GridManager.calculateBonuses(this.data.gridData.equippedParts);

        // 重量計算: パーツ重量 + 依頼貨物重量(10倍してスケール調整)
        this.playState.totalWeight = bonuses.totalWeight + (this.currentMission.weight * 10);
        // 出力計算: 基礎パワー(100) + 強化レベル
        this.playState.enginePower = 100 + (lv.engine_power * GAME_SETTINGS.UPGRADES.ENGINE_POWER_INC);

        // 最高速度と加速の計算 (重量による減衰)
        // 速度低下係数 = Power / (Power + Weight)
        const weightPenalty = this.playState.enginePower / (this.playState.enginePower + this.playState.totalWeight);

        this.playState.accel = (GAME_SETTINGS.PHYSICS.BASE_ACCEL + (lv.accel * GAME_SETTINGS.UPGRADES.ACCEL_INC) + bonuses.accelBoost) * weightPenalty;
        this.playState.maxSpeed = (GAME_SETTINGS.PHYSICS.BASE_MAX_SPEED + (lv.speed * GAME_SETTINGS.UPGRADES.SPEED_INC)) * weightPenalty;
        this.playState.currentSpeed = 0;

        this.playState.brakeForce = GAME_SETTINGS.PHYSICS.BRAKE_FORCE + bonuses.brakeBoost;
        this.playState.fireRateFactor = bonuses.fireRateFactor;
        this.playState.lootRange = bonuses.lootRange;
        this.playState.hasMissile = bonuses.hasMissile;
        this.playState.weaponDamage = bonuses.weaponDamage;

        this.playState.distance = this.currentMission.distance;
        this.playState.enemies = []; this.playState.bullets = []; this.playState.loot = []; this.playState.particles = [];
        this.playState.collectedItems = {}; this.playState.frameCount = 0; this.playState.boostTimer = 0;
        this.playState.isBraking = false;
        this.playState.elapsedSeconds = 0;
        this.playState.debrisDestroyed = 0;

        // 総受注数をカウント
        this.data.careerStats.started++;
        SaveManager.save(this.data);

        document.getElementById('weather-display').innerText = weather.name;
        document.getElementById('mission-stars').innerText = "★".repeat(this.currentMission.stars || 1);
    }

    gameLoop() {
        this.update(); this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.currentState !== GAME_STATE.INGAME) return;
        const lv = this.data.upgradeLevels;
        const weather = GAME_SETTINGS.WEATHER[this.currentMission.weather] || GAME_SETTINGS.WEATHER.CLEAR;
        this.playState.frameCount++;

        // 1. 加速/ブレーキ物理 (エクセル設定を利用)
        let targetMax = this.playState.maxSpeed;
        if (this.playState.boostTimer > 0) {
            this.playState.boostTimer--;
            targetMax *= 1.5;
        }

        if (this.playState.isBraking) {
            this.playState.currentSpeed = Math.max(GAME_SETTINGS.PHYSICS.MIN_SPEED, this.playState.currentSpeed - this.playState.brakeForce);
        } else if (this.playState.currentSpeed < targetMax) {
            this.playState.currentSpeed += this.playState.accel;
        } else {
            this.playState.currentSpeed *= GAME_SETTINGS.PHYSICS.FRICTION;
        }

        // 2. 天候の影響
        this.playerPos.x += weather.wind;

        // 3. プレイヤー移動 (Lerp)
        const lerp = GAME_SETTINGS.PLAYER.BASE_LERP;
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
        this.updateIngameGUI();
    }

    createParticles(weather) {
        if (this.playState.frameCount % 2 === 0) {
            const count = Math.ceil(this.playState.currentSpeed / 2);
            for (let i = 0; i < count; i++) {
                this.playState.particles.push(new Particle(this.playerPos.x + (Math.random() - 0.5) * 10, this.playerPos.y + 20, (Math.random() - 0.5) * 2, 2 + this.playState.currentSpeed / 4, 20, "#0af", 3));
            }
        }
        if (weather.rain > 0) {
            for (let i = 0; i < 2; i++) {
                this.playState.particles.push(new Particle(Math.random() * this.canvas.width, -10, weather.wind, 10, 60, "#4af", 1));
            }
        }
    }

    updateEntities(weather) {
        this.playState.particles = this.playState.particles.filter(p => { p.update(); return p.life > 0; });

        // 弾丸
        this.playState.bullets.forEach((b, idx) => {
            b.y -= (GAME_SETTINGS.BULLET.SPEED + this.playState.currentSpeed / 2);
            if (b.y < -50) this.playState.bullets.splice(idx, 1);
        });

        // デブリ出現
        if (this.playState.frameCount % GAME_SETTINGS.ENEMY.SPAWN_INTERVAL === 0) this.spawnDebris();

        this.playState.enemies.forEach((en, enIdx) => {
            // 移動：自機の速度に連動
            const fallSpeed = en.baseSpeed + this.playState.currentSpeed;
            en.y += fallSpeed;

            // ホーミング
            if (en.homing > 0) {
                const diffX = this.playerPos.x - en.x;
                en.x += Math.sign(diffX) * Math.min(Math.abs(diffX), en.homing);
            }

            // 衝突：弾 vs デブリ
            this.playState.bullets.forEach((b, bIdx) => {
                if (Math.hypot(en.x - b.x, en.y - b.y) < 30) {
                    let damage = this.playState.weaponDamage * (1 - weather.rain);
                    en.hp -= damage;
                    this.playState.bullets.splice(bIdx, 1);
                    SoundManager.play('CLICK'); // ヒット音（小）
                    for (let i = 0; i < 3; i++) this.playState.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 10, "#fa0", 2));
                }
            });

            // 衝突：自機 vs デブリ
            if (Math.hypot(en.x - this.playerPos.x, en.y - this.playerPos.y) < 35) {
                this.playState.hp -= 5;
                this.playState.cargoHp -= 10;
                if (this.playState.hp <= 0) this.handleFailure("自機が破壊されました");
                if (this.playState.cargoHp <= 0) this.handleFailure("荷物が大破しました");
                this.playState.enemies.splice(enIdx, 1);
            }

            if (en.hp <= 0) {
                this.playState.debrisDestroyed++;
                SoundManager.play('EXPLOSION');
                if (Math.random() < 0.2) this.spawnLoot(en.x, en.y);
                this.playState.enemies.splice(enIdx, 1);
            }
            if (en.y > this.canvas.height + 100) this.playState.enemies.splice(enIdx, 1);
        });

        // ミサイルの更新（移動・X軸ホーミング・衝突）
        this.playState.missiles.forEach((m, idx) => {
            m.life--;
            if (m.life <= 0) { this.playState.missiles.splice(idx, 1); return; }

            // 近い敵を探してX軸のみ追尾
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
            m.vx *= 0.95; // 空気抵抗的な減衰

            // 衝突判定
            this.playState.enemies.forEach((en, enIdx) => {
                if (Math.hypot(en.x - m.x, en.y - m.y) < 30) {
                    const dmg = GAME_SETTINGS.PHYSICS.MISSILE_DAMAGE || 40;
                    en.hp -= dmg;
                    this.playState.missiles.splice(idx, 1);
                    SoundManager.play('EXPLOSION');
                    for (let i = 0; i < 8; i++) {
                        this.playState.particles.push(new Particle(m.x, m.y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 15, "#f55", 3));
                    }
                }
            });
        });

        // 経過時間の更新 (60fps想定)
        this.playState.elapsedSeconds += 1 / 60;

        // アイテム
        this.playState.loot.forEach((item, idx) => {
            item.y += (1 + this.playState.currentSpeed / 2);
            if (Math.hypot(item.x - this.playerPos.x, item.y - this.playerPos.y) < this.playState.lootRange) {
                this.collectItem(item.type);
                this.playState.loot.splice(idx, 1);
            }
        });
    }

    shootMissile() {
        SoundManager.play('MISSILE');
        // 放射状に3発発射
        const angles = [-0.3, 0, 0.3];
        angles.forEach(angle => {
            this.playState.missiles.push({
                x: this.playerPos.x,
                y: this.playerPos.y,
                vx: Math.sin(angle) * 5,
                vy: -Math.cos(angle) * 5,
                life: 180
            });
        });
    }

    shoot() {
        SoundManager.play('SHOOT');
        const cooldown = GAME_SETTINGS.PLAYER.BASE_FIRE_COOLDOWN * (1 + this.currentMission.weight * 0.1) * this.playState.fireRateFactor;
        this.playState.bullets.push({ x: this.playerPos.x, y: this.playerPos.y - 10 });
        this.playerPos.fireCooldown = cooldown;
    }

    spawnDebris() {
        const tiers = GAME_SETTINGS.DEBRIS.TIERS;
        const tier = tiers[Math.floor(Math.random() * tiers.length)];
        this.playState.enemies.push({
            x: Math.random() * this.canvas.width,
            y: -50,
            hp: tier.hp,
            baseSpeed: tier.speed,
            homing: tier.homing,
            color: tier.color,
            tierId: tier.id
        });
    }

    spawnLoot(x, y) {
        const types = Object.keys(GAME_SETTINGS.ECONOMY.ITEMS);
        const type = types[Math.floor(Math.random() * types.length)];
        this.playState.loot.push({ x, y, type });
    }

    collectItem(type) {
        SoundManager.play('COLLECT');
        const item = GAME_SETTINGS.ECONOMY.ITEMS[type];
        if (item.type === "buff") {
            if (type === "BoostApex") this.playState.boostTimer = item.duration;
            if (type === "BoostAccel") this.playState.accel += 0.02;
        } else {
            this.playState.collectedItems[type] = (this.playState.collectedItems[type] || 0) + 1;
        }
        const notify = document.getElementById('item-notification');
        notify.innerText = `${item.name} 取得！`;
        notify.classList.add('show');
        setTimeout(() => notify.classList.remove('show'), 2000);
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

    draw() {
        this.ctx.fillStyle = "#05070a";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#fff";
        for (let i = 0; i < 20; i++) {
            const x = (Math.sin(i * 123) * 0.5 + 0.5) * this.canvas.width;
            const y = ((this.playState.bgOffset + i * 100) % this.canvas.height);
            this.ctx.fillRect(x, y, 1, 1);
        }

        if (this.currentState === GAME_STATE.INGAME) {
            this.playState.particles.forEach(p => p.draw(this.ctx));

            this.ctx.save();
            this.ctx.translate(this.playerPos.x, this.playerPos.y);
            if (this.playState.boostTimer > 0) {
                this.ctx.shadowBlur = 20; this.ctx.shadowColor = "#fff"; this.ctx.fillStyle = "#fff";
            } else {
                this.ctx.fillStyle = "#00a2ff";
            }
            this.ctx.beginPath();
            this.ctx.moveTo(0, -20); this.ctx.lineTo(15, 15); this.ctx.lineTo(-15, 15);
            this.ctx.closePath(); this.ctx.fill();
            this.ctx.restore();

            this.ctx.fillStyle = "#ff0";
            this.playState.bullets.forEach(b => this.ctx.fillRect(b.x - 2, b.y, 4, 12));

            this.ctx.fillStyle = "#ff416c";
            this.playState.missiles.forEach(m => {
                this.ctx.beginPath(); this.ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); this.ctx.fill();
            });

            this.playState.enemies.forEach(en => {
                this.ctx.fillStyle = en.color;
                this.ctx.beginPath();
                this.ctx.arc(en.x, en.y, 20, 0, Math.PI * 2);
                this.ctx.fill();
            });

            this.playState.loot.forEach(item => {
                this.ctx.fillStyle = GAME_SETTINGS.ECONOMY.ITEMS[item.type].type === "buff" ? "#f0f" : "#0f0";
                this.ctx.beginPath(); this.ctx.arc(item.x, item.y, 10, 0, Math.PI * 2); this.ctx.fill();
            });
        }
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
        const weaponDmg = (GAME_SETTINGS.BULLET.DAMAGE + this.data.upgradeLevels.weapon * GAME_SETTINGS.UPGRADES.WEAPON_DAMAGE_INC).toFixed(0);
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
        this.updateGlobalHeader();
        const shipStats = GridManager.calculateBonuses(this.data.gridData.equippedParts);

        const baseSpeed = GAME_SETTINGS.PHYSICS.BASE_MAX_SPEED + this.data.upgradeLevels.speed * GAME_SETTINGS.UPGRADES.SPEED_INC;
        const baseAccel = GAME_SETTINGS.PHYSICS.BASE_ACCEL + this.data.upgradeLevels.accel * GAME_SETTINGS.UPGRADES.ACCEL_INC;
        const baseWeapon = GAME_SETTINGS.BULLET.DAMAGE + this.data.upgradeLevels.weapon * GAME_SETTINGS.UPGRADES.WEAPON_DAMAGE_INC;
        const baseBrake = GAME_SETTINGS.PHYSICS.BRAKE_FORCE;

        this._setSafeText('max-speed-val', Math.floor((baseSpeed + (shipStats.speedBoost || 0)) * 100));
        this._setSafeText('accel-val', (baseAccel + shipStats.accelBoost).toFixed(3));
        this._setSafeText('weapon-val', (baseWeapon + (shipStats.weaponBoost || 0)).toFixed(0));
        this._setSafeText('brake-val', (baseBrake + shipStats.brakeBoost).toFixed(2));
    }

    renderMissionList() {
        const list = document.getElementById('mission-list');
        list.innerHTML = "";
        const m = MissionManager.generateMissions();
        m.forEach(mi => {
            const weather = GAME_SETTINGS.WEATHER[mi.weather] || GAME_SETTINGS.WEATHER.CLEAR;
            const stars = "★".repeat(mi.stars || 1);
            const div = document.createElement('div');
            div.className = "list-item";
            div.innerHTML = `<div><strong>${mi.title}</strong> <span style="color:#ff0">${stars}</span> [${weather.name}]<br>
                <small>目標時間: ${mi.targetTime}s | 距離: ${mi.distance}m | 報酬: $${mi.reward}</small></div>
                <button onclick="engine.startMission(${JSON.stringify(mi).replace(/"/g, '&quot;')})">受注</button>`;
            list.appendChild(div);
        });
    }

    startMission(mission) {
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
            div.innerHTML = `<div><strong>${s.name} (Lv.${s.level})</strong><br><small>${s.desc}</small></div>
                <div>Cost: $${s.cost} <button onclick="engine.buyUpgrade('${s.id}', ${s.cost})" ${this.data.money < s.cost ? 'disabled' : ''}>強化</button></div>`;
            list.appendChild(div);
        });
    }

    buyUpgrade(id, cost) {
        if (this.data.money >= cost) {
            SoundManager.play('BUY');
            this.data.money -= cost;
            this.data.upgradeLevels[id]++;
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

    finishResult() { this.changeState(GAME_STATE.MISSION_SELECT); }

    // --- 船体改造（グリッド）システム ---

    renderGridUI() {
        this.updateMenuUI();
        this.drawGrid();
        this.renderPartShop();
        this.renderWarehouse();
        this.initSellZone();
    }

    renderWarehouse() {
        const list = document.getElementById('warehouse-list');
        list.innerHTML = "";
        const data = this.data.gridData;
        if (!data.warehouse) data.warehouse = [];

        data.warehouse.forEach((p) => {
            const t = GridManager.PART_TEMPLATES[p.type];
            if (!t) return;
            const div = document.createElement('div');
            div.className = "part-item";
            div.draggable = true;
            div.innerHTML = `<strong>${t.name} (Lv.${p.level})</strong><br><small>${t.desc}</small>`;

            div.ondragstart = (e) => {
                e.dataTransfer.setData('partId', p.id);
                e.dataTransfer.setData('fromWarehouse', 'true');
            };
            list.appendChild(div);
        });
    }

    renderPartShop() {
        const list = document.getElementById('part-list');
        list.innerHTML = "";
        const shopItems = ['Missile', 'FireRateReducer', 'ItemCollector', 'AccelBooster', 'BrakeBooster'];

        shopItems.forEach(type => {
            const t = GridManager.PART_TEMPLATES[type];
            const isEquipped = GridManager.isTypeEquipped(this.data.gridData, type);

            const div = document.createElement('div');
            div.className = "part-item" + (isEquipped ? " equipped" : "");
            div.innerHTML = `<strong>${t.name}</strong> $${t.price}<br><small>${t.desc}</small>`;

            if (isEquipped) {
                div.title = "同一パーツは1つまで装備可能です";
                div.onclick = () => alert("同一タイプのパーツは既に装備されています。アップグレードして強化してください。");
            } else {
                div.onclick = () => {
                    const res = GridManager.buyPart(this.data, type);
                    if (res.success) {
                        SaveManager.save(this.data);
                        this.renderGridUI();
                    } else {
                        alert(res.reason);
                    }
                };
            }
            list.appendChild(div);
        });
    }

    initSellZone() {
        const zone = document.getElementById('sell-zone');
        if (!zone) return;
        zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
        zone.ondragleave = () => zone.classList.remove('drag-over');
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const partId = e.dataTransfer.getData('partId');
            if (partId && confirm('このパーツを売却しますか？')) {
                const res = GridManager.sellPart(this.data, partId);
                if (res.success) {
                    SaveManager.save(this.data);
                    this.renderGridUI();
                }
            }
        };
    }

    drawGrid() {
        const gridEl = document.getElementById('ship-grid');
        gridEl.innerHTML = "";
        const data = this.data.gridData;

        // 10x10のセルを作成
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const cell = document.createElement('div');
                cell.className = "grid-cell";
                const isUnlocked = data.unlockedCells.some(uc => uc.r === r && uc.c === c);

                if (isUnlocked) {
                    cell.classList.add('unlocked');
                } else {
                    cell.classList.add('locked');
                    cell.innerText = "×";
                    const hasNeighbor = data.unlockedCells.some(uc => Math.abs(uc.r - r) + Math.abs(uc.c - c) === 1);
                    if (hasNeighbor) {
                        cell.style.cursor = "pointer";
                        cell.title = `解放コスト: $${GridManager.CELL_UNLOCK_PRICE}`;
                        cell.onclick = () => this.buyCell(r, c);
                    }
                }
                cell.ondragover = (e) => e.preventDefault();
                gridEl.appendChild(cell);
            }
        }
        this.drawParts();
    }

    drawParts() {
        const gridEl = document.getElementById('ship-grid');
        const data = this.data.gridData;
        const CELL_SIZE = 36;
        const GAP = 2;

        data.equippedParts.forEach((p) => {
            const t = GridManager.PART_TEMPLATES[p.type];
            if (!t) return;
            const partEl = document.createElement('div');
            partEl.className = "grid-part equipped";
            partEl.innerHTML = `<span>${t.name}<br>Lv.${p.level}</span>`;
            partEl.style.width = `${t.w * CELL_SIZE + (t.w - 1) * GAP}px`;
            partEl.style.height = `${t.h * CELL_SIZE + (t.h - 1) * GAP}px`;
            partEl.style.left = `${p.c * (CELL_SIZE + GAP)}px`;
            partEl.style.top = `${p.r * (CELL_SIZE + GAP)}px`;
            partEl.style.backgroundColor = t.color;
            partEl.draggable = true;

            partEl.ondragstart = (e) => {
                e.dataTransfer.setData('partId', p.id);
                partEl.classList.add('dragging');
            };
            partEl.ondragend = () => partEl.classList.remove('dragging');

            // アップグレード
            partEl.onclick = () => {
                const upCost = t.price * p.level;
                if (confirm(`${t.name} を強化しますか？\nコスト: $${upCost}`)) {
                    if (this.data.money >= upCost) {
                        this.data.money -= upCost;
                        p.level++;
                        SaveManager.save(this.data);
                        this.renderGridUI();
                    } else alert("資金が不足しています。");
                }
            };

            gridEl.appendChild(partEl);
        });

        // グリッドへのドロップ
        gridEl.ondrop = (e) => {
            e.preventDefault();
            const partId = e.dataTransfer.getData('partId');
            const fromWarehouse = e.dataTransfer.getData('fromWarehouse');
            const rect = gridEl.getBoundingClientRect();
            const c = Math.floor((e.clientX - rect.left) / (CELL_SIZE + GAP));
            const r = Math.floor((e.clientY - rect.top) / (CELL_SIZE + GAP));

            if (!partId) return;

            if (fromWarehouse) {
                const idx = data.warehouse.findIndex(p => p.id === partId);
                const p = data.warehouse[idx];
                if (GridManager.isValidPlacement(data, p.type, r, c)) {
                    data.warehouse.splice(idx, 1);
                    p.r = r; p.c = c;
                    data.equippedParts.push(p);
                    SaveManager.save(this.data);
                    this.renderGridUI();
                }
            } else {
                const p = data.equippedParts.find(p => p.id === partId);
                if (GridManager.isValidPlacement(data, p.type, r, c, partId)) {
                    p.r = r; p.c = c;
                    SaveManager.save(this.data);
                    this.renderGridUI();
                }
            }
        };
    }

    buyCell(r, c) {
        const res = GridManager.unlockCell(this.data.gridData, this.data.money, r, c);
        if (res.success) {
            this.data.money -= res.cost;
            SaveManager.save(this.data);
            this.renderGridUI();
        } else alert(res.reason);
    }

    resetGrid() {
        if (confirm('グリッドを初期状態に戻しますか？\n装備品はすべて倉庫に戻り、拡張コストの50%が返金されます。')) {
            const res = GridManager.resetGrid(this.data.gridData);
            this.data.money += res.refund;
            SaveManager.save(this.data);
            this.renderGridUI();
        }
    }
}

window.onload = () => { new GameEngine(); };
