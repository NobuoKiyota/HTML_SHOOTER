import pandas as pd
import json
import os
import sys
import numpy as np

# Determine Base Directory (tools/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Excel File Path (relative to tools/)
EXCEL_PATH = os.path.join(BASE_DIR, "../game_balance_new.xlsx")
# Output JS File Path (relative to tools/)
JS_OUTPUT_PATH = os.path.join(BASE_DIR, "../js/settings_data.js")

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

def parse_drops(drop_str):
    """Parses drop string 'Item:Rate|Item:Rate' into list of dicts"""
    if not isinstance(drop_str, str) or not drop_str:
        return []
    
    drops = []
    try:
        entries = drop_str.split('|')
        for e in entries:
            if ':' not in e: continue
            parts = e.split(':')
            drops.append({"id": parts[0].strip(), "rate": float(parts[1].strip())})
    except:
        pass
    return drops

def load_excel_data():
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: {EXCEL_PATH} not found.")
        return None

    try:
        xls = pd.ExcelFile(EXCEL_PATH)
        data = {}

        # 1. PHYSICS
        if 'Physics' in xls.sheet_names:
            df = pd.read_excel(xls, 'Physics')
            data['PHYSICS'] = {row['Parameter']: row['Value'] for _, row in df.iterrows()}

        # 2. PLAYER
        if 'Player' in xls.sheet_names:
            df = pd.read_excel(xls, 'Player')
            data['PLAYER'] = {row['Parameter']: row['Value'] for _, row in df.iterrows()}

        # 3. WEAPONS
        if 'Weapons' in xls.sheet_names:
            df = pd.read_excel(xls, 'Weapons')
            data['WEAPONS'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}

        # 4. ENEMIES
        if 'Enemies' in xls.sheet_names:
            df = pd.read_excel(xls, 'Enemies')
            enemies = {}
            for _, row in df.iterrows():
                enemies[row['ID']] = {
                    "id": row['ID'],
                    "name": row['Name'],
                    "model": row.get('Model', 'EnemyShip'),
                    "hp": int(row['HP']),
                    "shield": int(row.get('Shield', 0)),
                    "speed": float(row.get('Speed', 1.0)),
                    "turn": float(row.get('Turn', 1.0)),
                    "damage": int(row.get('Damage', 10)),
                    "movementPattern": row.get('MovementPattern', 'MPID001'),
                    "eqId": row.get('EQ', 'EQID001'),
                    "dropTableId": row.get('DropTable'),
                    "dropCount": int(row.get('DropCount', 1))
                }
            data['ENEMIES'] = enemies
            
            # Cleanup Tiers (for legacy debris spawning if needed, or remove?)
            # Keeping for now as spawnDebris uses it
            tiers = []
            for _, row in df.iterrows():
                 tier_tag = row.get('Tier', 'Tier1')
                 tiers.append({
                     "id": row['ID'],
                     "tier": tier_tag,
                     "hp": int(row['HP']),
                     "shield": int(row.get('Shield', 0)),
                     "speed": float(row['Speed'])
                 })
            data['DEBRIS'] = {"TIERS": tiers}

        # 5. PARTS
        if 'Parts' in xls.sheet_names:
            df = pd.read_excel(xls, 'Parts')
            data['PART_TEMPLATES'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}
            
        # 5b. MATERIALS
        if 'Materials' in xls.sheet_names:
            df = pd.read_excel(xls, 'Materials')
            data['MATERIALS'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}
            
        # 5c. DROP ITEMS
        if 'DropItems' in xls.sheet_names:
            df = pd.read_excel(xls, 'DropItems')
            data['DROP_ITEMS'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}
        
        # 6. UPGRADES
        if 'UpgradeTable' in xls.sheet_names:
            df = pd.read_excel(xls, 'UpgradeTable')
            upgrades = {}
            for _, row in df.iterrows():
                stat = row['StatType']
                if stat not in upgrades: upgrades[stat] = []
                upgrades[stat].append(row.dropna().to_dict())
            data['UPGRADE_TABLE'] = upgrades
        elif 'Upgrades' in xls.sheet_names: 
            df = pd.read_excel(xls, 'Upgrades')
            data['UPGRADES_DATA'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}

        # 7. WEATHER
        if 'Weather' in xls.sheet_names:
            df = pd.read_excel(xls, 'Weather')
            data['WEATHER'] = {row['Key']: row.dropna().to_dict() for _, row in df.iterrows()}

        # 8. STAGES
        if 'Stages' in xls.sheet_names:
            df = pd.read_excel(xls, 'Stages')
            data['STAGES'] = df.to_dict(orient='records')
            
        # 10. NEW SHEETS (V6)
        if 'EnemyWeapons' in xls.sheet_names:
            df = pd.read_excel(xls, 'EnemyWeapons')
            data['ENEMY_WEAPONS'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}
            
        if 'MovementPatterns' in xls.sheet_names:
            df = pd.read_excel(xls, 'MovementPatterns')
            data['MOVEMENT_PATTERNS'] = {row['ID']: row.dropna().to_dict() for _, row in df.iterrows()}
            
        if 'DropTables' in xls.sheet_names:
            df = pd.read_excel(xls, 'DropTables')
            # Group by DTID
            dt = {}
            for _, row in df.iterrows():
                dtid = row['DTID']
                if dtid not in dt: dt[dtid] = []
                dt[dtid].append({
                    "id": row['ItemID'],
                    "rate": float(row['Rate'])
                })
            data['DROP_TABLES'] = dt

        # 9. MISSION_DATA
        mission_data = {}
        if 'MissionScaling' in xls.sheet_names:
            df = pd.read_excel(xls, 'MissionScaling')
            scaling = []
            for _, row in df.iterrows():
                probs = {1: int(row.get('Prob1',0)), 2: int(row.get('Prob2',0)), 3: int(row.get('Prob3',0)), 4: int(row.get('Prob4',0)), 5: int(row.get('Prob5',0))}
                scaling.append({"minStat": int(row['MinStat']), "probs": probs})
            mission_data['DIFFICULTY_SCALING'] = scaling

        if 'MissionParams' in xls.sheet_names:
            df = pd.read_excel(xls, 'MissionParams')
            params = {}
            for _, row in df.iterrows():
                stars = int(row['Stars'])
                params[stars] = {
                    "dist": [int(row['DistMin']), int(row['DistMax'])],
                    "rewardMod": float(row['RewardMod']),
                    "shieldMod": float(row.get('ShieldMod', 1.0)), 
                    "weatherTable": row['WeatherTable'],
                    "enemyTier": row['EnemyTier']
                }
            mission_data['DIFFICULTY_PARAMS'] = params

        if 'WeatherTables' in xls.sheet_names:
            df = pd.read_excel(xls, 'WeatherTables')
            w_tables = {}
            for _, row in df.iterrows():
                tid = row['TableID']
                w_tables[tid] = {
                    "CLEAR": int(row.get('Clear', 0)),
                    "RAIN": int(row.get('Rain', 0)),
                    "SQUALL": int(row.get('Squall', 0)),
                    "HELL": int(row.get('Hell', 0))
                }
            mission_data['WEATHER_TABLES'] = w_tables
        
        if mission_data:
            data['MISSION_DATA'] = mission_data

        return data

    except Exception as e:
        print(f"Error reading Excel: {e}")
        return None

