# 阶段一架构说明（TypeScript 版）

## 1. 架构目标

阶段一围绕 `language_tutor` 这个单一 workflow 实现，不追求一次做成通用平台，但底层结构要能自然扩成更大的 Telegram 远程 agent 系统。

架构目标：

- 使用 TypeScript + Node.js 实现
- Telegram 作为唯一入口
- 单用户、单训练会话
- 调用本地 `codex` 或后续 `opencode`
- 读取与写入 Obsidian Markdown
- 支持中断恢复与总结确认
- 保持类型清晰、状态稳定、模块边界明确

## 2. 为什么用 TypeScript

对当前项目，TypeScript 比 Python 更合适，原因是：

- `codex`、`opencode` 都运行在 Node 生态中，CLI 调用更自然
- 阶段一的核心复杂度在状态与结构化数据，TS 类型系统更有帮助
- 后续如果扩展到 webhook、HTTP API、Web UI、Obsidian CLI、npm 工具链，Node 生态更统一
- 训练计划、反馈、总结、会话状态都适合用 TS interface 或 schema 固化

## 3. 推荐技术栈

### 运行时

- Node.js 20+
- TypeScript 5+

### 核心依赖

- Telegram：`grammy`
- CLI 调用：`execa`
- 配置与结构校验：`zod`
- 日志：`pino`
- 文件系统辅助：`fs-extra`
- Markdown 写入：`node:fs/promises` + `fs-extra`

### 可选依赖

- 环境变量：`dotenv`
- 时间处理：`dayjs`
- frontmatter：`gray-matter`

## 4. 总体分层

```text
Telegram Bot Layer
    -> Command Router
        -> Lesson Workflow
            -> Agent Adapter
            -> Session Store
            -> Obsidian Store
            -> Prompt Builder
```

### 分层职责

#### 1. Telegram Bot Layer

负责：

- 接收 Telegram 消息
- 发送消息、编辑消息、拆分长消息
- 将 Telegram 上下文转换成应用层输入

不负责：

- 训练流程逻辑
- 状态机推进
- Obsidian 写入细节

#### 2. Command Router

负责：

- 识别 `/ja` `/en` `/summary` `/end`
- 识别 `确认写入` `重写总结` `不写入`
- 将自然语言消息路由成“当前题目的回答”
- 在不同状态下做合法性判断

#### 3. Lesson Workflow

负责：

- 开始训练
- 推进题目
- 调用 agent 生成 lesson、feedback、summary
- 管理训练状态
- 管理总结确认流程
- 管理恢复逻辑

这是阶段一的核心业务层。

#### 4. Agent Adapter

负责：

- 屏蔽 `codex`、后续 `opencode` 的调用差异
- 组织 prompt
- 调用本地 CLI
- 解析结构化输出

#### 5. Session Store

负责：

- 持久化当前训练状态
- 支持恢复未完成训练
- 管理草稿 summary

阶段一可直接用 JSON 文件，不需要数据库。

#### 6. Obsidian Store

负责：

- 读取语言学习目录中的 profile 和近期资料
- 写入 Journal
- 聚合 Mistakes
- 聚合 Expressions

阶段一不强依赖 Obsidian CLI，先直接写 Markdown。

#### 7. Prompt Builder

负责：

- 统一管理 prompt 模板
- 区分日语与英语系统约束
- 统一定义结构化输出格式

## 5. 推荐目录结构

