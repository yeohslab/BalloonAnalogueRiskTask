# 经典 BART（jsPsych 静态版）

本项目实现了经典 Balloon Analogue Risk Task（BART）风险决策偏好实验，采用纯静态网站架构，可直接部署到 GitHub Pages。

## 本地依赖（无 CDN）

项目已内置 jsPsych 运行依赖，不再从外部 CDN 拉取：

- `vendor/jspsych/jspsych-7.3.4.js`
- `vendor/jspsych/plugins/plugin-html-button-response-1.2.0.js`
- `vendor/jspsych/css/jspsych.css`

这样在网络不稳定或离线环境（如实验室内网）也能稳定运行。

## 实验参数

- 总试次：30（橙/黄/蓝各 10）
- 每次充气收益：`$0.05`
- 风险上限：`8 / 32 / 128`（实验开始时随机映射到三种颜色）
- 爆炸机制：每个气球独立抽样爆炸阈值 `1..maxPumps`；当 `pumps >= threshold` 时爆炸

## 指标输出

结束页会显示：

- 充气总次数（Total Pumps）
- 调整充气次数（Adjusted Pumps，排除爆炸试次后对充气次数取平均）
- 气球爆炸次数（Explosion Count）
- 总收益（Total Earnings）

并支持下载 CSV（逐试次数据）。

## 本地运行

推荐使用本地静态服务器运行：

1. 进入项目目录
2. 执行 `python -m http.server 8000`
3. 浏览器访问 `http://localhost:8000`

若在 Cursor 预览中调试，建议每次改动后使用强制刷新（Ctrl+Shift+R）。

## GitHub Pages 部署

1. 创建 GitHub 仓库并推送本目录内容到 `main` 分支。
2. 仓库进入 **Settings -> Pages**。
3. 在 **Build and deployment** 里选择：
   - Source: `Deploy from a branch`
   - Branch: `main` / `(root)`
4. 保存后等待部署完成。
5. 访问 `https://<你的用户名>.github.io/<仓库名>/`。

`.nojekyll` 文件已包含在项目中，避免静态资源被 Jekyll 特殊处理。
