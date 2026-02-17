const UpgradeManager = {
    // 強化対象のキーとその表示名
    TARGET_STATS: {
        "HP": "Hull Armor (HP)",
        "ENGINE": "Engine Output",
        "ACCEL": "Thruster Accel",
        "BRAKE": "Braking System",
        "WEAPON_OS": "Fire Control OS"
    },

    getUpgradeSpecs: (levels) => {
        const table = GAME_BALANCE_DATA.UPGRADE_TABLE;
        if (!table) return [];

        return Object.keys(UpgradeManager.TARGET_STATS).map(key => {
            const rows = table[key];
            if (!rows) return null;

            const name = UpgradeManager.TARGET_STATS[key];
            // Treat user level as index. 0-based index matches Level.
            // But usually level starts at 0? Yes.
            // If current level is 0, we want to buy level 1.
            const currentLv = levels[key] || 0;
            const maxLv = rows.length - 1; // e.g., 100

            if (currentLv >= maxLv) {
                return {
                    id: key,
                    name: name,
                    level: currentLv,
                    isMax: true
                };
            }

            // Next level data
            const nextRow = rows[currentLv + 1];
            if (!nextRow) return null; // Should not happen if < maxLv

            return {
                id: key,
                name: name,
                level: currentLv,
                isMax: false,
                cost: nextRow.Cost,
                nextValue: nextRow.ValueTotal, // Display total value (e.g. +500)
                materialId: nextRow.MaterialID,
                materialCount: nextRow.MaterialCount
            };
        }).filter(s => s !== null);
    }
};
