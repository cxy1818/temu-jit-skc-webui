from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """用户表"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # 关联关系
    projects = db.relationship('Project', backref='owner', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password):
        """设置密码"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """验证密码"""
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Project(db.Model):
    """项目表"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # 关联关系
    products = db.relationship('Product', backref='project', lazy='dynamic', cascade='all, delete-orphan')
    
    # 复合索引，确保同一用户下项目名唯一
    __table_args__ = (
        db.UniqueConstraint('user_id', 'name', name='uq_user_project_name'),
        db.Index('idx_user_project', 'user_id', 'is_active'),
    )
    
    def __repr__(self):
        return f'<Project {self.name}>'

class Product(db.Model):
    """产品表"""
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    skcs = db.relationship('SKC', backref='product', lazy='dynamic', cascade='all, delete-orphan')
    images = db.relationship('ProductImage', backref='product', lazy='dynamic', cascade='all, delete-orphan')
    
    # 复合索引，确保同一项目下产品名唯一
    __table_args__ = (
        db.UniqueConstraint('project_id', 'name', name='uq_project_product_name'),
        db.Index('idx_project_product', 'project_id', 'name'),
    )
    
    def __repr__(self):
        return f'<Product {self.name}>'

class SKC(db.Model):
    """SKC表"""
    __tablename__ = 'skcs'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(100), nullable=False, index=True)
    status = db.Column(db.String(50), nullable=False, default='核价通过')
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 复合索引，确保SKC代码全局唯一
    __table_args__ = (
        db.UniqueConstraint('code', name='uq_skc_code'),
        db.Index('idx_product_skc', 'product_id', 'status'),
        db.Index('idx_skc_code_status', 'code', 'status'),
    )
    
    def __repr__(self):
        return f'<SKC {self.code}>'

class ProductImage(db.Model):
    """产品图片表"""
    __tablename__ = 'product_images'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_primary = db.Column(db.Boolean, default=False)
    
    __table_args__ = (
        db.Index('idx_product_image', 'product_id', 'is_primary'),
    )
    
    def __repr__(self):
        return f'<ProductImage {self.filename}>'

class ExcelExport(db.Model):
    """Excel导出记录表"""
    __tablename__ = 'excel_exports'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    file_size = db.Column(db.Integer)
    
    # 关联关系
    project = db.relationship('Project', backref='excel_exports')
    user = db.relationship('User', backref='excel_exports')
    
    __table_args__ = (
        db.Index('idx_project_export', 'project_id', 'created_at'),
        db.Index('idx_user_export', 'user_id', 'created_at'),
    )
    
    def __repr__(self):
        return f'<ExcelExport {self.filename}>'

# 状态选项常量
STATUS_OPTIONS = [
    "核价通过", "拉过库存", "已下架", "价格待定", 
    "减少库存为0", "改过体积", "价格错误"
]