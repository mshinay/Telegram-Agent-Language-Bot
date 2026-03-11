# 阶段一开发任务拆解（TypeScript 版）

## 1. 目标

将阶段一 MVP 按 TypeScript/Node 工程方式拆成可执行任务，优先保证：

- 主路径尽快跑通
- 尽早验证 `codex` 输出与 Telegram 体验
- 尽早打通 Obsidian 写入闭环
- 不因为平台化预期而拖慢阶段一交付

## 2. 实现原则

- 先做一个 backend：`codex`
- 先做一个 workflow：`language_tutor`
- 先做 Markdown 直写，再考虑 Obsidian CLI
- 先保证结构化输出，再优化 prompt
- 先保证状态稳定，再做更自然的交互体验

## 3. 里程碑

### M1：TypeScript 工程骨架可运行

结果要求：

- Node/TS 工程可启动
- Telegram bot 可收发消息
- 配置、日志、基础命令可工作

### M2：训练主路径可跑

结果要求：

- `/ja` 和 `/en` 能开启训练
- 可生成 1 段材料 + 3 道题
- 用户可直接用自然语言答题
- 每题可返回结构化反馈
- 三题后生成 summary draft

### M3：Obsidian 闭环可跑

结果要求：

- summary draft 可 preview
- 用户可确认写入
- Journal、Mistakes、Expressions 可写入

### M4：状态恢复与稳定性补齐

结果要求：

- 中断训练可恢复
- 解析失败、超时、写入失败可追踪
- Telegram 输出体验稳定

## 4. 第一批工程初始化任务

### T1. 初始化 TypeScript 工程

目标：

- 建立 Node + TypeScript 项目骨架

需要完成：

- 初始化 `package.json`
- 配置 `tsconfig.json`
- 建立 `src/`、`data/`、`docs/` 目录
- 配置 `dev`、`build`、`start` 脚本

建议依赖：

- `typescript`
- `tsx`
- `grammy`
- `zod`
- `execa`
- `fs-extra`
- `pino`
- `dotenv`

完成标准：

- `npm run dev` 可启动空 bot 骨架

### T2. 实现配置加载与校验

目标：

- 统一加载配置并做 schema 校验

需要实现：

- `src/config.ts`
- `config/default.json`
- `zod` 配置 schema

完成标准：

- 缺失配置时报明确错误
- agent、telegram、obsidian、session 配置可安全读取

### T3. 实现日志模块

目标：

- 提前统一日志输出格式

需要实现：

- `src/logger.ts`
- JSON 结构日志
- 关键事件 helper

完成标准：

- 启动、命令、agent 调用、写入结果都有结构化日志

## 5. 第二批类型与状态任务

### T4. 定义核心类型

目标：

- 固定 lesson、feedback、summary、session 的类型

需要实现：

- `src/types/lesson.ts`
- `src/types/session.ts`
- `src/types/router.ts`
- `src/types/obsidian.ts`

完成标准：

- 类型与 MVP_SPEC 保持一致
- 后续模块尽量不直接传裸对象

### T5. 定义 zod 输出 schema

目标：

- 对 agent 输出做严格结构校验

需要实现：

- `lessonPlanSchema`
- `answerFeedbackSchema`
- `lessonSummarySchema`

完成标准：

- agent 的三类输出都可解析与校验

### T6. 实现 FileSessionStore

目标：

- 用 JSON 文件持久化当前训练状态

需要实现：

- `load()`
- `save()`
- `clear()`
- 默认空状态生成

完成标准：

- 程序重启后可恢复 session
- session 文件损坏时有兜底策略

## 6. 第三批 Telegram 与路由任务

### T7. 接入 grammY

目标：

- 让 Telegram 成为正式入口

需要实现：

- `src/telegram/bot.ts`
- 单用户 `chat_id` 白名单
- 文本消息监听
- 消息发送与长文本拆分

完成标准：

- 能稳定收发文本消息
- 非授权用户被拒绝

### T8. 实现 CommandRouter

目标：