def generate_js(data):
    if not data:
        return

    js_content = "// Automatically generated from game_balance.xlsm\n"
    js_content += "const GAME_BALANCE_DATA = " + json.dumps(data, indent=4, ensure_ascii=False, cls=NumpyEncoder) + ";\n"

    with open(JS_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"Successfully generated {JS_OUTPUT_PATH}")

def create_template_excel():
    pass

def migrate_to_v6():
    """Migrates existing Excel to V6 (New Data Structure: EnemyWeapons, DropTables, MovementPatterns)"""
    if not os.path.exists(EXCEL_PATH):
        print("No existing file to migrate.")
        return

    try:
        print(f"Migrating {EXCEL_PATH} to V6 structure...")
        
        all_sheets = pd.read_excel(EXCEL_PATH, sheet_name=None)
        
        # 1. Create EnemyWeapons Sheet
        if 'EnemyWeapons' not in all_sheets:
            print("Creating EnemyWeapons sheet...")
            weapons_data = [
                {"ID": "EQID001", "Name": "ビームガン", "Damage": 10, "Speed": 10, "Cooltime": 30, "ShotNum": 1, "ShotAngle": "AimPlayer", "Size": "10x10"},
                {"ID": "EQID002", "Name": "ショットガン", "Damage": 5, "Speed": 8, "Cooltime": 60, "ShotNum": 5, "ShotAngle": "Fan", "Size": "8x8"},
                {"ID": "EQID003", "Name": "スナイパーライフル", "Damage": 30, "Speed": 25, "Cooltime": 120, "ShotNum": 1, "ShotAngle": "AimPlayer", "Size": "6x30"},
                {"ID": "EQID004", "Name": "ロケット", "Damage": 20, "Speed": 6, "Cooltime": 90, "ShotNum": 1, "ShotAngle": "AimPlayer", "Size": "20x20"},
                {"ID": "EQID005", "Name": "ミサイル", "Damage": 15, "Speed": 5, "Cooltime": 100, "ShotNum": 1, "ShotAngle": "Homing", "Size": "12x12"},
                {"ID": "EQID006", "Name": "スパイラルショット", "Damage": 8, "Speed": 7, "Cooltime": 45, "ShotNum": 2, "ShotAngle": "Spiral", "Size": "10x10"},
                {"ID": "EQID007", "Name": "ビッグガン", "Damage": 50, "Speed": 4, "Cooltime": 180, "ShotNum": 1, "ShotAngle": "AimPlayer", "Size": "60x60"},
                {"ID": "EQID008", "Name": "ガトリングビーム", "Damage": 3, "Speed": 12, "Cooltime": 5, "ShotNum": 15, "ShotAngle": "RandomSpray", "Size": "5x5"}
            ]
            all_sheets['EnemyWeapons'] = pd.DataFrame(weapons_data)

        # 2. Create MovementPatterns Sheet
        if 'MovementPatterns' not in all_sheets:
            print("Creating MovementPatterns sheet...")
            mp_data = []
            patterns = [
                "直進(上から下)", "直進(下から上)", "直進(右から左)", "直進(左から右)",
                "ジグザグ(上から下)", "ジグザグ(下から上)", "ジグザグ(右から左)", "ジグザグ(左から右)",
                "ホーミング(上から下)", "ホーミング(下から上)", "ホーミング(右から左)", "ホーミング(左から右)",
                "リフレクト(上から下)", "リフレクト(下から上)", "リフレクト(右から左)", "リフレクト(左から右)",
                "ウェーブ(上から下)", "ウェーブ(下から上)", "ウェーブ(右から左)", "ウェーブ(左から右)",
                "スパイラル(上から下)", "スパイラル(下から上)", "スパイラル(右から左)", "スパイラル(左から右)",
                "対面1", "対面2", "対面3", "対面4",
                "方円1", "方円2", "方円3", "方円4"
            ]
            for i, p_name in enumerate(patterns):
                mp_data.append({"ID": f"MPID{i+1:03d}", "Name": p_name, "Logic": "TODO"})
            all_sheets['MovementPatterns'] = pd.DataFrame(mp_data)

        # 3. Create DropTables Sheet
        if 'DropTables' not in all_sheets:
            print("Creating DropTables sheet...")
            dt_data = []
            # Example Data from User
            example_items = [
                ("TypeA", 0.3), ("TypeB", 0.2), ("TypeC", 0.02), ("PU01", 0.05),
                ("OS01", 0.05), ("LU01", 0.05), ("SP01", 0.05), ("SD01", 0.02), ("JL01", 0.01)
            ]
            for item, rate in example_items:
                dt_data.append({"DTID": "DropDT001", "ItemID": item, "Rate": rate})
            all_sheets['DropTables'] = pd.DataFrame(dt_data)
            
        # 4. Update Enemies Sheet
        if 'Enemies' in all_sheets:
            df = all_sheets['Enemies']
            
            # Add New Columns if missing
            if 'Model' not in df.columns: df['Model'] = 'EnemyShip'
            if 'Turn' not in df.columns: df['Turn'] = 1.0
            if 'Damage' not in df.columns: df['Damage'] = 10
            if 'MovementPattern' not in df.columns: df['MovementPattern'] = 'MPID001'
            if 'EQ' not in df.columns: df['EQ'] = 'EQID001'
            if 'DropTable' not in df.columns: df['DropTable'] = 'DropDT001'
            
            # Keep DropCount
            if 'DropCount' not in df.columns: df['DropCount'] = 1

            # Remove old Drop columns
            cols_to_drop = [c for c in df.columns if c.startswith('Drop') and c not in ['DropTable', 'DropCount']]
            if cols_to_drop:
                df.drop(columns=cols_to_drop, inplace=True)
                
            # Reorder
            desired_order = ['ID', 'Name', 'Model', 'HP', 'Speed', 'Turn', 'Damage', 'MovementPattern', 'EQ', 'DropTable', 'DropCount', 'Shield']
            existing = [c for c in desired_order if c in df.columns]
            other = [c for c in df.columns if c not in existing]
            df = df[existing + other]
            
            all_sheets['Enemies'] = df
            
        # Write back
        with pd.ExcelWriter(EXCEL_PATH, engine='openpyxl') as writer:
            for sheet_name, sheet_df in all_sheets.items():
                sheet_df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        print("Migration V6 complete.")

    except Exception as e:
        print(f"Migration V6 failed: {e}")

if __name__ == "__main__":
    os.chdir(BASE_DIR)
    migrate_to_v6()
    data = load_excel_data()
    if data:
        generate_js(data)
