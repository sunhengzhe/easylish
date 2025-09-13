# 代码重构迁移指南

## 重构概述

Vector API 已从单个`main.py`文件（689 行）重构为模块化架构，提高了代码的可维护性、可测试性和可扩展性。

## 文件结构变更

### 重构前

```
app/
└── main.py (689行，包含所有功能)
```

### 重构后

```
app/
├── main.py              # FastAPI路由 (262行)
├── config.py            # 配置管理 (43行)
├── models.py            # 数据模型 (51行)
├── utils.py             # 工具函数 (79行)
└── services/            # 服务模块
    ├── __init__.py
    ├── database.py      # 数据库服务 (142行)
    ├── embedding.py     # 嵌入服务 (120行)
    ├── random.py        # 随机服务 (143行)
    └── ingestion.py     # 摄入服务 (201行)
```

## 主要改进

### 1. 配置管理 (`config.py`)

- **重构前**: 配置散布在文件顶部
- **重构后**: 统一的`Config`类，环境变量集中管理

```python
# 重构后的使用方式
from app.config import config
print(config.TEI_URL)  # 访问配置
```

### 2. 数据模型 (`models.py`)

- **重构前**: 模型定义混在主文件中
- **重构后**: 所有 Pydantic 模型独立管理

```python
# 重构后
from app.models import UpsertRequest, QueryRequest
```

### 3. 工具函数 (`utils.py`)

- **重构前**: 工具函数散布在各处
- **重构后**: 统一的工具函数库，包含类型注解和文档

```python
# 重构后
from app.utils import normalize_text, validate_text_quality
```

### 4. 服务模块化

- **QdrantService**: 数据库操作抽象
- **EmbeddingService**: 文本嵌入处理
- **RandomSubtitleService**: 随机台词逻辑
- **IngestionService**: SRT 文件处理

## API 兼容性

✅ **完全兼容**: 所有 API 端点保持不变

- `GET /status`
- `POST /upsert`
- `POST /query`
- `GET /random`
- `POST /random`
- `POST /delete`
- `POST /ingest`
- `GET /ingest/status`

## 部署迁移

### Docker 部署

无需更改 Dockerfile，保持原有构建流程：

```dockerfile
# 保持不变
FROM python:3.11-slim
COPY app/ /app/
```

### 环境变量

所有环境变量保持兼容：

```bash
# 现有环境变量继续有效
TEI_URL=http://tei:80
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=subtitles
VECTOR_DIM=384
```

## 开发工作流

### 1. 开发模式启动

```bash
# 与之前相同
uvicorn app.main:app --reload
```

### 2. 测试

```bash
# 验证重构
python test_refactor.py

# API测试
curl http://localhost:8000/status
```

### 3. 添加新功能

现在可以在对应的服务模块中添加功能：

```python
# 例如：在 services/random.py 中添加新的随机策略
class RandomSubtitleService:
    async def get_random_by_category(self, category: str):
        # 新功能实现
        pass
```

## 注意事项

1. **导入路径**: 如果有自定义代码导入了原来的函数，需要更新导入路径
2. **日志格式**: 统一使用`utils.log_operation()`函数进行日志记录
3. **错误处理**: 更规范的异常处理和错误响应格式

## 回滚计划

如果遇到问题，可以通过 Git 回滚到重构前的版本：

```bash
# 查看提交历史
git log --oneline

# 回滚到重构前
git checkout <重构前的commit-hash>
```

## 验证清单

- [ ] 所有 API 端点正常响应
- [ ] 随机台词功能工作正常
- [ ] SRT 摄入功能正常
- [ ] 向量搜索功能正常
- [ ] 配置读取正确
- [ ] 日志输出正常

## 后续优化

重构为进一步优化奠定了基础：

1. 添加单元测试
2. 集成测试套件
3. 性能监控
4. 缓存优化
5. 新功能扩展
