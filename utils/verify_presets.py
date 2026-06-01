import os
import re

presets_dir = "presets"
root_dir = "."

def verify():
    presets = [f for f in os.listdir(presets_dir) if f.endswith(".txt")]
    missing_count = 0
    for preset in sorted(presets):
        preset_path = os.path.join(presets_dir, preset)
        with open(preset_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Regex to find references starting with @ or lists/
        # Matches: @lua/..., @bin/..., @windivert.filter/..., lists/...
        refs = re.findall(r'(?:@|lists/)[a-zA-Z0-9_\-\.\/]+', content)
        
        for ref in refs:
            # Strip the '@' if it exists
            rel_path = ref[1:] if ref.startswith("@") else ref
            
            # Remove any trailing commas or colons that might be matched
            rel_path = rel_path.rstrip(",:")
            
            # Resolve against root directory
            full_path = os.path.normpath(os.path.join(root_dir, rel_path))
            
            # Ignore built-in variables or values like @active-preset or similar if any
            if rel_path.startswith("bin/fake_default_udp") or rel_path.startswith("bin/fake_default_quic"):
                continue
                
            if not os.path.exists(full_path):
                print(f"[-] MISSING in {preset}: {rel_path} (resolved: {full_path})")
                missing_count += 1
                
    if missing_count == 0:
        print("[+] SUCCESS: All referenced files exist in the repository!")
    else:
        print(f"[!] FAILED: Found {missing_count} missing files.")

if __name__ == "__main__":
    verify()
