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
                // V2 Migration: Ensure new keys exist
                const defaultLevels = { HP: 0, ENGINE: 0, ACCEL: 0, SPEED: 0, BRAKE: 0, WEAPON_OS: 0 };

                // Map old keys if they exist
                if (data.upgradeLevels) {
                    if (data.upgradeLevels.health !== undefined) defaultLevels.HP = data.upgradeLevels.health;
                    if (data.upgradeLevels.speed !== undefined) defaultLevels.SPEED = data.upgradeLevels.speed;
                    if (data.upgradeLevels.accel !== undefined) defaultLevels.ACCEL = data.upgradeLevels.accel;
                    if (data.upgradeLevels.engine_power !== undefined) defaultLevels.ENGINE = data.upgradeLevels.engine_power;
                    // cargo_cap -> engine_power was old migration
                }

                const mergedLevels = Object.assign(defaultLevels, data.upgradeLevels || {});

                // Remove old keys if we want to clean up
                delete mergedLevels.health;
                delete mergedLevels.speed;
                delete mergedLevels.engine_power;
                delete mergedLevels.cargo_cap;
                delete mergedLevels.weapon;

                // キャリア統計のデフォルトとマージ
                const defaultStats = { cleared: 0, started: 0, totalDebrisDestroyed: 0 };
                const mergedStats = Object.assign(defaultStats, data.careerStats || {});

                // グリッドデータのマージ
                let mergedGridData = Object.assign(SaveManager.getInitialGridData(), data.gridData || {});
                if (!mergedGridData.warehouse) mergedGridData.warehouse = [];

                // VALIDATION: Check if grid data matches current SHIP_LAYOUT
                const layout = GAME_SETTINGS.SHIP_LAYOUT;
                const isInvalid = mergedGridData.unlockedCells.some(cell => {
                    // Check bounds
                    if (cell.r >= layout.length || cell.c >= layout[0].length) return true;
                    // Check if cell is Void (0) in new layout
                    return layout[cell.r][cell.c] === 0;
                });

                if (isInvalid) {
                    console.warn("Grid data incompatible with new layout. Resetting grid.");
                    // Keep warehouse items if possible? For now, just reset grid to be safe.
                    // Ideally verify warehouse items are valid. All items in warehouse are just parts, so valid.
                    // Items equipped need to be moved to warehouse or lost.
                    // Let's just reset to initial for simplicity and safety against bugs.
                    const initialGrid = SaveManager.getInitialGridData();
                    // Optional: Try to salvage warehouse
                    initialGrid.warehouse = mergedGridData.warehouse || [];
                    mergedGridData = initialGrid;
                }

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
            money: GAME_SETTINGS.ECONOMY.INITIAL_MONEY || 1000,
            upgradeLevels: { HP: 0, ENGINE: 0, ACCEL: 0, SPEED: 0, BRAKE: 0, WEAPON_OS: 0 },
            partsCount: 0,
            inventory: {},
            careerStats: { cleared: 0, started: 0, totalDebrisDestroyed: 0 },
            gridData: SaveManager.getInitialGridData()
        };
    },

    getInitialGridData: () => {
        const unlocked = [];
        const layout = GAME_SETTINGS.SHIP_LAYOUT;
        // Scan layout for Initial (2) cells
        for (let r = 0; r < layout.length; r++) {
            for (let c = 0; c < layout[r].length; c++) {
                if (layout[r][c] === 2) {
                    unlocked.push({ r, c });
                }
            }
        }

        return {
            unlockedCells: unlocked,
            equippedParts: [
                // Init: 1 BeamGuns at E5
                { id: `part-init-1`, type: 'BeamGun', r: 4, c: 4, level: 1 }
                //{ id: `part-init-2`, type: 'BeamGun', r: 4, c: 5, level: 1 }
            ],
            warehouse: [],
            gridExpansionCostTotal: 0
        };
    },

    reset: () => {
        localStorage.removeItem(SAVE_KEY);
    }
};
