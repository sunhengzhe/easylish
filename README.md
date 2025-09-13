# Easylish

## 开发

一般来说，本地开发主要是 nextjs 项目，其他项目可以使用 docker 来启动。

```
# 启动服务，后台运行可以加 -d
docker compose -f infra/docker-compose.yml up --build tei qdrant vector-api

# 启动 web 开发
pnpm dev
```

如果需要调试服务，也可以使用开发模式，主要是设置环境变量

```
# vector-api

## 环境
cd apps/vector-api
python -m venv .venv && source .venv/bin/activate
pip install -e .

## 启动
TEI_URL=http://localhost:8080 QDRANT_URL=http://localhost:6333 python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