- 正确识别命令、确认动作与自然语言答题

需要支持：

- `/ja`
- `/en`
- `/summary`
- `/end`
- `确认写入`
- `重写总结`
- `不写入`
- 自然语言答题

完成标准：

- 在不同状态下动作判定正确
- 错误状态下返回清晰提示

### T9. 设计 Telegram 输出格式化器

目标：

- 把 lesson、feedback、summary 渲染成可读消息

需要实现：

- 训练开始消息 formatter
- 每题反馈 formatter
- 总结草稿 formatter
- 状态提示头部 formatter

完成标准：

- 手机端阅读友好
- 结构稳定，不乱飘

## 7. 第四批 Agent 集成任务

### T10. 实现 PromptBuilder

目标：

- 把 prompt 管理集中化

需要实现：

- `system.ts`
- `lesson-plan.ts`
- `evaluate-answer.ts`
- `summary.ts`

要求：

- 明确 JSON 输出格式
- 区分日语与英语约束
- 控制训练结构固定为 1 段材料 + 3 题

完成标准：

- prompt 可以单独调试
- 输出格式尽可能稳定

### T11. 实现 ProcessRunner

目标：

- 抽象本地 CLI 执行

需要实现：

- 基于 `execa` 的命令执行
- timeout 处理
- stdout/stderr 收集
- command array 执行

完成标准：

- 可独立运行 `codex exec`
- 失败时返回明确上下文

### T12. 实现 CodexAdapter

目标：

- 使用 `codex exec` 完成三类 agent 请求

需要实现：

- `generateLessonPlan()`
- `evaluateAnswer()`
- `generateSummary()`
- 输出 JSON 解析与 schema 校验

完成标准：

- 三类请求都能稳定拿到结构化结果
- 解析失败和超时能被日志捕获

### T13. 预留 OpenCodeAdapter 接口

目标：

- 不立即实现，但接口层不绑死 `codex`

完成标准：

- `AgentAdapter` 接口可插拔
- 配置层可切换 backend 名称

## 8. 第五批 Workflow 主路径任务

### T14. 实现 LessonWorkflow 的开始训练流程

目标：

- `/ja` 和 `/en` 真正开启一轮训练

需要实现：

- 检查未完成 session
- 读取 profile 与 recent notes
- 调用 `generateLessonPlan`
- 保存 session
- 返回训练总览与第 1 题

完成标准：

- Telegram 能看到完整开场消息

### T15. 实现答题推进流程

目标：

- 用户自然语言回答后，系统推进题目

需要实现：

- 读取当前题目
- 调用 `evaluateAnswer`
- 保存 answer + feedback
- 推进题号
- 返回反馈与下一题

完成标准：

- 三题可按顺序稳定跑完
- 答题与题目不会错位

### T16. 实现 summary draft 流程

目标：

- 三题结束或 `/end` 后，进入总结确认阶段

需要实现：

- 汇总本轮问答
- 调用 `generateSummary`
- 保存 draft summary
- 状态切到 `awaiting_summary_confirmation`
- 返回总结草稿

完成标准：

- 用户能 review summary 草稿

### T17. 实现恢复未完成训练

目标：

- 下次 `/ja` 或 `/en` 时，提示恢复旧训练

需要实现：

- 识别 `in_lesson` / `interrupted`
- 提示当前主题与进度
- 支持恢复或放弃重开

完成标准：

- 中断后主路径仍可继续

## 9. 第六批 Obsidian 集成任务

### T18. 实现 ObsidianStore 基础读写

目标：

- 读取 profile / recent notes
- 写 Markdown 文件

需要实现：

- 目录自动创建
- 文件安全写入
- UTF-8 编码处理

完成标准：

- Obsidian 指定目录可稳定读写

### T19. 实现 Journal 写入

目标：

- 写入每日训练日志

需要实现：

- 按日期与语言命名
- 记录主题、材料、答题、反馈、总结

完成标准：

- 一轮训练可产生一篇 Journal

### T20. 实现 Mistakes 聚合写入