```text
telegram-language-bot/
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ config/
│  └─ default.json
├─ data/
│  ├─ session.json
│  └─ drafts/
├─ docs/
│  ├─ MVP_SPEC.md
│  ├─ ARCHITECTURE.md
│  └─ TASKS.md
├─ src/
│  ├─ index.ts
│  ├─ app.ts
│  ├─ config.ts
│  ├─ logger.ts
│  ├─ types/
│  │  ├─ lesson.ts
│  │  ├─ session.ts
│  │  ├─ router.ts
│  │  └─ obsidian.ts
│  ├─ telegram/
│  │  ├─ bot.ts
│  │  ├─ message.ts
│  │  └─ commands.ts
│  ├─ router/
│  │  └─ command-router.ts
│  ├─ workflow/
│  │  └─ lesson-workflow.ts
│  ├─ agent/
│  │  ├─ agent-adapter.ts
│  │  ├─ codex-adapter.ts
│  │  ├─ process-runner.ts
│  │  └─ parser.ts
│  ├─ prompts/
│  │  ├─ system.ts
│  │  ├─ lesson-plan.ts
│  │  ├─ evaluate-answer.ts
│  │  └─ summary.ts
│  ├─ session/
│  │  └─ file-session-store.ts
│  ├─ obsidian/
│  │  ├─ obsidian-store.ts
│  │  ├─ journal.ts
│  │  ├─ mistakes.ts
│  │  └─ expressions.ts
│  └─ utils/
│     ├─ json.ts
│     ├─ markdown.ts
│     └─ text.ts
└─ tests/
   ├─ router.test.ts
   ├─ workflow.test.ts
   └─ parser.test.ts
```

## 6. 核心类型设计

阶段一最重要的是把类型先定稳。

### 6.1 Lesson 相关类型

建议定义：

```ts
export type LanguageMode = 'ja' | 'en';

export type QuestionType = 'translate' | 'retell';

export interface Question {
  id: number;
  type: QuestionType;
  prompt: string;
}

export interface LessonPlan {
  topic: string;
  material: string;
  questions: Question[];
}

export interface AnswerFeedback {
  evaluation: string;
  issues: string[];
  naturalVersion: string;
  alternatives: string[];
}

export interface LessonSummary {
  topic: string;
  strengths: string[];
  mistakes: string[];
  naturalExpressions: string[];
  reviewPoints: string[];
  overallComment: string;
}
```

### 6.2 Session 相关类型

```ts
export type LessonStatus =
  | 'idle'
  | 'in_lesson'
  | 'awaiting_summary_confirmation'
  | 'interrupted';

export interface AnswerRecord {
  questionId: number;
  answer: string;
  feedback: AnswerFeedback;
}

export interface SessionState {
  status: LessonStatus;
  lessonId: string | null;
  language: LanguageMode | null;
  topic: string | null;
  material: string | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: AnswerRecord[];
  draftSummary: LessonSummary | null;
  createdAt: string | null;
  updatedAt: string | null;
}
```

### 6.3 Router 动作类型

```ts
export type RouteAction =
  | { type: 'start_lesson'; language: LanguageMode }
  | { type: 'resume_lesson' }
  | { type: 'submit_answer'; text: string }
  | { type: 'show_summary' }
  | { type: 'finish_lesson' }
  | { type: 'confirm_write' }
  | { type: 'rewrite_summary' }
  | { type: 'discard_summary' }
  | { type: 'invalid'; message: string };
```

## 7. 关键模块设计

### 7.1 `src/telegram/bot.ts`

职责：

- 初始化 `grammy` bot
- 注册消息监听
- 将 message text 交给 router
- 调用 workflow 返回消息

接口示意：

```ts
export function createBot(deps: AppDeps): Bot;
```

### 7.2 `src/router/command-router.ts`

职责：

- 根据当前 `SessionState` 决定输入是什么动作
- 在弱状态模型下减少歧义

接口示意：

```ts
export class CommandRouter {
  route(text: string, session: SessionState): RouteAction {
    // ...
  }
}
```

### 7.3 `src/workflow/lesson-workflow.ts`

职责：

- 启动 lesson
- 提交答案
- 推进题目
- 生成总结草稿
- 确认写入
- 放弃或重写总结

接口示意：

