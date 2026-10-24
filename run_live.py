import os
import sys
import subprocess
import re
import time
import urllib.request
import atexit

# Set UTF-8 encoding for stdout/stderr if possible
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

workspace = os.path.dirname(os.path.abspath(__file__))
os.chdir(workspace)

# Determine python executable
python_exe = sys.executable
venv_python = os.path.join(workspace, ".venv", "Scripts", "python.exe")
if os.path.exists(venv_python):
    python_exe = venv_python

print(f"Using Python: {python_exe}")
print("1. Starting Flask Application (app.py)...")
flask_proc = subprocess.Popen(
    [python_exe, "app.py"],
    cwd=workspace,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    encoding="utf-8",
    errors="replace"
)

cf_proc = None

def cleanup():
    print("\nCleaning up processes...")
    if cf_proc:
        try:
            cf_proc.terminate()
        except Exception:
            pass
    try:
        flask_proc.terminate()
    except Exception:
        pass

atexit.register(cleanup)

# Wait for Flask to be healthy
print("Waiting for Flask server on http://127.0.0.1:5000...")
flask_ready = False
for i in range(25):
    try:
        with urllib.request.urlopen("http://127.0.0.1:5000/health", timeout=1) as resp:
            if resp.status == 200:
                flask_ready = True
                print("Flask server is healthy and responding!")
                break
    except Exception:
        time.sleep(0.5)

if not flask_ready:
    print("Note: /health not responding yet, proceeding with tunnel anyway...")

cloudflared_bin = os.path.join(workspace, "cloudflared.exe")
cmd = [cloudflared_bin, "tunnel", "--protocol", "quic", "--edge-ip-version", "4", "--url", "http://127.0.0.1:5000"]

print(f"2. Starting Cloudflare Tunnel using {cloudflared_bin}...")
cf_proc = subprocess.Popen(
    cmd,
    cwd=workspace,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    encoding="utf-8",
    errors="replace"
)

public_url = None
for line in cf_proc.stdout:
    sys.stdout.write(line)
    sys.stdout.flush()
    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
    if match and not public_url:
        public_url = match.group(0)
        with open(os.path.join(workspace, "PUBLIC_LINK.txt"), "w", encoding="utf-8") as f:
            f.write(public_url + "\n")
        print("\n" + "=" * 65)
        print("PUBLIC CLOUDFLARE LINK READY:")
        print("URL: " + public_url)
        print("=" * 65 + "\n")
        sys.stdout.flush()

cf_proc.wait()
flask_proc.wait()
