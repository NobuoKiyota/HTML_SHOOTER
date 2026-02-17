/**
 * upgrade_config.js
 * 
 * パーツごとの詳細なアップグレードテーブル（Lv0～100）を生成・管理するモジュール。
 * ユーザー指定のバランス調整に基づき、コストとステータスを算出します。
 */

(function () {
    console.log("Initializing Upgrade Configuration... V2");

    if (typeof GAME_SETTINGS === 'undefined') {
        console.error("GAME_SETTINGS is not defined.");
        return;
    }

    if (typeof GAME_BALANCE_DATA === 'undefined') {
        console.error("GAME_BALANCE_DATA is not defined.");
        return;
    }

    // ユーザー指定のパラメーター設定
    // maxValMult: 初期値に対する最大レベル時の倍率 (例: 5.0 = 500%)
    // curve: 'linear' (線形)
    const PARAM_CONFIG = {
        // Player Stats (Treat as special keys in UPGRADE_TABLE)
        "HP": {
            initCost: 500, lastCost: 200000,
            initValMult: 1.0, maxValMult: 5.0, // 500%
            matId: "ItemG", lastMatCount: 20
        },
        "ENGINE": {
            initCost: 800, lastCost: 400000,
            initValMult: 1.0, maxValMult: 6.0, // 600%
            matId: "ItemI", lastMatCount: 30
        },
        "ACCEL": {
            initCost: 400, lastCost: 150000,
            initValMult: 1.0, maxValMult: 1.5, // 150%
            matId: "ItemF", lastMatCount: 20
        },
        "BRAKE": { // Note: Internal key might be BRAKE or similar
            initCost: 300, lastCost: 150000,
            initValMult: 1.0, maxValMult: 1.5, // 150%
            matId: "ItemG", lastMatCount: 10
        },
        "WEAPON_OS": {
            initCost: 2000, lastCost: 800000,
            initValMult: 1.0, maxValMult: 2.0, // 200%
            matId: "ItemK", lastMatCount: 30
        },

        // Weapons
        "BeamGun": {
            initCost: 400, lastCost: 150000,
            initValMult: 1.0, maxValMult: 8.0, // 800%
            matId: "ItemG", lastMatCount: 15
        },
        "Missile": {
            initCost: 800, lastCost: 300000,
            initValMult: 1.0, maxValMult: 6.0, // 600%
            matId: "ItemI", lastMatCount: 20
        },
        "Bomb": {
            initCost: 2500, lastCost: 1200000,
            initValMult: 1.0, maxValMult: 10.0, // 1000%
            matId: "ItemK", lastMatCount: 30
        },
        "TwinBeam": {
            initCost: 1500, lastCost: 180000,
            initValMult: 1.0, maxValMult: 5.0, // 500%
            matId: "ItemH", lastMatCount: 20
        },
        "Laser": {
            initCost: 6000, lastCost: 1500000,
            initValMult: 1.0, maxValMult: 4.0, // 400%
            matId: "ItemL", lastMatCount: 35
        },

        // Options
        "WeaponOS": { // Part (vs Player Stat)
            initCost: 1500, lastCost: 800000,
            initValMult: 1.05, maxValMult: 1.80, // 105% -> 180%
            matId: "ItemJ", lastMatCount: 25
        },
        "Collector": {
            initCost: 1000, lastCost: 600000,
            initValMult: 1.1, maxValMult: 2.0, // 110% -> 200%
            matId: "ItemH", lastMatCount: 20
        },
        "Shield": {
            initCost: 750, lastCost: 400000,
            // Custom Logic: Value is absolute % (5 -> 30)
            isAbsolute: true,
            initVal: 5, maxVal: 30,
            matId: "ItemG", lastMatCount: 20
        },
        "ItemEff": {
            initCost: 500, lastCost: 300000,
            // Custom Logic: Value is absolute % (5 -> 50)
            isAbsolute: true,
            initVal: 5, maxVal: 50,
            matId: "ItemG", lastMatCount: 15
        }
    };

    // --- Helper Functions ---

    // Calculate Growth Factor 'r' for Geometric Series: Start * r^100 = Last
    function getGrowthFactor(start, last, levels) {
        if (start <= 0 || last <= 0) return 1.0;
        return Math.pow(last / start, 1 / levels);
    }

    // Generate Table
    GAME_SETTINGS.PART_UPGRADE_TABLE = (() => {
        const table = {};

        // Merge definitions (Weapons + Parts + Player Stats Placeholders)
        const parts = Object.assign({}, GAME_BALANCE_DATA.WEAPONS || {}, GAME_BALANCE_DATA.PART_TEMPLATES || {});

        // Also simulate Player Stats as 'parts' for table generation consistency if needed,
        // but typically Engine reads 'UPGRADE_TABLE' for stats.
        // We will inject these into PART_UPGRADE_TABLE for valid lookup by ID.
        ["HP", "ENGINE", "ACCEL", "BRAKE", "WEAPON_OS"].forEach(key => {
            parts[key] = { ID: key, Name: key }; // Dummy object
        });

        Object.keys(parts).forEach(imgId => {
            const config = PARAM_CONFIG[imgId];
            if (!config) {
                // Fallback for unconfigured parts
                table[imgId] = [];
                return;
            }

            const list = [];
            const r = getGrowthFactor(config.initCost, config.lastCost, 100);

            // Get base value from data if not absolute
            let baseVal = 0;
            if (GAME_BALANCE_DATA.PLAYER[imgId] !== undefined) baseVal = GAME_BALANCE_DATA.PLAYER[imgId];
            else if (parts[imgId] && parts[imgId].Damage) baseVal = parts[imgId].Damage;
            else if (config.initVal) baseVal = config.initVal; // Use config init as base base

            for (let lv = 0; lv <= 100; lv++) {
                // Cost: Geometric
                const cost = Math.floor(config.initCost * Math.pow(r, lv));

                // Value: Linear interpolation
                let val = 0;
                if (config.isAbsolute) {
                    // Absolute Range (e.g. 5 to 30)
                    val = config.initVal + (config.maxVal - config.initVal) * (lv / 100);
                } else {
                    // Multiplier Range (e.g. 100% to 500% of Base)
                    // If Base is 0 (e.g. overrides), assume 10 or logic needs context.
                    // Actually, for Weapons, we want the Total Value to be Base * Mult.
                    // For Stats, it's typically an ADDITIVE bonus.
                    // Let's assume standard behavior: ValueTotal = Base * currentMult.

                    const currentMult = config.initValMult + (config.maxValMult - config.initValMult) * (lv / 100);

                    // Special Handling for Player Stats (Additive Bonus)
                    // If HP Base is 100, and we want 500% (500), the Bonus is 400.
                    // But here we store ValueTotal or ValuePlus?
                    // Previous logic used ValuePlus.
                    // Let's calculate TargetValue first.
                    const targetVal = (baseVal || 10) * currentMult; // Default 10 if missing

                    // Store strict value. 
                    // Engine will decide if it replaces base or adds to it.
                    // For Part Table, we usually store the EFFECTIVE value.
                    val = Math.floor(targetVal);

                    // If it is a Player Stat, we might want to store the BONUS (Target - Base).
                    if (["HP", "ENGINE", "ACCEL", "BRAKE", "WEAPON_OS"].includes(imgId)) {
                        val = Math.floor(targetVal - baseVal);
                    }
                }

                // Material Count: Linear scaling
                // Start appearing from Lv 10? or Lv 1? User implies End is specific count.
                // Let's smooth it: 1 at Lv10 ... Max at Lv100.
                let matCount = 0;
                if (lv >= 10) {
                    matCount = Math.floor(1 + (config.lastMatCount - 1) * ((lv - 10) / 90));
                }

                list.push({
                    Level: lv,
                    Cost: cost,
                    ValueTotal: val, // Effective Value or Bonus
                    MaterialID: (lv > 0 && lv % 10 === 0) ? config.matId : null,
                    MaterialCount: (lv > 0 && lv % 10 === 0) ? matCount : 0
                });
            }

            table[imgId] = list;
            // Map ID alias
            const p = parts[imgId];
            if (p.ID && p.ID !== imgId) table[p.ID] = list;
        });

        console.log("PART_UPGRADE_TABLE Generated V2 with User Specs");
        // Inject into global for Engine use (Player Stats need special handling in Engine)
        GAME_BALANCE_DATA.UPGRADE_TABLE = GAME_BALANCE_DATA.UPGRADE_TABLE || {};
        Object.assign(GAME_BALANCE_DATA.UPGRADE_TABLE, table); // Merge so Engine's getVal finds it

        return table;
    })();

})();
