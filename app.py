from flask import Flask, render_template, redirect, url_for, send_from_directory
from flask_login import LoginManager, login_required, current_user
from config import config
from models import db, User
from auth import auth_bp
from api import api_bp
from cache import cache
import os
import redis

def create_app(config_name=None):
    """应用工厂函数"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # 初始化扩展
    db.init_app(app)
    cache.init_app(app)
    
    # 配置登录管理
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = '请先登录'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # 注册蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    
    # 主路由
    @app.route('/')
    def index():
        """首页"""
        if current_user.is_authenticated:
            return redirect(url_for('dashboard'))
        return redirect(url_for('auth.login'))
    
    @app.route('/dashboard')
    @login_required
    def dashboard():
        """仪表板"""
        return render_template('dashboard.html')
    
    # 静态文件路由 - 用于提供上传的图片
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        """提供上传文件的访问"""
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
    # 错误处理
    @app.errorhandler(404)
    def not_found(error):
        return render_template('errors/404.html'), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return render_template('errors/500.html'), 500
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
        
        # 创建默认管理员用户（仅在开发环境）
        if config_name == 'development':
            admin = User.query.filter_by(username='admin').first()
            if not admin:
                admin = User(
                    username='admin',
                    email='admin@example.com',
                    is_admin=True
                )
                admin.set_password('admin123')
                db.session.add(admin)
                db.session.commit()
                print("创建默认管理员用户: admin / admin123")
    
    # 创建上传目录
    upload_folder = app.config['UPLOAD_FOLDER']
    for subfolder in ['images', 'exports', 'temp']:
        folder_path = os.path.join(upload_folder, subfolder)
        os.makedirs(folder_path, exist_ok=True)
    
    return app

# 主程序入口
if __name__ == '__main__':
    app = create_app()
    
    # 开发环境配置
    if app.config['DEBUG']:
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=True,
            threaded=True
        )
    else:
        # 生产环境使用gunicorn启动
        print("生产环境请使用: gunicorn -w 4 -b 0.0.0.0:5000 app:app")