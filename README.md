# BART：决策粒度与风险决策（jsPsych 静态版）

本项目在经典 Balloon Analogue Risk Task（BART）基础上实现 **被试内** 的 **高/低决策粒度** 操纵（单步金额不同），爆炸规则为 **1～M 次充气内均匀随机点**（见文档），采用纯静态网站架构，可直接部署到 GitHub Pages。

## 本地依赖（无 CDN）

项目已内置 jsPsych 运行依赖，不再从外部 CDN 拉取：

- `vendor/jspsych/jspsych-7.3.4.js`
- `vendor/jspsych/plugins/plugin-html-button-response-1.2.0.js`
- `vendor/jspsych/css/jspsych.css`

这样在网络不稳定或离线环境（如实验室内网）也能稳定运行。

## 实验参数（概要）

- **被试内**：首屏填写**编号（主试分配）**、**出生年月**、**性别**；随后**特质问卷**（《特质量表.md》，20 题 **1–4** 级）；每人 **2 个 block**（细、粗各 21 试次，顺序随机）；block 间有**休息**；每 block **前后**各测一次**压力量表**（与《量表,md》一致：各 **20** 题 **1–4** 级）；BART 结束后先有焦虑/难度 2 题（**1–10**），最后在汇总页前有《刺激评定量表》**2** 题（**1–4**，0.1 元与 5 元吸引力）。
- **试次**：每 block **21** 个气球，橙/黄/蓝各 **7**，该 block 内顺序随机打乱。
- **低粒度（粗）**：每次充气 `$5.00`；**高粒度（细）**（k=50）：每次充气 `$0.10`。
- **爆炸**：三色仅颜色不同，**M 恒为 64**；**N ~ Uniform{1,…,64}**；第 **k** 次后若未爆，本步概率 **1/(64−k+1)**。
- 编号仅用于归档（**由主试在首屏填写**，或 URL `?subj=` 预填）。详见 [实验参数.md](实验参数.md)。

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
3. 浏览器访问 `http://localhost:8000?subj=你的编号`（推荐，可跳过编号输入框）或 `http://localhost:8000`

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
