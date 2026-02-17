class MainMenu {
    constructor(engine) {
        this.engine = engine;
        this.data = engine.data;
    }

    render() {
        // Stats
        this.updateStats();
        // Buttons
        this.renderButtons();
    }

    updateStats() {
        // Base Stats
        const base = GAME_SETTINGS.PLAYER;

        const getStatSpec = (key) => {
            const table = GAME_BALANCE_DATA.UPGRADE_TABLE;
            if (!table || !table[key]) return { val: 0 };
            const lv = this.data.upgradeLevels[key] || this.data.upgradeLevels[key.toLowerCase()] || 0;
            const row = table[key].find(r => r.Level === lv);
            return row ? { val: row.ValueTotal, lv: lv } : { val: 0, lv: 0 };
        };

        const speedUp = getStatSpec('ENGINE').val;
        const accelUp = getStatSpec('ACCEL').val;
        const brakeUp = getStatSpec('BRAKE').val;
        const weaponOsUp = getStatSpec('WEAPON_OS').val;

        // Totals
        const totalSpeed = (base.SPEED || 550) + speedUp;
        const totalAccel = (base.ACCEL || 100) + accelUp;
        const totalBrake = (base.BRAKE || 80) + brakeUp;
        const totalWeapon = (base.WEAPON_OS || 120) + weaponOsUp;

        this._setSafeText('max-speed-val', Math.floor(totalSpeed));
        this._setSafeText('accel-val', Math.floor(totalAccel));
        this._setSafeText('weapon-val', Math.floor(totalWeapon));
        this._setSafeText('brake-val', Math.floor(totalBrake));
    }

    renderButtons() {
        // Repair Button
        const repairCost = (this.engine.playState.maxHp - this.engine.playState.hp) * 5;
        const repairBtn = document.getElementById('repair-btn');
        if (repairBtn) {
            repairBtn.innerText = `修理 (HP ${Math.floor(this.engine.playState.hp)}/${this.engine.playState.maxHp}) - $${Math.floor(repairCost)}`;
            repairBtn.onclick = () => {
                console.log("[MainMenu] Repair Clicked");
                SoundManager.play('CLICK');
                this.engine.repairShip();
            };
            repairBtn.disabled = repairCost <= 0 || this.data.money < repairCost;
        }

        // Reset Button (Already in index.html but maybe we handle it here?)
        // Currently handled in initEvents in Engine.
    }

    _setSafeText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }
}
