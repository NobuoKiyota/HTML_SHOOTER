const UpgradeManager = {
    // 強化項目の定義
    getUpgradeSpecs: (levels) => {
        const base = GAME_SETTINGS.ECONOMY.UPGRADE_COST_BASE;
        const data = GAME_SETTINGS.UPGRADES_DATA;

        return [
            {
                id: 'speed',
                name: data.speed.name,
                desc: data.speed.desc,
                level: levels.speed || 0,
                cost: base * (1 + (levels.speed || 0))
            },
            {
                id: 'accel',
                name: data.accel.name,
                desc: data.accel.desc,
                level: levels.accel || 0,
                cost: base * 1.2 * (1 + (levels.accel || 0))
            },
            {
                id: 'health',
                name: data.health.name,
                desc: data.health.desc,
                level: levels.health || 0,
                cost: base * (1 + (levels.health || 0))
            },
            {
                id: 'engine_power',
                name: data.engine_power.name,
                desc: data.engine_power.desc,
                level: levels.engine_power || 0,
                cost: base * 1.5 * (1 + (levels.engine_power || 0))
            }
        ];
    }
};
