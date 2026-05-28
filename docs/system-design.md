# 系统设计

## 产品结构

```text
听课时：/quick 思路
课后：/notes 文档笔记
每天：/today Todo
桌面提醒：/#mini，也就是当前的小窗排版
管理：/courses
```

当前实现是单页应用，使用 hash 路由切换视图。这样第一版不需要构建工具，直接可部署到 Cloudflare Pages。

## 数据策略

第一版采用 local-first：

1. 页面先写入 `localStorage`
2. 如果部署了 Cloudflare Pages Functions，则自动请求 `/api/state`
3. `/api/state` 把整个应用状态保存到 D1 的 `app_state` 表

这样本地打开也能用，部署后可以同步。

课程页提供 JSON 备份：

- 导出当前完整 state
- 导入本应用导出的 JSON
- 导入后仍然会写入 localStorage，并继续尝试同步 D1

云同步保护：

- Cloudflare Pages 环境变量 `APP_KEY` 存放个人同步密钥
- `/api/state` 会校验 `x-app-key` 或 `Authorization: Bearer`
- 前端只把密钥存入本地浏览器的 `localStorage`
- 备份 JSON 不包含同步密钥

## D1 表

第一版为了简单可靠，只用一个快照表：

```sql
create table if not exists app_state (
  id text primary key,
  data text not null,
  updated_at text not null default (datetime('now'))
);
```

第二阶段可以拆成结构化表：

- `courses`
- `quick_notes`
- `notes`
- `todos`
- `settings`

## 页面说明

### 速记

输入规则：

- `? 内容` 记录为问题
- `[] 内容` 记录为待办，并自动加入今日 Todo
- `! 内容` 记录为重点
- 普通输入记录为普通速记

### 文档笔记

每门课程有一篇文档。点击“整理到文档笔记”会把本课程的速记追加到文档末尾。

### 今日 Todo

Todo 只按当天日期展示。完成后设置 `done=true`，界面上加删除线。

日常操作：

- 显示剩余数量和完成数量
- 可以清理当天已完成 Todo
- 未完成 Todo 可以带到明天
- 同一天重复点击“带到明天”不会重复复制同一条内容
- 今天以前未完成的 Todo 会显示在“过期未完成”
- “过期未完成”可以一键带到今天，且同一条不会重复带入

### 桌面小窗

小窗视图隐藏侧栏和顶部，只保留今日 Todo。第一版适合用浏览器小窗口或 PWA 放在桌面右侧。

PWA 的 `start_url` 指向 `./#mini`，安装到桌面后默认进入今日 Todo 小窗。

主界面也提供“弹出 Todo 小窗”，它会用 `window.open` 打开一个约 380x560 的小窗口。

## 第二版桌面悬浮

建议用 Tauri：

- 窗口小
- 可设置 always-on-top
- 占用资源低
- 调用同一套 Cloudflare API

第二版不需要改掉网页主系统，只要新增桌面壳。
