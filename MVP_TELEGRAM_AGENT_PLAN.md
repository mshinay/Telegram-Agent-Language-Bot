# Telegram Agent Bot MVP 方案

## 1. 目标

这一版只验证两件事：

1. Telegram -> 本地 bot -> 本地 agent -> Telegram 回传，这条链路是否稳定可用。
2. 整体延迟是否可接受，慢点主要落在哪一段。

这一版不追求通用性，不追求多用户，也不追求复杂控制面。

## 2. 范围

### 保留能力

- 单用户：只允许一个固定 `chat_id`
- 单任务：同一时刻只允许一个任务运行
- 白名单项目：只能在预设项目目录内执行
- 固定命令：只支持 `/ping` 和 `/run <project> | <prompt>`
- 简短回传：返回摘要结果和耗时

### 明确不做

- 不做多 agent 切换
- 不做 session
- 不做 webhook
- 不做 dashboard
- 不做任意 shell
- 不做流式输出
- 不做自动上传文件
- 不做并发队列
- 不做持久化任务系统

## 3. 命令协议

### `/ping`

用途：只测 Telegram 往返，不调用 agent。

返回示例：

```text
pong
recv_delay_ms=24
reply_delay_ms=81
now=2026-03-09 22:30:15
```

### `/run <project> | <prompt>`

用途：执行白名单项目内的固定 agent 任务。

输入示例：

```text
/run hm-dianping | 总结 src 目录结构
/run notes | 总结最近编辑的笔记主题
```

解析规则：

- 用第一个 `|` 分隔 `project` 与 `prompt`
- 左侧去掉 `/run` 前缀后得到 `project`
- 右侧去掉首尾空白后得到 `prompt`
- `project` 不在白名单内则直接拒绝
- `prompt` 为空则直接报格式错误

返回示例：

```text
任务完成
project: hm-dianping
elapsed_ms: 8421
agent_ms: 8010
telegram_overhead_ms: 180
summary:
src 目录主要包含 ...
```

## 4. 系统约束

### 用户约束

- 只接受配置中的 `allowed_chat_id`
- 其他 `chat_id` 一律回复 `unauthorized`

### 任务约束

- 使用单个内存锁控制执行状态
- 如果已有任务运行中，直接返回：

```text
已有任务在运行，请稍后。
```

建议实现：

```python
is_running = False
```

或更稳一点：

```python
task_lock = threading.Lock()
```

### 项目约束

- 项目名必须命中白名单
- 项目路径必须是绝对路径
- 执行时工作目录固定切到对应项目目录

## 5. 配置结构

建议使用单文件 `config.json`：

```json
{
  "bot_token": "YOUR_TELEGRAM_BOT_TOKEN",
  "allowed_chat_id": 123456789,
  "projects": {
    "hm-dianping": "D:/work/project/hm-dianping",
    "notes": "C:/Users/shinay/Documents/Obsidian Vault"
  },
  "agent": {
    "type": "codex",
    "command": [
      "codex",
      "exec"
    ],
    "timeout_sec": 120
  },
  "telegram": {
    "poll_interval_sec": 1,
    "reply_char_limit": 3000
  }
}
```

## 6. 推荐目录

```text
telegram-agent-bot/
├─ app.py
├─ config.json
└─ bot.log
```

第一版保持最小即可，不需要提前拆模块。

## 7. 执行流程

### `/ping`

1. 收到 update
2. 校验 `chat_id`
3. 记录接收时间
4. 直接回复 `pong`
5. 记录发送完成时间
6. 计算往返相关耗时

### `/run`

1. 收到 update
2. 校验 `chat_id`
3. 检查单任务锁
4. 解析 `project` 和 `prompt`
5. 校验白名单项目
6. 记录 `t0`
7. 构造 agent 命令
8. 启动子进程
9. 等待执行完成或超时
10. 截断输出并整理摘要
11. 回发 Telegram
12. 释放任务锁

## 8. Agent 调用策略

第一版固定只接一个 agent，建议先接 `codex exec`。

命令形式：

```bash
codex exec -C "D:/work/project/hm-dianping" "总结当前项目的主要目录结构"
```

Windows 下如果采用 `subprocess.run([...])`，建议直接传参数数组，不要手写整串 shell 命令。

建议参数结构：

