// Automatically generated from json/ folder
const GAME_BALANCE_DATA = {
    "DEBRIS": {
        "TIERS": [
            {
                "id": "small",
                "name": "小惑星破片",
                "color": "#888",
                "hp": 10,
                "speed": 1.5,
                "homing": 0.0,
                "reward": 3
            },
            {
                "id": "medium",
                "name": "宇宙ゴミ",
                "color": "#f80",
                "hp": 30,
                "speed": 1.0,
                "homing": 0.3,
                "reward": 8
            },
            {
                "id": "hostile",
                "name": "軍事デブリ",
                "color": "#f33",
                "hp": 100,
                "speed": 0.8,
                "homing": 1.2,
                "reward": 25
            }
        ]
    },
    "PART_TEMPLATES": {
        "PrimaryWeapon": {
            "name": "初期武装",
            "price": 1200,
            "desc": "基本攻撃。LvUPで威力強化",
            "w": 2,
            "h": 1,
            "color": "#00a2ff",
            "weight": 12
        },
        "Missile": {
            "name": "ミサイル",
            "price": 2500,
            "desc": "自動追尾弾。LvUPで威力強化",
            "w": 1,
            "h": 2,
            "color": "#ff416c",
            "weight": 18
        },
        "FireRateReducer": {
            "name": "連射安定器",
            "price": 1800,
            "desc": "全武器の発射間隔を短縮",
            "w": 1,
            "h": 2,
            "color": "#fa0",
            "weight": 8
        },
        "ItemCollector": {
            "name": "回収アーム",
            "price": 1400,
            "desc": "アイテム回収範囲拡大",
            "w": 2,
            "h": 1,
            "color": "#0f0",
            "weight": 10
        },
        "AccelBooster": {
            "name": "加速拡張",
            "price": 800,
            "desc": "加速を僅かに向上",
            "w": 1,
            "h": 1,
            "color": "#fff",
            "boost": 0.005,
            "weight": 5
        },
        "BrakeBooster": {
            "name": "制動拡張",
            "price": 800,
            "desc": "ブレーキを僅かに向上",
            "w": 1,
            "h": 1,
            "color": "#aaa",
            "boost": 0.05,
            "weight": 5
        }
    },
    "PHYSICS": {
        "BASE_ACCEL": 0.03,
        "BASE_MAX_SPEED": 6.0,
        "MIN_SPEED": 0.5,
        "BRAKE_FORCE": 0.15,
        "FRICTION": 0.99,
        "CARGO_HP_BASE": 100.0,
        "MISSION_SCALE": 85.0,
        "MISSION_DIVISOR": 2000.0,
        "MISSILE_DAMAGE": 40,
        "MISSILE_COOLDOWN": 60
    },
    "UPGRADES_DATA": {
        "speed": {
            "name": "エンジン(最大速度)",
            "inc": 0.2,
            "desc": "船の理論上の限界速度を引き上げます"
        },
        "health": {
            "name": "装甲(HP)",
            "inc": 20.0,
            "desc": "船体HPを上げます"
        },
        "engine_power": {
            "name": "パワーコア(出力)",
            "inc": 10.0,
            "desc": "積載重量による速度低下を抑えます"
        },
        "accel": {
            "name": "高出力ブースター",
            "inc": 0.02,
            "desc": "加速力を上がります"
        }
    },
    "WEATHER": {
        "CLEAR": {
            "name": "快晴",
            "wind": 0.0,
            "rain": 0.0,
            "multiply": 1.0
        },
        "WINDY": {
            "name": "強風",
            "wind": 1.0,
            "rain": 0.0,
            "multiply": 1.3
        },
        "RAINY": {
            "name": "豪雨",
            "wind": 0.5,
            "rain": 0.3,
            "multiply": 1.5
        },
        "STORMY": {
            "name": "嵐",
            "wind": 2.0,
            "rain": 0.5,
            "multiply": 2.0
        }
    }
};