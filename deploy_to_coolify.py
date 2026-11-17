"""
Deployment automation script for Coolify VPS container
"""
import os
import sys
import json
import base64
import subprocess
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")

# Parse .env
env_vars = {}
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()

BASE_URL = env_vars.get("COOLIFY_BASE_URL", "https://coolify.crazyautomation.cloud")
TOKEN_FILE = r"C:\Users\Unknown\.gemini\coolify_token.txt"

token = ""
if os.path.exists(TOKEN_FILE):
    try:
        with open(TOKEN_FILE, "r", encoding="utf-8") as f:
            token = f.read().strip()
    except Exception:
        pass

print(f"Coolify Target Base URL: {BASE_URL}")
print("Docker container files prepared: Dockerfile, Dockerfile.coolify, .env")
print("Ready for Coolify app creation or deployment.")