```python
cmd = [
    "codex",
    "exec",
    "-C",
    project_path,
    prompt,
]
```

执行建议：

- 使用 `subprocess.run`
- 设置 `timeout`
- 捕获 `stdout` 和 `stderr`
- 非零退出码也要把摘要发回 Telegram

## 9. 延迟埋点

每次请求记录这些时间点：

- `t0`: 收到 Telegram update
- `t1`: 开始处理命令
- `t2`: 开始启动 agent
- `t3`: agent 结束
- `t4`: Telegram 回复完成

计算指标：

- `dispatch_ms = t1 - t0`
- `spawn_ms = t2 - t1`
- `agent_ms = t3 - t2`
- `reply_ms = t4 - t3`
- `total_ms = t4 - t0`

其中：

- `/ping` 重点看 `recv_delay_ms` 和 `reply_delay_ms`
- `/run` 重点区分 `agent_ms` 与其他开销

## 10. 日志建议

日志写到 `bot.log`，每次请求至少记录：

- 请求时间
- `chat_id`
- 命令原文
- 解析得到的 `project`
- 任务状态：accepted / rejected / busy / timeout / failed / success
- `dispatch_ms`
- `spawn_ms`
- `agent_ms`
- `reply_ms`
- `total_ms`
- agent 退出码

推荐一行一条 JSON 日志，后续更容易分析。

示例：

```json
{
  "ts": "2026-03-09T22:30:15+08:00",
  "chat_id": 123456789,
  "cmd": "/run hm-dianping | 总结 src 目录结构",
  "project": "hm-dianping",
  "status": "success",
  "dispatch_ms": 12,
  "spawn_ms": 41,
  "agent_ms": 8010,
  "reply_ms": 109,
  "total_ms": 8172,
  "exit_code": 0
}
```

## 11. 错误处理

### 非法用户

返回：

```text
unauthorized
```

### 格式错误

返回：

```text
格式错误。用法：/run <project> | <prompt>
```

### 项目不在白名单

返回：

```text
未知项目。可用项目：hm-dianping, notes
```

### 当前忙碌

返回：

```text
已有任务在运行，请稍后。
```

### agent 超时

返回：

```text
任务超时
project: hm-dianping
timeout_sec: 120
```

### agent 执行失败

返回：

```text
任务失败
project: hm-dianping
exit_code: 1
stderr:
...
```

## 12. 输出策略

Telegram 文本长度要控制，第一版建议：

- 优先返回简短摘要
- 原始输出过长时截断
- 先展示耗时，再展示摘要

建议返回结构：

```text
任务完成
project: hm-dianping
total_ms: 8421
agent_ms: 8010

summary:
...
```

如果输出过长：

```text
output truncated
```

## 13. 迭代顺序

### 第一步

只做：

- `/ping`
- `/run <project> | <prompt>`

但 `/run` 先不接真实 agent，只做假任务，例如：

- `sleep 1`
- 或扫描当前目录并返回文件数

目标：先测消息链路和本地任务调起流程。

### 第二步

`/run` 接轻量真实任务，例如：

- `pwd`
- 统计文件数
- 总结当前目录结构

目标：确认目录切换、白名单、超时和输出处理是否稳定。

### 第三步

接 `codex exec`。

目标：测真实 agent 的启动和执行耗时。

### 第四步

分别在以下网络环境测试：

- 校园网 Wi-Fi
- 手机流量
- 宿舍 Wi-Fi
- 同局域网 / 非同局域网

目标：区分 Telegram 网络因素和本地执行因素。

## 14. 成功标准

满足以下条件即可认为 MVP 达标：

1. `/ping` 稳定可用，往返体感正常。
2. `/run` 能稳定完成白名单项目任务。
3. 非法用户无法调用。
4. 并发请求会被正确拒绝。
5. 日志能清楚分辨 Telegram 开销和 agent 开销。
6. 能拿到 3 组以上真实延迟样本。

## 15. 下一阶段再考虑的功能

这一版跑通并拿到数据之后，再决定是否增加：

- `/status`
- `/stop`
- 多 agent 切换
- 流式输出
- 文件上传
- 队列和持久化
- webhook 模式

结论：当前最合理的落点就是一个最小、强约束、可测延迟的 Telegram Agent Bot。先把链路跑通，再谈扩展。
