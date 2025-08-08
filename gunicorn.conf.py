bind = "0.0.0.0:8100"
workers = 2  # Tune based on available CPU cores
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 300  # Increased from 60 to 300 seconds (5 minutes)
keepalive = 30
loglevel = "info"
accesslog = "-"
errorlog = "-"
proxy_allow_ips = "*"
max_requests = 1000
max_requests_jitter = 50
worker_connections = 1000
limit_request_line = 0  # No limit on request line size
limit_request_field_size = 0  # No limit on field size
limit_request_fields = 100  # Limit number of header fields

