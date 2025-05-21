bind = "0.0.0.0:8000"
workers = 2  # Tune based on available CPU cores
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 60
keepalive = 30
loglevel = "info"
accesslog = "-"
errorlog = "-"
proxy_allow_ips = "*"

