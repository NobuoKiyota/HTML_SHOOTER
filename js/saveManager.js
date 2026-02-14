/**
 * 改修版セーブデータ管理
 */
const SaveManager = {
    save: (data) => {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) { console.error('Save failed', e); }
    },

    load: () => {
        const savedData = localStorage.getItem(SAVE_KEY);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                // 既存のレベルに最新のキーをマージして undefined を防ぐ
                const defaultLevels = { speed: 0, health: 0, engine_power: 0, accel: 0 };
                // 移行処理: cargo_cap -> engine_power
                if (data.upgradeLevels && data.upgradeLevels.cargo_cap !== undefined) {
                    data.upgradeLevels.engine_power = data.upgradeLevels.cargo_cap;
                    delete data.upgradeLevels.cargo_cap;
                }
                const mergedLevels = Object.assign(defaultLevels, data.upgradeLevels || {});
                delete mergedLevels.weapon; // 武器強化は廃止

                // キャリア統計のデフォルトとマージ
                const defaultStats = { cleared: 0, started: 0, totalDebrisDestroyed: 0 };
                const mergedStats = Object.assign(defaultStats, data.careerStats || {});

                // グリッドデータのマージ
                const mergedGridData = Object.assign(SaveManager.getInitialGridData(), data.gridData || {});
                if (!mergedGridData.warehouse) mergedGridData.warehouse = [];

                return {
                    money: data.money !== undefined ? data.money : 100,
                    upgradeLevels: mergedLevels,
                    partsCount: data.partsCount || 0,
                    inventory: data.inventory || {},
                    careerStats: mergedStats,
                    gridData: mergedGridData
                };
            } catch (e) {
                console.error('Load failed, using initial data', e);
                return SaveManager.getInitialData();
            }
        }
        return SaveManager.getInitialData();
    },

    getInitialData: () => {
        return {
            money: GAME_SETTINGS.ECONOMY.INITIAL_MONEY || 100,
            upgradeLevels: { speed: 0, health: 0, cargo_cap: 0, weapon: 0, accel: 0 },
            partsCount: 0,
            inventory: {},
            careerStats: { cleared: 0, started: 0, totalDebrisDestroyed: 0 },
            gridData: SaveManager.getInitialGridData()
        };
    },

    getInitialGridData: () => {
        const unlocked = [];
        // 初期 2x3 (row 0..1, col 0..2)
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
                unlocked.push({ r, c });
            }
        }
        return {
            unlockedCells: unlocked,
            equippedParts: [
                { id: `part-${Date.now()}`, type: 'PrimaryWeapon', r: 0, c: 0, level: 1 }
            ],
            warehouse: [],
            gridExpansionCostTotal: 0
        };
    },

    reset: () => {
        localStorage.removeItem(SAVE_KEY);
    }
};
