# Gunicorn configuration file for dicta2stream
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8100"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "dicta2stream"

# Server mechanics
daemon = False
pidfile = "/tmp/gunicorn.pid"
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
keyfile = None
certfile = None

# Preload application
preload_app = True

# Max requests
max_requests = 1000
max_requests_jitter = 100

# Python module to import
# Updated for new structure
wsgi_module = "src.backend.main:app"

limit_request_line = 0  # No limit on request line size
limit_request_field_size = 0  # No limit on field size
limit_request_fields = 100  # Limit number of header fields
proxy_allow_ips = "*"
