import redis
import json
import pickle
from functools import wraps
from flask import current_app
from datetime import datetime, timedelta

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, app=None):
        self.redis_client = None
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """初始化缓存"""
        try:
            redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=False,  # 保持二进制数据
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # 测试连接
            self.redis_client.ping()
            app.logger.info("Redis缓存连接成功")
            
        except Exception as e:
            app.logger.warning(f"Redis连接失败，将使用内存缓存: {e}")
            self.redis_client = None
    
    def _get_key(self, key, prefix='skc'):
        """生成缓存键"""
        return f"{prefix}:{key}"
    
    def get(self, key, default=None):
        """获取缓存"""
        if not self.redis_client:
            return default
        
        try:
            cache_key = self._get_key(key)
            data = self.redis_client.get(cache_key)
            if data:
                return pickle.loads(data)
            return default
        except Exception as e:
            current_app.logger.error(f"缓存获取失败: {e}")
            return default
    
    def set(self, key, value, timeout=3600):
        """设置缓存"""
        if not self.redis_client:
            return False
        
        try:
            cache_key = self._get_key(key)
            data = pickle.dumps(value)
            return self.redis_client.setex(cache_key, timeout, data)
        except Exception as e:
            current_app.logger.error(f"缓存设置失败: {e}")
            return False
    
    def delete(self, key):
        """删除缓存"""
        if not self.redis_client:
            return False
        
        try:
            cache_key = self._get_key(key)
            return self.redis_client.delete(cache_key)
        except Exception as e:
            current_app.logger.error(f"缓存删除失败: {e}")
            return False
    
    def delete_pattern(self, pattern):
        """批量删除缓存"""
        if not self.redis_client:
            return 0
        
        try:
            cache_pattern = self._get_key(pattern)
            keys = self.redis_client.keys(cache_pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            current_app.logger.error(f"批量删除缓存失败: {e}")
            return 0
    
    def exists(self, key):
        """检查缓存是否存在"""
        if not self.redis_client:
            return False
        
        try:
            cache_key = self._get_key(key)
            return self.redis_client.exists(cache_key)
        except Exception as e:
            current_app.logger.error(f"缓存检查失败: {e}")
            return False
    
    def increment(self, key, amount=1):
        """递增计数器"""
        if not self.redis_client:
            return amount
        
        try:
            cache_key = self._get_key(key)
            return self.redis_client.incr(cache_key, amount)
        except Exception as e:
            current_app.logger.error(f"计数器递增失败: {e}")
            return amount
    
    def expire(self, key, timeout):
        """设置过期时间"""
        if not self.redis_client:
            return False
        
        try:
            cache_key = self._get_key(key)
            return self.redis_client.expire(cache_key, timeout)
        except Exception as e:
            current_app.logger.error(f"设置过期时间失败: {e}")
            return False

# 全局缓存实例
cache = CacheManager()

def cached(timeout=3600, key_func=None):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # 默认使用函数名和参数生成键
                key_parts = [func.__name__]
                key_parts.extend(str(arg) for arg in args)
                key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
                cache_key = ":".join(key_parts)
            
            # 尝试从缓存获取
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # 执行函数并缓存结果
            result = func(*args, **kwargs)
            cache.set(cache_key, result, timeout)
            return result
        
        return wrapper
    return decorator

def cache_user_projects(user_id):
    """缓存用户项目列表的键"""
    return f"user:{user_id}:projects"

def cache_project_data(project_id):
    """缓存项目数据的键"""
    return f"project:{project_id}:data"

def cache_project_stats(project_id):
    """缓存项目统计的键"""
    return f"project:{project_id}:stats"

def cache_user_stats(user_id):
    """缓存用户统计的键"""
    return f"user:{user_id}:stats"

def invalidate_user_cache(user_id):
    """清除用户相关缓存"""
    patterns = [
        f"user:{user_id}:*",
        f"*:user:{user_id}:*"
    ]
    
    for pattern in patterns:
        cache.delete_pattern(pattern)

def invalidate_project_cache(project_id):
    """清除项目相关缓存"""
    patterns = [
        f"project:{project_id}:*",
        f"*:project:{project_id}:*"
    ]
    
    for pattern in patterns:
        cache.delete_pattern(pattern)

class RateLimiter:
    """速率限制器"""
    
    def __init__(self, cache_manager=None):
        self.cache = cache_manager or cache
    
    def is_allowed(self, key, limit, window=60):
        """检查是否允许访问"""
        if not self.cache.redis_client:
            return True  # 如果没有Redis，不限制
        
        try:
            current_time = int(datetime.utcnow().timestamp())
            window_start = current_time - window
            
            # 使用滑动窗口算法
            pipe = self.cache.redis_client.pipeline()
            
            # 删除过期的记录
            pipe.zremrangebyscore(key, 0, window_start)
            
            # 获取当前窗口内的请求数
            pipe.zcard(key)
            
            # 添加当前请求
            pipe.zadd(key, {str(current_time): current_time})
            
            # 设置过期时间
            pipe.expire(key, window)
            
            results = pipe.execute()
            current_requests = results[1]
            
            return current_requests < limit
            
        except Exception as e:
            current_app.logger.error(f"速率限制检查失败: {e}")
            return True  # 出错时允许访问

def rate_limit(limit=100, window=60, key_func=None):
    """速率限制装饰器"""
    limiter = RateLimiter()
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成限制键
            if key_func:
                rate_key = key_func(*args, **kwargs)
            else:
                # 默认使用函数名
                rate_key = f"rate_limit:{func.__name__}"
            
            if not limiter.is_allowed(rate_key, limit, window):
                from flask import jsonify
                return jsonify({
                    'success': False,
                    'message': '请求过于频繁，请稍后再试'
                }), 429
            
            return func(*args, **kwargs)
        
        return wrapper
    return decorator

# 会话缓存管理
class SessionCache:
    """会话缓存管理"""
    
    @staticmethod
    def get_user_session_key(user_id):
        """获取用户会话键"""
        return f"session:user:{user_id}"
    
    @staticmethod
    def store_user_session(user_id, session_data, timeout=3600):
        """存储用户会话数据"""
        key = SessionCache.get_user_session_key(user_id)
        return cache.set(key, session_data, timeout)
    
    @staticmethod
    def get_user_session(user_id):
        """获取用户会话数据"""
        key = SessionCache.get_user_session_key(user_id)
        return cache.get(key)
    
    @staticmethod
    def clear_user_session(user_id):
        """清除用户会话"""
        key = SessionCache.get_user_session_key(user_id)
        return cache.delete(key)

# 数据缓存辅助函数
def get_cached_project_list(user_id):
    """获取缓存的项目列表"""
    key = cache_user_projects(user_id)
    return cache.get(key)

def set_cached_project_list(user_id, projects, timeout=1800):
    """设置缓存的项目列表"""
    key = cache_user_projects(user_id)
    return cache.set(key, projects, timeout)

def get_cached_project_stats(project_id):
    """获取缓存的项目统计"""
    key = cache_project_stats(project_id)
    return cache.get(key)

def set_cached_project_stats(project_id, stats, timeout=600):
    """设置缓存的项目统计"""
    key = cache_project_stats(project_id)
    return cache.set(key, stats, timeout)