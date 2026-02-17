/**
 * ゲームの各設定・定数管理 (V5)
 * エクセルから同期されたデータ (GAME_BALANCE_DATA) と定数を統合
 */
const GAME_SETTINGS = {
    // 画面設定
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,

    // エクセル同期データ
    ...GAME_BALANCE_DATA,

    // 自機（プレイヤー）設定
    PLAYER: Object.assign({}, GAME_BALANCE_DATA.PLAYER || {}, {
        BASE_LERP: 0.1,
        BASE_SIZE: 40,
        BASE_FIRE_COOLDOWN: 15,
    }),

    // 弾丸設定
    BULLET: {
        SPEED: 7,
        SIZE: 10,
        DAMAGE: 10,
    },

    // 物理・移動設定 (Fallback defaults)
    PHYSICS: Object.assign({
        MIN_SPEED: 0,
        FRICTION: 0.98,
        BASE_MAX_SPEED: 6.0,
        BASE_ACCEL: 0.05,
        BRAKE_FORCE: 0.2,
        MISSION_SCALE: 100,
        CARGO_HP_BASE: 100,
        MISSILE_COOLDOWN: 60
    }, GAME_BALANCE_DATA.PHYSICS || {}),

    // 敵スポーン設定
    ENEMY: {
        SPAWN_INTERVAL: 60,
        SIZE: 40,
    },

    // 荷物（Cargo）設定
    CARGO: Object.assign({
        WEIGHT_COEFFICIENT: 0.2,
        FIRE_RATE_COEFFICIENT: 0.1,
    }, GAME_BALANCE_DATA.CARGO || {}),

    // 経済設定 (アイテム定義などは固定)
    ECONOMY: {
        INITIAL_MONEY: 500000,
        UPGRADE_COST_BASE: 100,
        ITEMS: {
            "ItemA": { name: "強化合金", rare: 1, type: "material" },
            "ItemB": { name: "高出力チップ", rare: 2, type: "material" },
            "ItemC": { name: "謎のコア", rare: 3, type: "material" },
            "BoostAccel": { name: "加速ブースター", rare: 2, type: "buff", duration: 0 },
            "BoostApex": { name: "APEXブースト", rare: 3, type: "buff", duration: 600 },
            "ItemF": { name: "高純度チタン", rare: 2, type: "material" },
            "ItemG": { name: "反重力ユニット", rare: 3, type: "material" },
            "ItemH": { name: "量子回路", rare: 3, type: "material" },
            "ItemI": { name: "超伝導コイル", rare: 3, type: "material" },
            "ItemJ": { name: "AIニューロコア", rare: 4, type: "material" },
            "ItemK": { name: "ゼロ点エネルギー", rare: 4, type: "material" },
            "ItemL": { name: "ダークマター結晶", rare: 5, type: "material" }
        }
    },

    // アップグレードテーブル (パーツ用) - Excelの代用として動的生成
    PART_UPGRADE_TABLE: (() => {
        const table = {};
        const parts = Object.assign({}, GAME_BALANCE_DATA.WEAPONS || {}, GAME_BALANCE_DATA.PART_TEMPLATES || {});

        // Manual stat definitions since Excel might lack them for Options
        const OVERRIDES = {
            "Collector": { base: 40, scale: 20 }, // Loot Range
            "WeaponOS": { base: 0, scale: 5 },    // Damage Bonus
            "Shield": { base: 0, scale: 2 },      // Dmg Reduction % (approx)
            "ItemEff": { base: 0, scale: 10 },    // Duration %
            "BeamGun": { base: 10, scale: 2 },
            "Missile": { base: 20, scale: 3 },
            "Bomb": { base: 30, scale: 4 },
            "TwinBeam": { base: 18, scale: 3 },
            "Laser": { base: 25, scale: 5 }
        };

        Object.keys(parts).forEach(imgId => {
            const p = parts[imgId];
            const list = [];
            const baseCost = p.UpgradeCost || 1000;
            const costMult = 1.15;

            // Determine Scale Logic
            // If p.Damage exists use it, otherwise check overrides
            const ov = OVERRIDES[imgId] || { base: p.Damage || 0, scale: (p.Damage || 10) * 0.1 };

            for (let lv = 0; lv <= 100; lv++) {
                // Cost Calculation
                const cost = Math.floor(baseCost * Math.pow(costMult, lv));

                // Stat Bonus Calculation
                // ValueTotal = Base + (Level * Scale)
                const val = ov.base + (lv * ov.scale);

                list.push({
                    Level: lv,
                    Cost: cost,
                    ValueTotal: val,
                    MaterialID: (lv % 10 === 0 && lv > 0) ? "ItemA" : null,
                    MaterialCount: Math.floor(lv / 10)
                });
            }
            table[imgId] = list;
            if (p.ID && p.ID !== imgId) table[p.ID] = list;
        });
        return table;
    })(),

    // アップグレード倍率（マッピング）
    UPGRADES: {
        // V2: Derived from UPGRADE_TABLE (Excel).
        // specific increments are now handled by reading the table directly in UpgradeManager/Engine.
        // These keys are kept for compatibility or fallback.
        SPEED_INC: 0.1,
        HEALTH_INC: 10,
        ENGINE_POWER_INC: 2,
        ACCEL_INC: 0.001,
        WEAPON_DAMAGE_INC: 1
    },
    // 船体カスタマイズレイアウト (10x10)
    // 0: Void (■), 1: Unlockable (△), 2: Initial (□)
    SHIP_LAYOUT: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 2, 2, 2, 1, 1, 0],
        [0, 0, 1, 1, 2, 2, 2, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
};

// ステート定義
const GAME_STATE = {
    TITLE: 'TITLE', MENU: 'MENU', UPGRADE: 'UPGRADE',
    MISSION_SELECT: 'MISSION_SELECT', INGAME: 'INGAME',
    RESULT: 'RESULT', FAILURE: 'FAILURE', GRID_MODIFY: 'GRID_MODIFY'
};

const SAVE_KEY = 'HTML5_SHOOTER_SAVE_DATA_V5';
