import json

def find_lists(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{path}.{k}" if path else k
            if isinstance(v, list) and len(v) > 0:
                print(f"List at: {new_path} (len: {len(v)})")
                if len(v) > 0 and isinstance(v[0], dict):
                    keys = list(v[0].keys())
                    print(f"  Keys in first item: {keys}")
            find_lists(v, new_path)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if i == 0: # Only recurse into first item to avoid path explosion
                find_lists(item, f"{path}[0]")

with open('nicole_data.json') as f:
    data = json.load(f)
    find_lists(data)