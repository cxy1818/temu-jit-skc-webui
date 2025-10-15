#!/usr/bin/env python3
"""
SKC管理系统启动脚本
支持开发和生产环境
"""

import os
import sys
import argparse
from app import create_app

def main():
    parser = argparse.ArgumentParser(description='SKC管理系统')
    parser.add_argument('--env', choices=['development', 'production'], 
                       default='development', help='运行环境')
    parser.add_argument('--host', default='0.0.0.0', help='监听地址')
    parser.add_argument('--port', type=int, default=5000, help='监听端口')
    parser.add_argument('--workers', type=int, default=4, help='工作进程数（生产环境）')
    parser.add_argument('--debug', action='store_true', help='开启调试模式')
    
    args = parser.parse_args()
    
    # 设置环境变量
    os.environ['FLASK_ENV'] = args.env
    
    # 创建应用
    app = create_app(args.env)
    
    if args.env == 'development' or args.debug:
        # 开发环境
        print(f"🚀 SKC管理系统启动中...")
        print(f"📍 访问地址: http://{args.host}:{args.port}")
        print(f"🔧 运行环境: {args.env}")
        print(f"🐛 调试模式: {'开启' if args.debug else '关闭'}")
        print("=" * 50)
        
        app.run(
            host=args.host,
            port=args.port,
            debug=args.debug or args.env == 'development',
            threaded=True
        )
    else:
        # 生产环境提示
        print("生产环境请使用以下命令启动:")
        print(f"gunicorn -w {args.workers} -b {args.host}:{args.port} --timeout 120 --keep-alive 2 app:app")
        print("\n或者使用Docker:")
        print("docker-compose up -d")

if __name__ == '__main__':
    main()