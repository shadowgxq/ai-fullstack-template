 # 1. 用轻量级 Python 镜像
 FROM python:3.12-slim

 # 2. 安装 uv（快速包管理工具）
 RUN pip install uv

 # 3. 设置工作目录
 WORKDIR /app

# 4. 先复制依赖文件（利用 Docker 缓存）
COPY pyproject.toml uv.lock ./

# 5. 安装依赖
RUN uv sync --frozen --no-dev

# 6. 复制项目代码
COPY . .

# 7. 入口脚本改可执行
RUN chmod +x entrypoint.sh

# 8. 暴露端口
EXPOSE 8000

# 9. 启动命令（先跑迁移，再启服务）
CMD ["uv", "run", "./entrypoint.sh"]