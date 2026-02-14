/**
 * 船体グリッド改造管理クラス
 * Tetris風のパーツ配置、ドラッグ＆ドロップ、グリッド拡張を制御
 */
const GridManager = {
    // パーツ定義 (settings_data.js から取得)
    get PART_TEMPLATES() {
        return GAME_SETTINGS.PART_TEMPLATES || {};
    },

    GRID_MAX_SIZE: 10,
    CELL_UNLOCK_PRICE: 500, // 1マスあたりの価格

    // 配置検証
    isValidPlacement: (gridData, partType, row, col, movingPartIndex = -1) => {
        const template = GridManager.PART_TEMPLATES[partType];
        if (!template) return false;

        // 範囲外チェック
        for (let r = row; r < row + template.h; r++) {
            for (let c = col; c < col + template.w; c++) {
                // 解放されているか
                const isUnlocked = gridData.unlockedCells.some(cell => cell.r === r && cell.c === c);
                if (!isUnlocked) return false;

                // 他のパーツと重なっていないか
                const overlap = gridData.equippedParts.some((p, idx) => {
                    if (idx === movingPartIndex) return false;
                    const pt = GridManager.PART_TEMPLATES[p.type];
                    return (r >= p.r && r < p.r + pt.h && c >= p.c && c < p.c + pt.w);
                });
                if (overlap) return false;
            }
        }
        return true;
    },

    // グリッド拡張
    unlockCell: (gridData, money, r, c) => {
        if (money < GridManager.CELL_UNLOCK_PRICE) return { success: false, reason: '資金不足' };
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
            const level = p.level || 1;
            const boost = temp.boost || 0;
            const weight = temp.weight || 0;

            bonuses.totalWeight += weight;

            if (p.type === 'PrimaryWeapon') bonuses.weaponDamage += (10 * level);
            if (p.type === 'FireRateReducer') bonuses.fireRateFactor -= (0.1 + level * 0.02);
            if (p.type === 'ItemCollector') bonuses.lootRange += (40 + level * 20);
            if (p.type === 'AccelBooster') bonuses.accelBoost += (boost + level * 0.002);
            if (p.type === 'BrakeBooster') bonuses.brakeBoost += (boost + level * 0.02);
            if (p.type === 'Missile') bonuses.hasMissile = true;
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
