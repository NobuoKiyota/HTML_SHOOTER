class Enemy {
    constructor(tierData, tierId, x, y) {
        this.tierId = tierId;
        this.tierData = tierData;

        // Stats
        this.maxHp = tierData.hp || 10;
        this.hp = this.maxHp;
        this.maxShield = tierData.shield || 0;
        this.shield = this.maxShield;

        // Locomotion
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;

        this.baseSpeed = tierData.speed || 2; // Y-axis speed
        this.speed = this.baseSpeed;
        this.turn = tierData.turn || 2; // X-axis/Turn speed
        this.mpId = tierData.movementPattern || tierData.mpId || 'MPID001';

        // Combat
        this.eqId = tierData.eq || tierData.eqId || 'EQID001';
        this.cooldown = 0;
        this.dtId = tierData.dropTable || tierData.dtId || 'DropDT001';
        this.dropCount = tierData.dropCount || 1;

        // Internal State
        this.time = 0; // For wave/spiral patterns
        this.vx = 0;
        this.vy = this.speed; // Default downward
        this.state = 0; // For multi-stage patterns (like "Face")
        this.stateTimer = 0;

        this.color = "#e74c3c";
        if (tierId.includes("TypeA")) this.color = "#e74c3c";
        else if (tierId.includes("TypeB")) this.color = "#e67e22";
        else if (tierId.includes("TypeC")) this.color = "#f1c40f";
        else this.color = "#9b59b6";

        this.markedForDeletion = false;

        // Model/Shape logic can be expanded here
        this.model = tierData.model || 'EnemyShip';
    }

    applyModifiers(shieldMod, hpMod) {
        if (shieldMod) {
            this.maxShield = Math.floor(this.maxShield * shieldMod);
            this.shield = this.maxShield;
        }
        if (hpMod) {
            this.maxHp = Math.floor(this.maxHp * hpMod);
            this.hp = this.maxHp;
        }
    }

    update(playState, playerPos) {
        this.time++;

        // 1. Movement Logic
        this.handleMovement(playerPos);

        // 2. Firing Logic
        this.handleFiring(playState, playerPos);

        // 3. Boundary Check (Simple)
        if (this.y > 900 || this.y < -200 || this.x < -100 || this.x > 700) {
            // Allow some buffer for off-screen maneuvers
            if (this.time > 600) this.markedForDeletion = true;
        }
    }

    handleMovement(playerPos) {
        // Look up pattern logic if needed, or switch on MPID
        // Simply implementing based on MPID for now.
        const pid = this.mpId;
        const t = this.time;

        // Basic Directions
        if (pid === 'MPID001') { // Straight Down
            this.y += this.speed;
        }
        else if (pid === 'MPID002') { // Straight Up
            this.y -= this.speed;
        }
        else if (pid === 'MPID003') { // Straight Right->Left
            this.x -= this.speed; // User said Right->Left, assuming speed is positive
        }
        else if (pid === 'MPID004') { // Straight Left->Right
            this.x += this.speed;
        }

        // ZigZag
        else if (pid === 'MPID005' || pid === 'MPID006') { // Y-axis ZigZag
            this.y += (pid === 'MPID005' ? 1 : -1) * this.speed;
            this.x += Math.sin(t * 0.05) * this.turn;
        }
        else if (pid === 'MPID007' || pid === 'MPID008') { // X-axis ZigZag
            this.x += (pid === 'MPID008' ? 1 : -1) * this.speed;
            this.y += Math.sin(t * 0.05) * this.turn;
        }

        // Homing
        else if (pid.startsWith('MPID009') || pid.startsWith('MPID010') || pid.startsWith('MPID011') || pid.startsWith('MPID012')) {
            // Simple homing
            const dx = playerPos.x - this.x;
            const dy = playerPos.y - this.y;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * (this.speed * 0.5); // Slower homing
            this.y += Math.sin(angle) * (this.speed * 0.5);
        }

        // Reflect (Simple implementation: bounce off walls)
        else if (pid.startsWith('MPID013')) {
            // .. logic to init vx/vy once then bounce
            if (this.time === 1) { this.vy = this.speed; this.vx = this.turn; }
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > 600) this.vx *= -1;
            // Only bounce Y if strictly Reflect Y?
            // User said "MovementPattern... Reflect".
            // We'll keep it simple: Bounce X
        }

        // Wave / Spiral
        else if (pid.startsWith('MPID017')) { // Wave Down
            this.y += this.speed;
            this.x += Math.cos(t * 0.1) * (this.turn * 2);
        }
        else if (pid.startsWith('MPID021')) { // Spiral Down
            this.y += this.speed;
            this.x += Math.cos(t * 0.1) * (this.turn * 2);
            // Spiral usually implies growing radius or 2D circular motion while moving
        }

        // Default
        else {
            this.y += this.speed;
        }
    }

    handleFiring(playState, playerPos) {
        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // Get Weapon Data
        const wpn = GAME_BALANCE_DATA.ENEMY_WEAPONS[this.eqId];
        if (!wpn) return;

        // Check range? (optional)

        // Fire
        const shotAngleMode = wpn.ShotAngle || 'AimPlayer';
        const num = wpn.ShotNum || 1;
        const spd = wpn.Speed || 5;
        const dmg = wpn.Damage || 10;

        let baseAngle = Math.PI / 2; // Down
        if (shotAngleMode === 'AimPlayer') {
            baseAngle = Math.atan2(playerPos.y - this.y, playerPos.x - this.x);
        }

        for (let i = 0; i < num; i++) {
            let angle = baseAngle;
            if (shotAngleMode === 'Fan') {
                // Spread centered on baseAngle
                const spread = Math.PI / 4; // 45 deg total
                angle = baseAngle - (spread / 2) + (spread * (i / (num > 1 ? num - 1 : 1)));
            } else if (shotAngleMode === 'RandomSpray') {
                angle += (Math.random() - 0.5);
            } else if (shotAngleMode === 'Spiral') {
                angle = baseAngle + (this.time * 0.2) + (i * 0.2);
            }

            // Create Projectile
            // Use GameEngine's dict? Or push to list?
            // Enemy shouldn't push directly to playState ideally, but it's easiest.
            // "this" is Enemy. We need reference to bullet list.
            // Accepted pattern in this codebase: playState.bullets.push

            playState.missiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 300,
                color: "#ff0",
                type: 'enemy_bullet', // 'missile' type logic in engine handles generic projectiles?
                // Engine handles 'bomb' and others.
                // We need to make sure engine handles generic enemy bullets.
                // Actually `updateEntities` handles `playState.missiles` as Player Missiles?
                // Wait. `playState.bullets` (Player) vs `playState.missiles` (Player special?).
                // Where are Enemy Bullets?
                // Looking at `engine.js` `updateEntities`:
                // `this.playState.bullets` seems to be Player bullets (checked against enemies?).
                // I need to add `enemyBullets` array or reuse `bullets` with a tag?
                // Usually Enemy Bullets are separate to check collision with Player.
                // I need to ADD `playState.enemyBullets` to Engine if it doesn't exist.
                // Or check if `missiles` targets player.
                // Let's assume we need to add `enemyBullets`.
            });
        }

        this.cooldown = wpn.Cooltime || 60;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw Shield
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2 + 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(52, 152, 219, ${0.5 + (this.shield / this.maxShield) * 0.5})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Draw Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.tierId && this.tierId.includes("TypeB")) { // Triangle
            ctx.moveTo(0, 10);
            ctx.lineTo(-15, -15);
            ctx.lineTo(15, -15);
        } else { // Rect
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.fill();

        // HP Bar
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = "#555";
        ctx.fillRect(-20, -25, 40, 4);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(-20, -25, 40 * hpPct, 4);

        if (this.shield > 0) {
            const shPct = this.shield / this.maxShield;
            ctx.fillStyle = "#3498db";
            ctx.fillRect(-20, -30, 40 * shPct, 2);
        }

        ctx.restore();
    }

    takeDamage(amount) {
        if (this.shield > 0) {
            if (this.shield >= amount) {
                this.shield -= amount;
                return false;
            } else {
                amount -= this.shield;
                this.shield = 0;
            }
        }
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            return true;
        }
        return false;
    }
}
