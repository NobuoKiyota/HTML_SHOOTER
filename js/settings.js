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
    PLAYER: {
        BASE_LERP: 0.1,
        BASE_SIZE: 40,
        BASE_FIRE_COOLDOWN: 15,
    },

    // 弾丸設定
    BULLET: {
        SPEED: 7,
        SIZE: 10,
        DAMAGE: 10,
    },

    // 敵スポーン設定
    ENEMY: {
        SPAWN_INTERVAL: 60,
        SIZE: 40,
    },

    // 荷物（Cargo）設定
    CARGO: {
        WEIGHT_COEFFICIENT: 0.2,
        FIRE_RATE_COEFFICIENT: 0.1,
    },

    // 経済設定 (アイテム定義などは固定)
    ECONOMY: {
        INITIAL_MONEY: 100,
        UPGRADE_COST_BASE: 100,
        ITEMS: {
            "ItemA": { name: "強化合金", rare: 1, type: "material" },
            "ItemB": { name: "高出力チップ", rare: 2, type: "material" },
            "ItemC": { name: "謎のコア", rare: 3, type: "material" },
            "BoostAccel": { name: "加速ブースター", rare: 2, type: "buff", duration: 0 },
            "BoostApex": { name: "APEXブースト", rare: 3, type: "buff", duration: 600 }
        }
    },

    // アップグレード倍率（マッピング）
    UPGRADES: {
        SPEED_INC: GAME_BALANCE_DATA.UPGRADES_DATA.speed.inc,
        HEALTH_INC: GAME_BALANCE_DATA.UPGRADES_DATA.health.inc,
        ENGINE_POWER_INC: GAME_BALANCE_DATA.UPGRADES_DATA.engine_power.inc,
        ACCEL_INC: GAME_BALANCE_DATA.UPGRADES_DATA.accel.inc
    }
};

// ステート定義
const GAME_STATE = {
    TITLE: 'TITLE', MENU: 'MENU', UPGRADE: 'UPGRADE',
    MISSION_SELECT: 'MISSION_SELECT', INGAME: 'INGAME',
    RESULT: 'RESULT', FAILURE: 'FAILURE', GRID_MODIFY: 'GRID_MODIFY'
};

const SAVE_KEY = 'HTML5_SHOOTER_SAVE_DATA_V5';
