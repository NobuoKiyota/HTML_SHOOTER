import json
import os

def sync():
    json_dir = "json"
    output_path = "js/settings_data.js"
    
    if not os.path.exists(json_dir):
        print(f"Error: {json_dir} directory not found.")
        return

    # 全JSONファイルを読み込み、ファイル名をキーとして結合
    combined_data = {}
    
    # 既存のキー名に合わせるためのマッピング
    key_mapping = {
        "physics": "PHYSICS",
        "debris": "DEBRIS",
        "weather": "WEATHER",
        "upgrades": "UPGRADES_DATA",
        "parts": "PART_TEMPLATES"
    }

    for filename in os.listdir(json_dir):
        if filename.endswith(".json"):
            key = filename.replace(".json", "")
            final_key = key_mapping.get(key, key.upper())
            
            filepath = os.path.join(json_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                combined_data[final_key] = json.load(f)

    # JSファイルの書き出し
    js_content = f"// Automatically generated from json/ folder\nconst GAME_BALANCE_DATA = {json.dumps(combined_data, indent=4, ensure_ascii=False)};"
    
    os.makedirs("js", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"Successfully synced {json_dir}/ *.json -> {output_path}")

if __name__ == "__main__":
    sync()
