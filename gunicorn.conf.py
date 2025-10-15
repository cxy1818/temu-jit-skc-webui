# Gunicorn配置文件
import os
import multiprocessing

# 服务器配置
bind = f"0.0.0.0:{os.environ.get('PORT', 5000)}"
workers = int(os.environ.get('WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100
timeout = 120
keepalive = 2

# 进程管理
preload_app = True
daemon = False
pidfile = "/tmp/gunicorn.pid"
user = None
group = None

# 日志配置
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get('LOG_LEVEL', 'info').lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# SSL配置（如果需要）
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"

# 性能优化
worker_tmp_dir = "/dev/shm"
tmp_upload_dir = None

def when_ready(server):
    """服务器启动完成时的回调"""
    server.log.info("SKC管理系统服务器启动完成")

def worker_int(worker):
    """工作进程中断时的回调"""
    worker.log.info("工作进程 %s 被中断", worker.pid)

def pre_fork(server, worker):
    """工作进程fork前的回调"""
    server.log.info("工作进程 %s 即将启动", worker.pid)

def post_fork(server, worker):
    """工作进程fork后的回调"""
    server.log.info("工作进程 %s 已启动", worker.pid)

def pre_exec(server):
    """执行前的回调"""
    server.log.info("服务器即将重新执行")

def on_exit(server):
    """服务器退出时的回调"""
    server.log.info("SKC管理系统服务器正在关闭")

def on_reload(server):
    """服务器重载时的回调"""
    server.log.info("SKC管理系统服务器正在重载")