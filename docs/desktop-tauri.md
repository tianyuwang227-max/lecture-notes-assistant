# 第二版：桌面悬浮 Todo

目标：让每日 Todo 变成一个真正的桌面小组件，可以一直放在屏幕右侧或右上角，不依赖浏览器标签页。

## 第一阶段和第二阶段的区别

第一阶段：

- Cloudflare Pages 网页
- PWA 安装到桌面
- 打开 `/#mini` 显示 Todo 小窗
- 不能保证永远置顶

第二阶段：

- Tauri v2 桌面壳
- 窗口 always-on-top
- 窗口默认小尺寸
- 调用同一套 Cloudflare API
- 数据仍然以 D1 为准

## 环境要求

- Rust（通过 `brew install rust` 安装）
- Node.js 18+
- macOS / Windows / Linux

## 开发

```bash
# 安装依赖（首次）
brew install rust
npm install

# 启动桌面开发模式
npm run desktop

# 或直接
npm run tauri dev
```

## 配置

编辑 `src-tauri/tauri.conf.json`，将 `url` 改为你的 Cloudflare Pages 域名：

```json
{
  "app": {
    "windows": [
      {
        "url": "https://你的域名/#mini"
      }
    ]
  }
}
```

## 窗口行为

```text
宽度：360px
高度：540px
置顶：开启
边框：保留系统边框，方便拖动
关闭行为：隐藏到托盘（不退出应用）
```

## 托盘菜单

- 左键点击托盘图标：显示窗口
- 右键点击托盘图标：
  - 显示窗口
  - 隐藏窗口
  - 退出

## 数据流

```text
Tauri 小组件
  -> 打开 Cloudflare Pages 的 /#mini
  -> 页面请求 /api/state
  -> Cloudflare Function 读写 D1
```

网页端、手机端、桌面小组件都使用同一份数据。

## 构建发布版

```bash
npm run tauri build
```

构建产物在 `src-tauri/target/release/` 或 `src-tauri/target/release/bundle/`。

## 项目结构

```text
src-tauri/
  Cargo.toml          # Rust 依赖配置
  build.rs            # Tauri 构建脚本
  tauri.conf.json     # Tauri 应用配置
  capabilities/
    default.json      # 权限声明
  icons/
    icon.png          # 应用图标
  src/
    main.rs           # 入口
    lib.rs            # 应用逻辑（窗口、托盘菜单）
```

## 验收标准

- 打开电脑后能启动 Todo 小组件
- 小组件能显示今天的 Todo
- 勾选后文字划线
- 新增 Todo 后网页端也能看到
- 窗口能置顶，不挡住主要网课区域
- 关闭窗口不丢数据（隐藏到托盘）

## 暂不做

- 不做复杂日历
- 不做系统通知
- 不做离线冲突合并
- 不把笔记编辑器放进桌面壳

桌面壳只服务一个目的：让今日 Todo 随时可见。
