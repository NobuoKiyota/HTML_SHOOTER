import json
import os
import sys

def load_settings_data(filepath):
    """Load settings_data.js and return as dict."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Strip JS variable assignment
            # const GAME_BALANCE_DATA = { ... };
            start = content.find('{')
            end = content.rfind('}') + 1
            json_str = content[start:end]
            # Handle potential JS-only syntax like trailing commas if necessary
            # Standard json might fail on trailing commas.
            # But update_settings.py uses json.dumps so it should be valid JSON.
            return json.loads(json_str)
    except Exception as e:
        print(f"Error loading/parsing settings_data.js: {e}")
        return None

def validate_data(data):
    """Validate cross-references in GAME_BALANCE_DATA."""
    print("--- Starting Validation ---")
    errors = []
    warnings = []

    # 1. Check DEBRIS.TIERS -> ENEMIES
    tiers = data.get('DEBRIS', {}).get('TIERS', [])
    enemies = data.get('ENEMIES', {})
    
    print(f"Checking {len(tiers)} Tiers against {len(enemies)} Enemies...")
    
    for tier in tiers:
        tid = tier.get('id')
        if tid not in enemies:
            errors.append(f"CRITICAL: Tier references Enemy ID '{tid}' which is missing in ENEMIES dict.")
        else:
            # Check Enemy Props
            en = enemies[tid]
            
            # Check Drop Table
            dtId = en.get('dtId')
            if dtId and dtId not in data.get('DROP_TABLES', {}):
                errors.append(f"ERROR: Enemy '{tid}' references missing DropTable '{dtId}'.")
            
            # Check Weapon
            eqId = en.get('eqId')
            if eqId and eqId not in data.get('ENEMY_WEAPONS', {}):
                 errors.append(f"ERROR: Enemy '{tid}' references missing Weapon '{eqId}'.")
                 
            # Check Movement Pattern (Optional, string based switch)
            mpId = en.get('mpId')
            # We don't have a master list of MP IDs in JS yet, but we can verify format?
            if mpId and not mpId.startswith('MP'):
                 warnings.append(f"WARNING: Enemy '{tid}' has unusual MP ID '{mpId}'.")

    # 2. Check DROP_TABLES -> ITEMS/MATERIALS
    drop_tables = data.get('DROP_TABLES', {})
    items = data.get('DROP_ITEMS', {})
    materials = data.get('MATERIALS', {})
    
    print(f"Checking {len(drop_tables)} Drop Tables...")
    
    for dt_id, drops in drop_tables.items():
        if not isinstance(drops, list):
             errors.append(f"ERROR: DropTable '{dt_id}' is not a list.")
             continue
             
        for drop in drops:
            did = drop.get('id')
            if not did: continue
            
            # Check if exists in ITEMS or MATERIALS
            exists = (did in items) or (did in materials)
            if not exists:
                # Might be standard item hardcoded? RepairKit?
                if did not in ['RepairKit', 'Fuel', 'Ammo']:
                    errors.append(f"ERROR: DropTable '{dt_id}' references unknown Item '{did}'.")

    # 3. Check ENEMY_WEAPONS
    weapons = data.get('ENEMY_WEAPONS', {})
    print(f"Checking {len(weapons)} Enemy Weapons...")
    # Just basic check
    for wid, w in weapons.items():
        if 'Damage' not in w and 'damage' not in w:
             warnings.append(f"WARNING: Weapon '{wid}' has no Damage stat.")
             
    # 4. Check WEAPONS (Player)
    p_weapons = data.get('WEAPONS', {})
    print(f"Checking {len(p_weapons)} Player Weapons...")
    for wid, w in p_weapons.items():
        dmg = w.get('Damage', 0)
        if not isinstance(dmg, (int, float)) or dmg < 0:
             errors.append(f"ERROR: Player Weapon '{wid}' has invalid Damage: {dmg}")
        spd = w.get('Speed', 0)
        if not isinstance(spd, (int, float)):
             errors.append(f"ERROR: Player Weapon '{wid}' has invalid Speed: {spd}")

    # 5. Check ENEMIES stats
    print(f"Checking {len(enemies)} Enemy Stats...")
    for eid, e in enemies.items():
        hp = e.get('hp', 0)
        if not isinstance(hp, (int, float)) or hp <= 0:
             warnings.append(f"WARNING: Enemy '{eid}' has invalid HP: {hp}")
        spd = e.get('speed', 0) # speed can be 0 (stationary)
        if not isinstance(spd, (int, float)):
             errors.append(f"ERROR: Enemy '{eid}' has invalid speed: {spd}")

    # Report
    print("\n--- Validation Report ---")
    if errors:
        print(f"Found {len(errors)} ERRORS:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("No CRITICAL errors found.")
        
    if warnings:
        print(f"Found {len(warnings)} WARNINGS:")
        for w in warnings:
            print(f"  - {w}")

    return len(errors) == 0

if __name__ == "__main__":
    filepath = r"F:\MCW_HTML\shooter_game\js\settings_data.js"
    data = load_settings_data(filepath)
    if data:
        validate_data(data)
