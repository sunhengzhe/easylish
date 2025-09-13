# Vector API 重构说明

## 项目结构

```
app/
├── main.py              # FastAPI 主应用和路由
├── config.py            # 配置管理
├── models.py            # Pydantic 数据模型
├── utils.py             # 工具函数
└── services/            # 业务服务模块
    ├── __init__.py
    ├── database.py      # Qdrant 数据库服务
    ├── embedding.py     # 文本嵌入服务
    ├── random.py        # 随机台词服务
    └── ingestion.py     # SRT 文件摄入服务
```

## 重构改进

### 1. 模块化设计

- **单一职责**: 每个模块负责特定功能
- **松耦合**: 模块间依赖清晰，便于测试和维护
- **高内聚**: 相关功能组织在同一模块内

### 2. 配置管理

- 统一的配置类 (`Config`)
- 环境变量管理
- 默认值设置

### 3. 错误处理

- 统一的日志记录函数
- 结构化错误响应
- 异常捕获和处理

### 4. 代码质量

- 类型注解完整
- 文档字符串
- 遵循 Python 最佳实践

### 5. 服务抽象

- **QdrantService**: 数据库操作抽象
- **EmbeddingService**: 嵌入向量生成
- **RandomSubtitleService**: 随机台词逻辑
- **IngestionService**: SRT 文件处理

## API 端点

| 端点             | 方法     | 功能          |
| ---------------- | -------- | ------------- |
| `/status`        | GET      | 获取服务状态  |
| `/upsert`        | POST     | 批量上传台词  |
| `/query`         | POST     | 向量查询台词  |
| `/random`        | GET/POST | 获取随机台词  |
| `/delete`        | POST     | 删除数据点    |
| `/ingest`        | POST     | 开始 SRT 摄入 |
| `/ingest/status` | GET      | 摄入状态查询  |

## 使用示例

### 启动服务

```bash
uvicorn app.main:app --reload
```

### 健康检查

```bash
curl http://localhost:8000/status
```

### 随机台词

```bash
curl http://localhost:8000/random
```

## 主要改进点

1. **代码组织**: 从单文件 689 行拆分为多个模块
2. **可维护性**: 功能模块化，便于理解和修改
3. **可测试性**: 服务类便于单元测试
4. **健壮性**: 完善的错误处理和日志记录
5. **可扩展性**: 清晰的架构便于添加新功能
