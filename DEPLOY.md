# 部署

## CloudBase

### 1. tei

由于 ghcr.io 不一定可达，所以先在本地把镜像拉下来，然后传到 CloudBase，这也意味着如果 TEI 镜像不需要升级，则无需重复部署。

上传到 [镜像仓库](https://console.cloud.tencent.com/tcr/repository/)

```
docker pull --platform linux/amd64 ghcr.io/huggingface/text-embeddings-inference:cpu-1.8
docker tag ghcr.io/huggingface/text-embeddings-inference:cpu-1.8 ccr.ccs.tencentyun.com/easylish/tei:cpu-1.8
docker push ccr.ccs.tencentyun.com/easylish/tei:cpu-1.8
```

由于 huggingface.io 不一定可达，所以先在本地把模型下载下来，然后传到 CloudBase。模型需要更新的时候需要做此操作：

1. 打开 CloudBase 云存储
2. 上传 models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2 文件夹

在 CloudBase 上，选择云托管，配置以下内容:

```
镜像: 刚才上传的镜像
端口: 80
环境变量:
    - MODEL_ID=/data/models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2/snapshots/86741b4e3f5cb7765a600d3a3d55a0f6a6cb443d
    - HF_HUB_OFFLINE=1
    - RUST_LOG=info
存储挂载:
    - 对象存储挂载目录: /
    - 挂载到实例目录: /data/
只开内网即可

说明:
- 上述 MODEL_ID 指向本地“快照”目录，TEI 将完全离线加载模型，不会访问 HuggingFace。
- 如果对象存储挂载不支持符号链接（常见于部分 COS 挂载），请先在本地将快照目录“平铺”为实文件后再上传：
  - cp -aL data/tei/models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2/snapshots/86741b4e3f5cb7765a600d3a3d55a0f6a6cb443d /tmp/model-flat
  - 将 /tmp/model-flat 上传并挂载到容器（例如 /data/model-flat），然后把 MODEL_ID 设置为 /data/model-flat
  - 仍建议设置 HF_HUB_OFFLINE=1
```

### 2. qdrant

此镜像直接使用 DockerHub 即可。

配置云托管

```
镜像: qdrant/qdrant:latest
端口: 6333（仅 REST；CloudBase 单端口，gRPC 6334 可不暴露）
存储（建议）: 挂载 CFS 到 /qdrant/storage（对象存储不适合作为数据库数据盘）
只开内网即可
```

### 3. vector-api

1. 打包镜像上传到镜像仓库:

```
docker buildx create --use（首次）
docker buildx build --platform linux/amd64 -t ccr.ccs.tencentyun.com/easylish/vector-api:v1 -f apps/vector-api/Dockerfile . --push
```

2. 上传 srt 文件夹到云存储（subtitles）。

3. 配置云托管

```
端口: 8000
环境变量:
    - TEI_URL=http://<tei内网地址>
    - QDRANT_URL=http://<qdrant内网地址>:6333
    - QDRANT_COLLECTION=subtitles
    - VECTOR_DIM=384
    - QDRANT_DISTANCE=Cosine
    - TEI_BATCH=32
    - SUBTITLES_DIR=/data/subtitles
存储挂载:
    - 对象存储挂载目录: /
    - 挂载到实例目录: /data/
只开内网即可
健康检查（推荐）:
    - 就绪/存活: HTTP GET /status （端口 8000）
```

### 4. web

1. 打包镜像到镜像仓库:

```
docker buildx create --use（首次）
docker buildx build --platform linux/amd64 -t ccr.ccs.tencentyun.com/easylish/web:v1 -f Dockerfile . --push
```

2. 配置云托管

```
端口: 3000
环境变量:
    - NODE_ENV=production
    - NEXT_TELEMETRY_DISABLED=1
    - VECTOR_API_URL=http://<vector-api内网地址>:8000
只开公网即可（后端均走内网）
健康检查（推荐）:
    - 就绪/存活: HTTP GET /api/status （端口 3000）
```
