# SKC管理系统 Web版
temu平台jit模式，skc管理，支持多种商品状态，如下架，拉过库存等
这是一个基于Flask的SKC（Stock Keeping Code）管理系统，支持多用户、高并发访问，提供完整的Web界面来管理产品和SKC数据。

## 功能特性

- 🔐 **用户认证系统** - 支持用户注册、登录、权限管理
- 📁 **项目管理** - 多项目支持，每个用户可以创建和管理多个项目
- 📦 **产品管理** - 产品信息管理，支持图片上传
- 🏷️ **SKC管理** - SKC代码管理，支持批量操作
- 📊 **状态管理** - 多种状态选项，支持批量修改
- 📤 **Excel导入导出** - 支持Excel文件的导入和导出
- 🖼️ **图片管理** - 产品图片上传和管理
- ⚡ **高性能** - Redis缓存、数据库连接池，支持高并发
- 🐳 **容器化部署** - 支持Docker部署

## 技术栈

- **后端**: Flask + SQLAlchemy + Redis
- **前端**: Bootstrap 5 + jQuery + Font Awesome
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **缓存**: Redis
- **部署**: Docker + Gunicorn + Nginx

## 快速开始

### 1. 环境要求

- Python 3.8+
- Redis (可选，用于缓存)
- PostgreSQL (生产环境推荐)

### 2. 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd skc-manager-web

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，设置必要的配置
```

### 4. 初始化数据库

```bash
# 运行应用会自动创建数据库表
python run.py
```

### 5. 启动应用

#### 开发环境

```bash
# 使用内置服务器
python run.py --env development --debug

# 或者直接运行
python app.py
```

#### 生产环境

```bash
# 使用Gunicorn
gunicorn --config gunicorn.conf.py app:create_app()

# 或者使用启动脚本
python run.py --env production --workers 4
```

### 6. 访问应用

打开浏览器访问 `http://localhost:5000`

默认管理员账户（开发环境）:
- 用户名: `admin`
- 密码: `admin123`

## Docker部署

### 使用Docker Compose（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 单独使用Docker

```bash
# 构建镜像
docker build -t skc-manager .

# 运行容器
docker run -d -p 5000:5000 --name skc-manager skc-manager
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FLASK_ENV` | 运行环境 | `development` |
| `SECRET_KEY` | Flask密钥 | 随机生成 |
| `DATABASE_URL` | 数据库连接 | `sqlite:///skc_manager.db` |
| `REDIS_URL` | Redis连接 | `redis://localhost:6379/0` |
| `UPLOAD_FOLDER` | 上传目录 | `uploads` |

### 数据库配置

#### SQLite（开发环境）
```
DATABASE_URL=sqlite:///skc_manager.db
```

#### PostgreSQL（生产环境）
```
DATABASE_URL=postgresql://username:password@localhost/skc_manager
```

## API文档

系统提供RESTful API接口，主要端点包括：

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/{id}/products` - 获取产品列表
- `POST /api/products/{id}/skcs` - 添加SKC
- `PUT /api/skcs/batch_update` - 批量更新SKC
- `POST /api/projects/{id}/export` - 导出Excel

详细API文档请参考代码中的注释。

## 功能使用

### 1. 项目管理
- 创建新项目
- 切换项目
- 导入/导出项目数据

### 2. 产品和SKC管理
- 添加产品和SKC
- 批量修改SKC状态
- 批量删除SKC
- 自动整理排序

### 3. 图片管理
- 上传产品图片
- 支持拖拽上传
- 图片预览和管理

### 4. Excel操作
- 导入Excel数据
- 导出项目数据为Excel
- 支持图片导出

## 性能优化

### 缓存策略
- 用户会话缓存
- 项目数据缓存
- 统计数据缓存
- 速率限制

### 数据库优化
- 连接池配置
- 索引优化
- 查询优化

## 部署建议

### 生产环境配置

1. **使用PostgreSQL数据库**
2. **配置Redis缓存**
3. **使用Nginx反向代理**
4. **启用HTTPS**
5. **配置日志轮转**
6. **设置监控和告警**

### 安全配置

1. **更改默认密钥**
2. **配置防火墙**
3. **启用CSRF保护**
4. **配置速率限制**
5. **定期备份数据**

## 故障排除

### 常见问题

1. **Redis连接失败**
   - 检查Redis服务是否启动
   - 验证连接配置

2. **数据库连接错误**
   - 检查数据库服务
   - 验证连接字符串

3. **文件上传失败**
   - 检查上传目录权限
   - 验证文件大小限制

## 开发指南

### 项目结构

```
skc-manager-web/
├── app.py              # 主应用文件
├── config.py           # 配置文件
├── models.py           # 数据模型
├── auth.py             # 认证模块
├── api.py              # API接口
├── cache.py            # 缓存管理
├── run.py              # 启动脚本
├── templates/          # HTML模板
├── static/             # 静态文件
├── uploads/            # 上传文件
└── requirements.txt    # 依赖包
```

### 添加新功能

1. 在 `models.py` 中定义数据模型
2. 在 `api.py` 中添加API接口
3. 在模板中添加前端界面
4. 更新JavaScript处理逻辑

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

微信：cxy-cxy1188
