from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.urls import url_parse
from models import db, User
from datetime import datetime
import re

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

def validate_email(email):
    """验证邮箱格式"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """验证密码强度"""
    if len(password) < 6:
        return False, "密码长度至少6位"
    if not re.search(r'[A-Za-z]', password):
        return False, "密码必须包含字母"
    if not re.search(r'[0-9]', password):
        return False, "密码必须包含数字"
    return True, ""

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """用户登录"""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            username = data.get('username', '').strip()
            password = data.get('password', '')
            remember = data.get('remember', False)
        else:
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '')
            remember = bool(request.form.get('remember'))
        
        if not username or not password:
            if request.is_json:
                return jsonify({'success': False, 'message': '用户名和密码不能为空'})
            flash('用户名和密码不能为空', 'error')
            return render_template('auth/login.html')
        
        # 支持用户名或邮箱登录
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if user and user.check_password(password) and user.is_active:
            # 更新最后登录时间
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            login_user(user, remember=remember)
            
            if request.is_json:
                return jsonify({'success': True, 'message': '登录成功'})
            
            # 重定向到用户原本想访问的页面
            next_page = request.args.get('next')
            if not next_page or url_parse(next_page).netloc != '':
                next_page = url_for('dashboard')
            return redirect(next_page)
        else:
            if request.is_json:
                return jsonify({'success': False, 'message': '用户名或密码错误'})
            flash('用户名或密码错误', 'error')
    
    return render_template('auth/login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """用户注册"""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            password = data.get('password', '')
            confirm_password = data.get('confirm_password', '')
        else:
            username = request.form.get('username', '').strip()
            email = request.form.get('email', '').strip()
            password = request.form.get('password', '')
            confirm_password = request.form.get('confirm_password', '')
        
        # 验证输入
        errors = []
        
        if not username:
            errors.append('用户名不能为空')
        elif len(username) < 3:
            errors.append('用户名长度至少3位')
        elif User.query.filter_by(username=username).first():
            errors.append('用户名已存在')
        
        if not email:
            errors.append('邮箱不能为空')
        elif not validate_email(email):
            errors.append('邮箱格式不正确')
        elif User.query.filter_by(email=email).first():
            errors.append('邮箱已被注册')
        
        if not password:
            errors.append('密码不能为空')
        else:
            is_valid, msg = validate_password(password)
            if not is_valid:
                errors.append(msg)
        
        if password != confirm_password:
            errors.append('两次输入的密码不一致')
        
        if errors:
            if request.is_json:
                return jsonify({'success': False, 'message': '; '.join(errors)})
            for error in errors:
                flash(error, 'error')
            return render_template('auth/register.html')
        
        # 创建新用户
        try:
            user = User(username=username, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            
            if request.is_json:
                return jsonify({'success': True, 'message': '注册成功，请登录'})
            
            flash('注册成功，请登录', 'success')
            return redirect(url_for('auth.login'))
        
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({'success': False, 'message': '注册失败，请重试'})
            flash('注册失败，请重试', 'error')
    
    return render_template('auth/register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    """用户登出"""
    logout_user()
    if request.is_json:
        return jsonify({'success': True, 'message': '已退出登录'})
    flash('已退出登录', 'info')
    return redirect(url_for('auth.login'))

@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    """用户资料"""
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            email = data.get('email', '').strip()
            current_password = data.get('current_password', '')
            new_password = data.get('new_password', '')
            confirm_password = data.get('confirm_password', '')
        else:
            email = request.form.get('email', '').strip()
            current_password = request.form.get('current_password', '')
            new_password = request.form.get('new_password', '')
            confirm_password = request.form.get('confirm_password', '')
        
        errors = []
        
        # 验证邮箱
        if email != current_user.email:
            if not validate_email(email):
                errors.append('邮箱格式不正确')
            elif User.query.filter(User.email == email, User.id != current_user.id).first():
                errors.append('邮箱已被其他用户使用')
        
        # 验证密码修改
        if new_password:
            if not current_user.check_password(current_password):
                errors.append('当前密码错误')
            else:
                is_valid, msg = validate_password(new_password)
                if not is_valid:
                    errors.append(msg)
                elif new_password != confirm_password:
                    errors.append('两次输入的新密码不一致')
        
        if errors:
            if request.is_json:
                return jsonify({'success': False, 'message': '; '.join(errors)})
            for error in errors:
                flash(error, 'error')
            return render_template('auth/profile.html')
        
        # 更新用户信息
        try:
            current_user.email = email
            if new_password:
                current_user.set_password(new_password)
            db.session.commit()
            
            if request.is_json:
                return jsonify({'success': True, 'message': '资料更新成功'})
            flash('资料更新成功', 'success')
        
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({'success': False, 'message': '更新失败，请重试'})
            flash('更新失败，请重试', 'error')
    
    return render_template('auth/profile.html')

@auth_bp.route('/check_username')
def check_username():
    """检查用户名是否可用"""
    username = request.args.get('username', '').strip()
    if not username:
        return jsonify({'available': False, 'message': '用户名不能为空'})
    
    if len(username) < 3:
        return jsonify({'available': False, 'message': '用户名长度至少3位'})
    
    user = User.query.filter_by(username=username).first()
    if user:
        return jsonify({'available': False, 'message': '用户名已存在'})
    
    return jsonify({'available': True, 'message': '用户名可用'})

@auth_bp.route('/check_email')
def check_email():
    """检查邮箱是否可用"""
    email = request.args.get('email', '').strip()
    if not email:
        return jsonify({'available': False, 'message': '邮箱不能为空'})
    
    if not validate_email(email):
        return jsonify({'available': False, 'message': '邮箱格式不正确'})
    
    user = User.query.filter_by(email=email).first()
    if user:
        return jsonify({'available': False, 'message': '邮箱已被注册'})
    
    return jsonify({'available': True, 'message': '邮箱可用'})