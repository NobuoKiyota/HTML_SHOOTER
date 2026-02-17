/**
 * 船体グリッド改造管理クラス
 * Tetris風のパーツ配置、ドラッグ＆ドロップ、グリッド拡張を制御
 */
const GridManager = {
    // パーツ定義 (settings_data.js から取得 + WEAPONSも統合)
    get PART_TEMPLATES() {
        return Object.assign({}, GAME_BALANCE_DATA.WEAPONS || {}, GAME_BALANCE_DATA.PART_TEMPLATES || {});
    },

    GRID_MAX_SIZE: 10,
    CELL_UNLOCK_PRICE: 500, // 1マスあたりの価格

    // 配置検証 (Shape対応 V5)
    isValidPlacement: (gridData, partType, row, col, movingPartIndex = -1) => {
        const template = GridManager.PART_TEMPLATES[partType];
        if (!template) return false;

        const w = template.w || template.W || 1;
        const h = template.h || template.H || 1;
        const shape = template.shape || template.Shape || null; // 2D array [[1,1],[0,1]]

        // Iterate over bounding box
        for (let rOffset = 0; rOffset < h; rOffset++) {
            for (let cOffset = 0; cOffset < w; cOffset++) {
                // If shape is defined, skip empty cells (0)
                if (shape && shape[rOffset] && shape[rOffset][cOffset] === 0) continue;

                const r = row + rOffset;
                const c = col + cOffset;

                // 1. Grid Bounds Check
                if (r < 0 || r >= GridManager.GRID_MAX_SIZE || c < 0 || c >= GridManager.GRID_MAX_SIZE) return false;

                // 2. Unlock Check
                const isUnlocked = gridData.unlockedCells.some(cell => cell.r === r && cell.c === c);
                if (!isUnlocked) return false;

                // 3. Overlap Check with other parts
                const overlap = gridData.equippedParts.some((p, idx) => {
                    if (idx === movingPartIndex) return false; // Ignore self

                    const otherT = GridManager.PART_TEMPLATES[p.type];
                    if (!otherT) return false;
                    const otW = otherT.w || otherT.W || 1;
                    const otH = otherT.h || otherT.H || 1;
                    const otShape = otherT.shape || otherT.Shape || null;

                    // Check if (r, c) is occupied by 'p'
                    // Relative pos in 'p'
                    const relR = r - p.r;
                    const relC = c - p.c;

                    // If outside p's bounding box, no overlap
                    if (relR < 0 || relR >= otH || relC < 0 || relC >= otW) return false;

                    // If inside bounding box, check shape
                    if (otShape) {
                        return (otShape[relR] && otShape[relR][relC] === 1);
                    } else {
                        return true; // Rectangle assumption
                    }
                });

                if (overlap) return false;
            }
        }

        return true;
    },

    // グリッド拡張
    unlockCell: (gridData, money, r, c) => {
        if (money < GridManager.CELL_UNLOCK_PRICE) return { success: false, reason: '資金不足' };

        // レイアウトチェック
        const layout = GAME_SETTINGS.SHIP_LAYOUT;
        const cellType = layout[r] && layout[r][c];
        if (cellType !== 1) return { success: false, reason: '解放できません' }; // Only type 1 (Unlockable) can be bought

        if (gridData.unlockedCells.some(cell => cell.r === r && cell.c === c)) return { success: false, reason: '解放済み' };

        gridData.unlockedCells.push({ r, c });
        gridData.gridExpansionCostTotal += GridManager.CELL_UNLOCK_PRICE;
        return { success: true, cost: GridManager.CELL_UNLOCK_PRICE };
    },

    // リセット（50%返金）
    resetGrid: (gridData) => {
        const refund = Math.floor(gridData.gridExpansionCostTotal * 0.5);
        const partsToInventory = [...gridData.equippedParts];

        // 初期状態に戻す
        const initial = SaveManager.getInitialGridData();
        gridData.unlockedCells = initial.unlockedCells;
        gridData.equippedParts = initial.equippedParts;
        gridData.gridExpansionCostTotal = 0;

        return { refund, partsToInventory };
    },

    // 統計計算用：装備効果の集約
    calculateBonuses: (equippedParts) => {
        const bonuses = {
            fireRateFactor: 1.0,
            lootRange: 40,
            accelBoost: 0,
            brakeBoost: 0,
            hasMissile: false,
            totalWeight: 0,
            weaponDamage: 10 // 基本攻撃力
        };

        equippedParts.forEach(p => {
            const temp = GridManager.PART_TEMPLATES[p.type];
            if (!temp) return;
            const level = p.level || 0; // Use 0 base if undefined

            // Data Table Lookup
            const upgradeTable = GAME_SETTINGS.PART_UPGRADE_TABLE[p.type];
            const statRow = upgradeTable ? upgradeTable[level] : null;
            const val = statRow ? statRow.ValueTotal : 0;

            const boost = temp.boost || 0; // Fallback for undefined types
            const weight = temp.weight || 0;

            bonuses.totalWeight += weight;

            if (p.type === 'PrimaryWeapon' || temp.Type === 'Main') {
                // For weapons, ValueTotal is the Damage
                // If multiple weapons, we might sum them or average them?
                // Legacy logic added to base 10.
                // New logic: Weapon Damage is separate from "Base Damage".
                // Engine.js handles MainWeapon damage using its own properties.
                // Here we might just track "Bonuses" to base stats if any.
                // Actually, Engine.js uses playState.mainWeapon which is the OBJECT.
                // We should probably NOT calculate weapon damage here if engine handles it.
                // BUT, 'bonuses.weaponDamage' is used as a global adder.
                // Let's assume this is "Extra" damage from modules like WeaponOS.
            }

            if (p.type === 'WeaponOS') bonuses.weaponDamage += val; // WeaponOS val is Damage Bonus
            if (p.type === 'Collector') bonuses.lootRange = val;    // Collector val is Range (Overwrites or Max?) -> Max seems safer or Sum if multiple? Default logic was Sum. Let's use max or sum.
            if (p.type === 'Shield') { /* Implementation needed in Engine */ }

            // Legacy fallbacks or explicit checks
            if (p.type === 'AccelBooster') bonuses.accelBoost += (boost + level * 0.002);
            if (p.type === 'BrakeBooster') bonuses.brakeBoost += (boost + level * 0.02);
            if (p.type === 'Missile' || temp.Type === 'Sub') bonuses.hasMissile = true;
        });

        // 下限設定
        bonuses.fireRateFactor = Math.max(0.2, bonuses.fireRateFactor);
        return bonuses;
    },

    isTypeEquipped: (gridData, type) => {
        return gridData.equippedParts.some(p => p.type === type) ||
            (gridData.warehouse && gridData.warehouse.some(p => p.type === type));
    },

    buyPart: (gameData, type) => {
        const t = GridManager.PART_TEMPLATES[type];
        if (gameData.money < t.price) return { success: false, reason: "資金が不足しています" };
        if (GridManager.isTypeEquipped(gameData.gridData, type)) return { success: false, reason: "既に所持しています" };

        gameData.money -= t.price;
        if (!gameData.gridData.warehouse) gameData.gridData.warehouse = [];
        gameData.gridData.warehouse.push({
            id: `part-${Date.now()}`,
            type: type,
            level: 1
        });
        return { success: true };
    },

    sellPart: (gameData, partId) => {
        const data = gameData.gridData;
        let p, idx;

        // 倉庫内
        idx = data.warehouse.findIndex(x => x.id === partId);
        if (idx !== -1) {
            p = data.warehouse.splice(idx, 1)[0];
        } else {
            // 装備中
            idx = data.equippedParts.findIndex(x => x.id === partId);
            if (idx !== -1) p = data.equippedParts.splice(idx, 1)[0];
        }

        if (p) {
            const t = GridManager.PART_TEMPLATES[p.type];
            gameData.money += Math.floor(t.price * 0.5 * p.level);
            return { success: true };
        }
        return { success: false };
    }
};
