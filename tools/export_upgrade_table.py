
import pandas as pd
import json
import os
import math

# Path handling
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JS_PATH = os.path.join(BASE_DIR, '../js/settings_data.js')
OUTPUT_PATH = os.path.join(BASE_DIR, '../upgrade_table_gen.xlsx')

def load_settings_data():
    """Reads settings_data.js and extracts the GAME_BALANCE_DATA JSON object."""
    try:
        with open(JS_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            # Strip the variable declaration "const GAME_BALANCE_DATA = "
            start_index = content.find('{')
            end_index = content.rfind('};')
            if start_index != -1 and end_index != -1:
                json_str = content[start_index:end_index+1]
                return json.loads(json_str)
    except Exception as e:
        print(f"Error reading settings_data.js: {e}")
        return None

def generate_table(data):
    """Replicates upgrade_config.js logic to generate the table."""
    parts = {}
    if 'WEAPONS' in data:
        parts.update(data['WEAPONS'])
    if 'PART_TEMPLATES' in data:
        parts.update(data['PART_TEMPLATES'])

    # Overrides from upgrade_config.js
    OVERRIDES = {
        "Collector": { "base": 40, "scale": 20 }, 
        "WeaponOS": { "base": 0, "scale": 5 },    
        "Shield": { "base": 0, "scale": 2 },      
        "ItemEff": { "base": 0, "scale": 10 },    
        "BeamGun": { "base": 10, "scale": 2 },
        "Missile": { "base": 20, "scale": 3 },
        "Bomb": { "base": 30, "scale": 4 },
        "TwinBeam": { "base": 18, "scale": 3 },
        "Laser": { "base": 25, "scale": 5 }
    }

    all_rows = []

    for img_id, p in parts.items():
        base_cost = p.get('UpgradeCost', 1000)
        cost_mult = 1.15
        
        ov = OVERRIDES.get(img_id)
        if not ov:
            damage = p.get('Damage', 10)
            ov = { "base": damage, "scale": damage * 0.1 }

        for lv in range(101): # 0 to 100
            cost = math.floor(base_cost * math.pow(cost_mult, lv))
            val = ov["base"] + (lv * ov["scale"])
            
            row = {
                "PartID": img_id,
                "Name": p.get('Name', img_id),
                "Level": lv,
                "Cost": cost,
                "ValueTotal": val,
                "MaterialID": "ItemA" if (lv % 10 == 0 and lv > 0) else "",
                "MaterialCount": math.floor(lv / 10)
            }
            all_rows.append(row)

    return pd.DataFrame(all_rows)

def main():
    print("Loading data...")
    data = load_settings_data()
    if not data:
        return

    print("Generating table...")
    df = generate_table(data)
    
    print(f"Exporting to {OUTPUT_PATH}...")
    df.to_excel(OUTPUT_PATH, index=False)
    print("Done!")

if __name__ == "__main__":
    main()
