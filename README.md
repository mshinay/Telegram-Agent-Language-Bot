# Telegram 语言学习助手

一个基于 Telegram 的单用户语言训练 Agent，支持课程生成、逐题反馈、会话恢复，以及 Obsidian 笔记沉淀。

---

## 1. 概述

该系统是一个以 Telegram 为入口的语言训练应用，用于日语与英语练习。

核心能力包括：

* 自动生成训练材料与题目
* 对用户答案逐题反馈
* 生成总结并写入 Obsidian
* 形成“训练 → 反馈 → 沉淀”的闭环

适用于每日短周期语言训练。

---

## 2. 核心流程

```
Telegram → Router → Workflow → Agent → Obsidian
```

流程说明：

1. 用户通过 `/ja` 或 `/en` 开始训练
2. Router 根据当前状态解析用户输入
3. Workflow 负责训练流程推进
4. Agent 生成题目 / 评估答案 / 生成总结
5. Session 状态持久化到本地 JSON
6. 用户确认后写入 Obsidian（Journal / Mistakes / Expressions）

---

## 3. 功能特性

### 技术栈
  
     - Node.js 20+
     - TypeScript
     - grammy
     - Zod
     - pino
     - 本地 Codex CLI
     - Obsidian Markdown Vault


### Telegram 交互

* 基于 long polling 接收消息
* 仅允许单用户访问
* 支持命令控制训练流程
* 自动拆分长消息

---

### 训练流程

* 每轮包含：

  * 1 段材料
  * 3 道题
* 支持逐题反馈
* 支持提前结束 `/end`
* 自动生成总结草稿
* 支持：

  * 重写总结
  * 确认写入
  * 放弃写入
* 支持中断恢复

---

### 会话管理

* 使用本地 JSON 持久化单 session
* 记录：

  * 当前题目
  * 用户答案
  * 反馈
  * 总结草稿
* 启动时自动修复异常状态
* 支持损坏文件恢复

---

### Obsidian 集成

* 将训练结果写入 Obsidian vault
* 包含三类产物：

  * Journal（完整记录）
  * Mistakes（错误汇总）
  * Expressions（表达积累）
* 所有写入限制在 vault 内

---

### Agent 执行

* 使用本地 Codex CLI
* 支持：

  * 课程生成
  * 答案评估
  * 总结生成
* 所有输出：

  * 必须是 JSON
  * 通过 Zod 校验
* 支持异常处理：

  * 执行失败
  * JSON 解析失败
  * schema 校验失败

---

## 4. 系统架构

### Bot 层

负责 Telegram 消息收发与权限控制。

### Router

将用户输入映射为业务动作。

### Workflow

核心业务层，负责：

* 状态流转
* 训练流程
* agent 调度
* 写入控制

### Agent 层

* 构建 prompt
* 调用 Codex CLI
* 解析与校验输出

### Session Store

* 本地 JSON 持久化
* 状态恢复与修复

### Obsidian Store

* Markdown 读写
* 限制在 vault 范围内

---

## 5. 状态模型

系统状态：

* `idle`
* `in_lesson`
* `awaiting_summary_confirmation`
* `interrupted`

关键流转：

* `idle → in_lesson`：开始训练
* `in_lesson → awaiting_summary_confirmation`：完成或结束训练
* `in_lesson → interrupted`：异常中断
* `interrupted → in_lesson`：恢复训练
* `awaiting_summary_confirmation → idle`：确认或放弃写入

---

## 6. 快速开始

### 环境要求

* Node.js
* TypeScript
* Telegram Bot Token
* 本地 Codex CLI
* Obsidian vault 路径

---

### 配置

配置来源：

* `config/default.json`
* `.env`

关键配置：

* Telegram（token / chatId）
* Session 文件路径
* Agent 命令与超时
* Obsidian vault 路径
* 日志级别

---
填写.env.example的配置项，并重命名成.env

```bash
cd myclaw
npm install
npm run dev
```

---

## 7. 命令说明

### Telegram 命令

* `/ja`：开始日语训练
* `/en`：开始英语训练
* `/summary`：查看总结草稿
* `/end`：结束训练
* `/ping`：连通性检查

---

### 文本操作

* `恢复上次训练`
* `放弃并开始新的训练`
* `确认写入`
* `重写总结`
* `不写入`

---

### 行为说明

在 `in_lesson` 状态下：

👉 普通文本 = 当前题答案

---

## 8. 项目结构

```
src/
  agent/
  obsidian/
  prompts/
  router/
  session/
  telegram/
  workflow/
```

说明：

* `telegram`：入口层
* `router`：输入解析
* `workflow`：核心逻辑
* `agent`：LLM 执行
* `session`：短期状态
* `obsidian`：长期存储
* `prompts`：Prompt 构建

---

## 9. 路线图

当前：

* 已完成 Stage 1 MVP
* 支持完整训练闭环

下一步：

* 稳定性提升
* 错误处理完善
* 增加测试覆盖

长期：

* 利用历史数据生成训练
* 抽象 workflow 层
* 演进为通用 agent 平台

---

## 10. 设计原则

* 小范围优先：单用户、单 session
* 分层清晰：Router 与 Workflow 解耦
* 强约束输出：所有 agent 输出必须结构化
* 双层存储：

  * session（短期）
  * obsidian（长期）
* 写入边界严格控制

---