```ts
export class LessonWorkflow {
  startLesson(language: LanguageMode): Promise<BotReply>;
  resumeLesson(): Promise<BotReply>;
  submitAnswer(text: string): Promise<BotReply>;
  endLesson(): Promise<BotReply>;
  getSummary(): Promise<BotReply>;
  confirmWrite(): Promise<BotReply>;
  rewriteSummary(): Promise<BotReply>;
  discardSummary(): Promise<BotReply>;
}
```

### 7.4 `src/agent/agent-adapter.ts`

职责：

- 定义 agent 抽象接口

```ts
export interface AgentAdapter {
  generateLessonPlan(input: GenerateLessonPlanInput): Promise<LessonPlan>;
  evaluateAnswer(input: EvaluateAnswerInput): Promise<AnswerFeedback>;
  generateSummary(input: GenerateSummaryInput): Promise<LessonSummary>;
}
```

阶段一先实现 `CodexAdapter`，后续再补 `OpenCodeAdapter`。

### 7.5 `src/agent/codex-adapter.ts`

职责：

- 用 `execa` 调用 `codex exec`
- 拼接 prompt
- 强制 JSON 输出
- 解析 stdout

建议策略：

- 每类任务独立 prompt
- 使用 `zod` 校验输出 JSON
- 解析失败时返回明确错误

### 7.6 `src/session/file-session-store.ts`

职责：

- 读写 `data/session.json`
- 保证单用户单 session 场景下的一致性

接口示意：

```ts
export interface SessionStore {
  load(): Promise<SessionState>;
  save(state: SessionState): Promise<void>;
  clear(): Promise<void>;
}
```

### 7.7 `src/obsidian/obsidian-store.ts`

职责：

- 读取 profile 与近期训练资料
- 写入 Journal
- 聚合 Mistakes
- 聚合 Expressions

接口示意：

```ts
export class ObsidianStore {
  loadProfile(language: LanguageMode): Promise<string>;
  loadRecentNotes(language: LanguageMode, limit?: number): Promise<string[]>;
  writeJournal(input: WriteJournalInput): Promise<string>;
  appendMistakes(input: AppendMistakesInput): Promise<void>;
  appendExpressions(input: AppendExpressionsInput): Promise<void>;
}
```

## 8. 结构化输出策略

阶段一必须尽量避免自由文本解析，推荐让 agent 返回严格 JSON。

### lesson plan 输出

```json
{
  "topic": "课堂沟通",
  "material": "...",
  "questions": [
    { "id": 1, "type": "translate", "prompt": "..." },
    { "id": 2, "type": "retell", "prompt": "..." },
    { "id": 3, "type": "translate", "prompt": "..." }
  ]
}
```

### answer feedback 输出

```json
{
  "evaluation": "...",
  "issues": ["...", "..."],
  "naturalVersion": "...",
  "alternatives": ["...", "..."]
}
```

### summary 输出

```json
{
  "topic": "课堂沟通",
  "strengths": ["..."],
  "mistakes": ["..."],
  "naturalExpressions": ["..."],
  "reviewPoints": ["..."],
  "overallComment": "..."
}
```

建议用 `zod` 为上述三类输出定义 schema，并在 adapter 层统一校验。

## 9. 数据流

### 9.1 开始训练

```text
Telegram message (/ja)
-> grammY bot 接收
-> Router 返回 start_lesson(ja)
-> Workflow 检查是否有未完成训练
-> SessionStore 读取当前状态
-> ObsidianStore 读取 profile / recent notes
-> AgentAdapter.generateLessonPlan()
-> SessionStore.save()
-> Telegram 返回训练总览和第 1 题
```

### 9.2 用户答题

```text
Telegram natural text
-> Router 返回 submit_answer
-> Workflow 读取当前题目
-> AgentAdapter.evaluateAnswer()
-> Workflow 保存 answer + feedback
-> 推进 currentQuestionIndex
-> SessionStore.save()
-> Telegram 返回当前题反馈和下一题
```

### 9.3 结束训练

```text
/end 或所有题完成
-> Workflow 调用 AgentAdapter.generateSummary()
-> SessionStore 保存 draftSummary
-> 状态切到 awaiting_summary_confirmation
-> Telegram 返回总结草稿
```

