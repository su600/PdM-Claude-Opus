# PdM 通知推送协议

## 请求格式

通知外推采用 HTTP POST JSON 方式：

```
POST {target_url}
Content-Type: application/json
X-PdM-Signature: {hmac_sha256_hex}
X-PdM-Timestamp: {unix_timestamp}
```

### 请求体

```json
{
  "title": "告警标题",
  "body": "告警内容详情",
  "level": "high",
  "event_id": "abc123def456"
}
```

## 签名验证

1. 接收方获取请求原始 body（bytes）
2. 使用 HMAC-SHA256 算法，以 `WEBHOOK_SIGNING_SECRET` 为密钥计算签名
3. 将结果与 `X-PdM-Signature` header 对比

```python
import hmac, hashlib

expected = hmac.new(
    secret.encode(),
    request_body,
    hashlib.sha256
).hexdigest()

assert expected == request.headers["X-PdM-Signature"]
```

## 超时与重试

- 请求超时：4 秒
- 重试策略：3 次（间隔 1s / 2s / 3s 回退）
- 所有重试失败后事件标记为 `failed`
- 可通过 `POST /notifications/retry-failed` 手动触发重试
