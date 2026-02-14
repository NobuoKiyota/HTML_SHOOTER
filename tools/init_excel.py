import pandas as pd
import os

def create_initial_excel():
    # Physics Sheet
    physics_df = pd.DataFrame([
        {"Parameter": "BASE_ACCEL", "Value": 0.03, "Description": "基本加速力 (低いほどなめらか)"},
        {"Parameter": "BASE_MAX_SPEED", "Value": 6.0, "Description": "基本最高速度"},
        {"Parameter": "MIN_SPEED", "Value": 0.5, "Description": "ブレーキによる最低速度 (0にすると停止可能)"},
        {"Parameter": "BRAKE_FORCE", "Value": 0.15, "Description": "ブレーキ力"},
        {"Parameter": "FRICTION", "Value": 0.99, "Description": "慣性（1に近いほど滑る）"},
        {"Parameter": "CARGO_HP_BASE", "Value": 100, "Description": "荷物の基本耐久力"},
        {"Parameter": "MISSION_SCALE", "Value": 120, "Description": "距離減算係数 (大きいほどクリアが早い)"}
    ])

    # Debris Sheet
    debris_df = pd.DataFrame([
        {"ID": "small", "Name": "小惑星破片", "Color": "#888", "HP": 10, "Speed": 1.5, "Homing": 0, "Reward": 5},
        {"ID": "medium", "Name": "宇宙ゴミ", "Color": "#f80", "HP": 30, "Speed": 1.0, "Homing": 0.3, "Reward": 15},
        {"ID": "hostile", "Name": "軍事デブリ", "Color": "#f33", "HP": 60, "Speed": 0.8, "Homing": 0.8, "Reward": 50}
    ])

    # Weather Sheet
    weather_df = pd.DataFrame([
        {"Key": "CLEAR", "Name": "快晴", "Wind": 0.0, "Rain": 0.0, "Multiply": 1.0},
        {"Key": "WINDY", "Name": "強風", "Wind": 1.0, "Rain": 0.0, "Multiply": 1.3},
        {"Key": "RAINY", "Name": "豪雨", "Wind": 0.5, "Rain": 0.3, "Multiply": 1.5},
        {"Key": "STORMY", "Name": "嵐", "Wind": 2.0, "Rain": 0.5, "Multiply": 2.0}
    ])

    # Upgrades Sheet
    upgrades_df = pd.DataFrame([
        {"ID": "speed", "Name": "エンジン(速度)", "Inc": 0.15, "Desc": "最高速度を上げます"},
        {"ID": "health", "Name": "装甲(HP)", "Inc": 20.0, "Desc": "船体HPを上げます"},
        {"ID": "cargo_cap", "Name": "大型コンテナ", "Inc": 10.0, "Desc": "重さによる影響を減らします"},
        {"ID": "weapon", "Name": "武装(威力)", "Inc": 8.0, "Desc": "弾の攻撃力を上げます"},
        {"ID": "accel", "Name": "高出力ブースター", "Inc": 0.02, "Desc": "加速力が上がります"}
    ])

    os.makedirs("tools", exist_ok=True)
    with pd.ExcelWriter("game_balance.xlsx") as writer:
        physics_df.to_excel(writer, sheet_name="Physics", index=False)
        debris_df.to_excel(writer, sheet_name="Debris", index=False)
        weather_df.to_excel(writer, sheet_name="Weather", index=False)
        upgrades_df.to_excel(writer, sheet_name="Upgrades", index=False)

    print("Created game_balance.xlsx")

if __name__ == "__main__":
    create_initial_excel()
