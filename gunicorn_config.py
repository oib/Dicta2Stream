# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8000"

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 120
keepalive = 5

# Security
limit_request_line = 4094
limit_request_fields = 50
limit_request_field_size = 8190

# Debugging
debug = os.getenv("DEBUG", "false").lower() == "true"
reload = debug

# Logging
loglevel = "debug" if debug else "info"
accesslog = "-"  # Log to stdout
errorlog = "-"  # Log to stderr

# Server mechanics
preload_app = True

# Process naming
proc_name = "dicta2stream"
