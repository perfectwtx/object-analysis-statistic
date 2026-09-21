# 删除分析历史 — 后端接口约定

前端已接入删除能力。后端需实现下列接口后，质量看板 / 作业选择器上的「删除」才会真正清掉历史。

## 1. 删除单条作业（必做）

| 项 | 说明 |
|----|------|
| **方法** | `DELETE` |
| **路径** | `/api/analysis/jobs/{jobId}` |
| **别名（可选）** | `/api/jobs/{jobId}` |

### 行为

1. 从 `IAnalysisHistoryStore`（或等价持久化）移除该 `jobId`。
2. **级联清理** 所有依赖该 job 的数据，至少包括：
   - 分析结果 / overview / result
   - 字段质量快照
   - 问题中心条目（`/api/issues/{jobId}`）
   - 血缘、影响分析、schema-impact、relationships 等派生结果
3. 幂等：已不存在时返回 **404** 或 **204**（推荐 404 便于前端区分）。

### 响应

| 状态 | 含义 |
|------|------|
| `204 No Content` | 删除成功（推荐） |
| `200 OK` + `{ "ok": true, "id": "{jobId}" }` | 删除成功（亦可） |
| `404 Not Found` | job 不存在 |
| `409 Conflict` | 作业仍在运行，需先取消（可选策略） |
| `500` | 服务端错误 |

### 示例

```http
DELETE /api/analysis/jobs/3fa85f64-5717-4562-b3fc-2c963f66afa6 HTTP/1.1
```

成功：

```http
HTTP/1.1 204 No Content
```

---

## 2. 批量删除（可选）

| 项 | 说明 |
|----|------|
| **方法** | `DELETE` |
| **路径** | `/api/analysis/jobs` |
| **Body** | `{ "ids": ["guid1", "guid2"] }` |

响应示例：

```json
{ "deleted": 2, "failed": [] }
```

前端在批量端点不可用时会 **回退为逐条 DELETE**。

---

## 3. 与现有接口的关系

| 接口 | 用途 |
|------|------|
| `GET /api/analysis/jobs` | 列表；删除后不应再出现该 id |
| `GET /api/analysis/jobs/{jobId}` | 详情；删除后应 404 |
| `POST /api/analyze/async/{jobId}/cancel` | 仅取消**进行中**作业，不替代删除历史 |

建议：进行中的 job 要么禁止删除（409），要么先 cancel 再删。

---

## 4. 前端行为（已实现）

- 质量看板「最近作业」每行有删除按钮，确认后调用 `DELETE`。
- 洞察类页面（依赖 Job 的选择器）可删除当前选中作业并刷新列表。
- 若当前 `oaLastJobId` 被删，会清空本地缓存。
- 若后端返回 404/501，提示「后端尚未提供删除接口」。

---

## 5. 最小实现伪代码（C#）

```csharp
// DELETE /api/analysis/jobs/{jobId}
app.MapDelete("/api/analysis/jobs/{jobId}", async (string jobId, IAnalysisHistoryStore store) =>
{
    var removed = await store.RemoveAsync(jobId); // 含级联
    return removed ? Results.NoContent() : Results.NotFound();
});
```
