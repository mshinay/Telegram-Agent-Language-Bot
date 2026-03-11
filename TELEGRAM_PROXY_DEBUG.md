# Telegram Proxy Debug Summary

## 背景

在第一轮任务卡完成后，bot 进程可以启动，但 Telegram 中发送 `/ping` 没有任何响应。

已确认前提：

- `.env` 中的 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_ALLOWED_CHAT_ID` 已填写
- `npm run dev` 可以启动进程
- 本地网络访问 Telegram 需要通过代理

## 初始现象

启动命令：

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7897"
$env:HTTPS_PROXY="http://127.0.0.1:7897"
$env:NO_PROXY="localhost,127.0.0.1"
npm run dev
```

启动日志只有：

```json
{"event":"app_starting", ...}
```

但没有：

- `bot_started`
- `incoming_message`
- `/ping` 回复

这说明：

- 进程启动了
- 但 bot 没有真正进入可工作的 polling 状态

## 排查过程

### 1. 验证基础 API 连通性

用 Node 原生 `fetch` 测试：

- `getMe`
- `getUpdates`

在 `node --use-env-proxy` 下都成功返回。

结论：

- token 正常
- chat id 没问题
- Telegram API 基础访问正常
- 代理本身可用

### 2. 验证是不是脚本没有启用代理

最初 `dev` 脚本是：

```json
"dev": "tsx watch src/index.ts"
```

后改成：

```json
"dev": "node --use-env-proxy ./node_modules/tsx/dist/cli.mjs watch src/index.ts"
```

这样可以确保 Node 原生 `fetch` 读取环境变量代理。

结论：

- 这一步是必要的
- 但仅靠这一步，`grammY` 仍然没有正常工作

### 3. 验证 `grammY` 默认 HTTP 客户端行为

检查本地依赖后确认：

- `grammY` 在 Node 下默认使用 `node-fetch`
- 不是 Node 原生 `fetch`

结论：

- 即使 Node 原生 `fetch` 走代理成功
- `grammY` 默认链路也不一定会跟着成功

### 4. 尝试把 `grammY` 切到 `globalThis.fetch`

尝试过：

```ts
new Bot(token, {
  client: {
    fetch: globalThis.fetch
  }
})
```

以及后续的包装版本：

- 去掉 `agent`
- 去掉 `compress`
- 兼容 `signal`

结论：

- 在当前 `grammY` 版本和本地环境里，这条路没有打通
- `bot.init()` 仍然卡住
- 属于无效修补，后来已移除

### 5. 最终切换到 `undici`

最终方案：

- 安装 `undici`
- 使用 `EnvHttpProxyAgent`
- 给 `grammY` 注入自定义 `client.fetch`
- 使用 `undici.fetch`
- 去掉 `grammY/node-fetch` 风格参数
- 将其 abort signal 转成原生 `AbortController` signal

结论：

- 这套方案在当前机器和网络环境下已经验证成功
- bot 可以正常启动
- `/ping` 可以正常回复

## 根因

根因不是：

- token 错误
- allowed chat id 错误
- `/ping` 路由没实现
- bot 进程没启动

根因是：

- 本地网络必须走代理
- `grammY` 默认使用的 Node 客户端链路没有直接复用已经验证成功的代理访问方式
- 需要显式接管 Telegram API 的出站 HTTP 请求

## 最终可用方案

当前有效方案包括两部分：

### 1. 启动前设置代理环境变量

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7897"
$env:HTTPS_PROXY="http://127.0.0.1:7897"
$env:NO_PROXY="localhost,127.0.0.1"
```

### 2. 使用带代理支持的启动命令

`package.json` 中：

```json
"dev": "node --use-env-proxy ./node_modules/tsx/dist/cli.mjs watch src/index.ts"
```

### 3. 在 bot 初始化中使用 `undici`

当前实现思路：

- `EnvHttpProxyAgent` 读取环境变量代理
- `undici.fetch` 负责请求 Telegram API
- `grammY` 通过 `client.fetch` 使用这条链路

## 当前验证结果

已验证通过：

- `npm run typecheck`
- `npm run build`
- bot 启动成功
- `/ping` 回复成功

## 后续注意事项

- 每次本地启动前，仍然需要先在 shell 中设置代理环境变量
- 这次修补只覆盖 Telegram 出站请求
- 如果后续接入 Codex、其他 HTTP API 或 webhook，也需要分别确认代理策略

## 涉及文件

- `package.json`
- `package-lock.json`
- `src/telegram/bot.ts`
- `src/app.ts`

## 一句话结论

这次问题的本质不是 bot 逻辑错误，而是 Telegram 请求链路的代理兼容性问题；最终通过 `undici + EnvHttpProxyAgent` 解决。