目标：

- 将错误按类型沉淀到长期文件

需要实现：

- 错误类型映射
- 追加写入格式
- 去重策略可先简单实现

完成标准：

- 错题不会只散落在 Journal

### T21. 实现 Expressions 聚合写入

目标：

- 沉淀更自然表达、替代表达、反复不会说的意思

完成标准：

- 表达库有稳定结构
- 后续可支持复习型 workflow

### T22. 实现写入前确认流程

目标：

- 总结先 preview，再写入 Obsidian

需要支持：

- `确认写入`
- `重写总结`
- `不写入`

完成标准：

- 未确认时绝不写入
- 重写总结可以重新请求 agent

## 10. 第七批稳定性与测试任务

### T23. 完善错误处理

目标：

- 让失败可恢复、可定位

覆盖场景：

- `codex` 超时
- `codex` 输出不是合法 JSON
- session 文件损坏
- Obsidian 写入失败
- 非法状态下的错误消息

完成标准：

- 用户提示简洁
- 日志上下文完整

### T24. 完善日志事件

目标：

- 补齐关键业务事件日志

建议事件：

- `lesson_started`
- `answer_submitted`
- `feedback_generated`
- `summary_generated`
- `summary_confirmed`
- `obsidian_written`
- `lesson_resumed`
- `lesson_discarded`
- `agent_timeout`
- `agent_parse_failed`

完成标准：

- 主路径与失败路径均有可追踪日志

### T25. 增加单元测试与集成测试

优先测试：

- Router
- zod parser
- SessionStore
- Markdown formatter
- LessonWorkflow 主路径

完成标准：

- 主路径核心逻辑可自动验证

## 11. 推荐实现顺序

### 第一阶段：把 TS 工程和主路径搭起来

- T1 初始化 TypeScript 工程
- T2 实现配置加载与校验
- T3 实现日志模块
- T4 定义核心类型
- T5 定义 zod 输出 schema
- T6 实现 FileSessionStore
- T7 接入 grammY
- T8 实现 CommandRouter

### 第二阶段：接通 agent 与训练主路径

- T9 设计 Telegram 输出格式化器
- T10 实现 PromptBuilder
- T11 实现 ProcessRunner
- T12 实现 CodexAdapter
- T14 实现开始训练流程
- T15 实现答题推进流程
- T16 实现 summary draft 流程

### 第三阶段：接通 Obsidian

- T18 实现 ObsidianStore 基础读写
- T19 实现 Journal 写入
- T20 实现 Mistakes 聚合写入
- T21 实现 Expressions 聚合写入
- T22 实现写入前确认流程

### 第四阶段：补稳状态和体验

- T17 实现恢复未完成训练
- T23 完善错误处理
- T24 完善日志事件
- T25 增加测试
- T13 预留 OpenCodeAdapter 接口

## 12. 建议脚本

建议在 `package.json` 中准备：

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

后续测试依赖建议：

- `vitest`
- `@types/node`

## 13. 风险优先级

### 高风险

- `codex` 输出不稳定，JSON 解析失败
- 状态推进不清晰，导致题目错位
- Obsidian 写入结构混乱

### 中风险

- Telegram 消息过长，影响体验
- session 恢复逻辑不稳
- prompt 质量不稳定导致训练题质量波动

### 低风险

- 未来多 backend 抽象不够优雅
- 表达库分类后期需要再整理

## 14. 完成定义

阶段一完成的标准：

- `/ja` 与 `/en` 可稳定开启训练
- 1 段材料 + 3 题可完整运行
- 用户可直接自然语言作答
- 每题反馈结构稳定
- summary draft 可 preview 与确认
- Journal、Mistakes、Expressions 可稳定写入
- 未完成训练可恢复
- `codex` 调用失败与解析失败可追踪

## 15. 一句话总结

用 TypeScript 先把“Telegram -> lesson workflow -> codex -> summary -> Obsidian”这条主路径做穿，再补恢复、聚合和体验；不要一开始就把所有未来平台能力都提前实现。
