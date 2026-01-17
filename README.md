# 工作记录看板

一个轻量的工作记录工具，支持 Todo / Doing / Done 看板、拖拽流转、计时统计与导出 Markdown。

## 功能

- 三列看板：Todo / Doing / Done
- 拖拽跨列与同列排序
- 双击空白新增，双击卡片编辑
- 一键完成（自动移动到 Done）
- Doing 累计时长、开始/完成时间记录
- 本地文件持久化（File System Access API）
- 导出 Markdown（按状态 -> 按周聚合）

## 使用方式

1. 直接用浏览器打开 `index.html`。
2. 点击“选择保存文件”，创建或选择 `work-board.json`。
3. 双击空白处新增；双击卡片编辑；拖拽卡片改变状态或排序。
4. 点击“导出 Markdown”生成周报/总结文件。

## 交互说明

- 完成按钮：点击卡片左侧小圆，自动移入 Done。
- 删除：点击卡片右侧 `×`。
- Doing 计时：进入 Doing 开始计时，离开暂停并累计。
- Doing 第一项高亮显示。

## 数据存储

- 默认使用浏览器 `localStorage`。
- 选择文件后，所有变更直接写入本地 JSON 文件。

## 导出格式

导出的 Markdown 结构：

```
## TODO
### 2026-01-12 ~ 2026-01-18
- 事项内容
  - 总时间：2h 15m
```

未开始（无开始时间）的事项会归到 `未开始` 分组。

## 兼容性

- 本地文件保存与导出依赖 File System Access API。
- 推荐使用 Chromium 内核浏览器（Chrome / Edge）。

## 开发说明

- 项目为纯静态页面，无需构建工具。
- 主要文件：`index.html`、`styles.css`、`app.js`。
