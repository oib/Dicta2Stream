# log.py — Logging of abuse or violations in dicta2stream

from datetime import datetime

import os
from datetime import datetime

def log_violation(event: str, ip: str, uid: str, reason: str):
    timestamp = datetime.utcnow().isoformat()
    log_dir = os.path.join(os.path.dirname(__file__), "log")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "abuse.log")
    log_entry = f"[{timestamp}] {event} IP={ip} UID={uid} REASON={reason}\n"
    with open(log_path, "a") as f:
        f.write(log_entry)
    # If DEBUG mode, also print to stdout
    if os.getenv("DEBUG", "0") in ("1", "true", "True"):  # Set DEBUG=1 in .env to enable
        # Debug messages disabled
        pass

