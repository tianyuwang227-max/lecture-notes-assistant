# 听课笔记桌面

一个轻量的听课笔记网页：听网课时快速记录，课后整理成文档笔记，每天用 Todo 小窗提醒自己要做什么。

## 第一版功能

- `/` 单页应用，左侧切换功能区
- 速记：听课时快速输入，自动带时间
- 文档笔记：每门课程可建多篇正式笔记，可把未整理速记追加进去，避免重复整理
- Markdown 导出：单篇文档和整门课程都可以导出为 `.md`
- 今日 Todo：自己填写计划，完成后自动划线
- 桌面小窗：打开 `/#mini`，或在页面里点击“弹出 Todo 小窗”
- Todo 日常操作：统计剩余/完成，清理已完成，未完成带到明天，过期未完成可带到今天
- PWA：部署后可以安装成桌面应用，默认打开 Todo 小窗
- 课程管理：页面内直接新建课程/笔记，按课程归档速记和文档
- 搜索：可以搜索课程、文档、速记和 Todo
- 数据备份：课程页可以导出/导入 JSON 备份
- 个人同步保护：Cloudflare 可设置 `APP_KEY`，前端填写同一密钥后才同步
- 本地优先保存：未部署也能用 localStorage
- Cloudflare D1 同步：部署后通过 `/api/state` 保存云端数据

## 本地运行

不安装依赖也可以直接跑静态页面：

```bash
python3 -m http.server 5174 --directory src
```

打开：

```text
http://localhost:5174
```

桌面 Todo 小窗：

```text
http://localhost:5174/#mini
```

在主页面的“今日 Todo”或“速记”里，也可以点击“弹出 Todo 小窗”，浏览器会打开一个窄窗口放在桌面旁边。

如果要用 Cloudflare Pages Functions 和 D1：

```bash
npm install
npm run dev
```

本地测试同步密钥时，可以复制示例文件：

```bash
cp .dev.vars.example .dev.vars
```

然后把 `.dev.vars` 里的 `APP_KEY` 改成你自己的密钥。

## Cloudflare D1

创建 D1 数据库后执行：

```bash
npx wrangler d1 execute lecture_notes_assistant --file=./schema.sql
```

然后把 `wrangler.toml` 里的 `database_id` 换成你的 D1 database id。

## 数据备份

进入“课程”页面：

- “导出备份”会下载一个 JSON 文件
- “导入备份”可以恢复之前导出的 JSON

在 D1 没部署前，这个功能可以先保护你的本地笔记和 Todo。

## 部署

Cloudflare Pages 设置：

- Build command: 留空
- Build output directory: `src`
- Functions directory: `functions`
- D1 binding: `DB`
- Environment variable: `APP_KEY=你自己的同步密钥`

部署后访问：

```text
https://你的域名/#mini
```

浏览器菜单里选择“安装应用”后，它会像一个独立小窗口一样打开今日 Todo。

第一次部署后，进入“课程”页面，在“云同步密钥”里填入同一个 `APP_KEY`。不填密钥时，本地仍然能保存，但不会读写受保护的 D1 数据。

## 第二版方向

第二版做真正桌面悬浮 Todo，建议用 Tauri。网页继续作为主系统，Tauri 小组件只显示和编辑今日 Todo，并复用同一套 Cloudflare API。

详细方案见 [docs/desktop-tauri.md](./docs/desktop-tauri.md)。