### 9.4 确认写入

```text
用户发送 确认写入
-> Router 返回 confirm_write
-> Workflow 调用 ObsidianStore
-> 写入 Journal / Mistakes / Expressions
-> SessionStore.clear()
-> Telegram 返回写入成功
```

## 10. 状态机

### 状态定义

- `idle`
- `in_lesson`
- `awaiting_summary_confirmation`
- `interrupted`

### 状态转移

```text
idle
  -> (/ja|/en) -> in_lesson

in_lesson
  -> (submit_answer) -> in_lesson
  -> (/end) -> awaiting_summary_confirmation
  -> (all questions done) -> awaiting_summary_confirmation
  -> (process crash / parse error / timeout) -> interrupted

interrupted
  -> (resume) -> in_lesson
  -> (discard and restart) -> in_lesson

awaiting_summary_confirmation
  -> (confirm_write) -> idle
  -> (rewrite_summary) -> awaiting_summary_confirmation
  -> (discard_summary) -> idle
```

建议用显式 `switch` 配合 discriminated union，而不是散乱的 if/else。

## 11. 配置设计

建议定义 `zod` schema，并从 `config/default.json` 或 `.env` 读取。

示例：

```json
{
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "allowedChatId": 123456789,
    "pollIntervalSec": 1,
    "replyCharLimit": 3500
  },
  "agent": {
    "backend": "codex",
    "command": ["C:/Users/shinay/AppData/Roaming/npm/codex.cmd", "exec"],
    "timeoutSec": 180
  },
  "obsidian": {
    "vaultRoot": "C:/Users/shinay/Documents/Obsidian Vault",
    "languageRoot": "C:/Users/shinay/Documents/Obsidian Vault/Language"
  },
  "session": {
    "path": "data/session.json"
  }
}
```

## 12. 日志设计

建议使用 `pino` 输出 JSON 日志。

至少记录：

- `event`
- `lessonId`
- `status`
- `language`
- `questionIndex`
- `agentMs`
- `replyMs`
- `writeTarget`
- `error`

建议事件：

- `lesson_started`
- `answer_submitted`
- `feedback_generated`
- `summary_generated`
- `summary_confirmed`
- `obsidian_written`
- `lesson_resumed`
- `lesson_discarded`
- `agent_parse_failed`
- `agent_timeout`

## 13. 测试策略

### 单元测试

优先测：

- Router
- SessionStore
- Agent 输出 parser
- Markdown 生成函数

### 集成测试

优先测：

- `/ja` -> 3 题 -> summary -> confirm_write`
- 中途中断 -> 恢复
- 写入失败不丢失 summary draft

### 手动联调

- Telegram 真实消息链路
- `codex exec` 调用
- Obsidian 实际写入路径

## 14. 可扩展性预留

阶段一虽然只做 `language_tutor`，但架构上要预留未来扩展：

- `Workflow` 可插拔
- `AgentAdapter` 可切换 `codex` / `opencode`
- `SessionStore` 可从 JSON 演进到 SQLite
- `ObsidianStore` 可从 Markdown 直写演进到 Obsidian CLI
- Telegram 层可从 polling 演进到 webhook

## 15. 推荐实现顺序

1. `types` 与 `zod schemas`
2. `SessionStore`
3. `CommandRouter`
4. `PromptBuilder`
5. `CodexAdapter`
6. `LessonWorkflow` 主路径
7. `ObsidianStore` Journal 写入
8. Mistakes / Expressions 聚合
9. 恢复逻辑
10. 日志与测试完善

## 16. 一句话总结

阶段一的 TS 架构应围绕单一语言训练 workflow 设计，用类型与模块边界控制复杂度，用 Node 生态自然接入 `codex`、后续 `opencode` 和 Obsidian 文件系统，从一开始就为后续平台化留接口，但不提前做过度抽象。
