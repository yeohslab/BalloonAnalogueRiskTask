(() => {
  const jsPsychInstance = initJsPsych({
    show_progress_bar: false
  });
  const ParameterType = window.jsPsychModule?.ParameterType || window.jsPsych?.ParameterType;

  const CONFIG = {
    /** 每 block 内每种颜色气球数量（共 3×7=21 试次，随机打乱顺序） */
    trialCountPerColor: 7,
    colors: ["orange", "yellow", "blue"],
    /** 所有颜色气球爆炸上限相同，仅外观颜色不同 */
    explosionCapM: 64,
    baseScale: 1,
    scalePerPump: 0.015,
    maxScale: 2.4,
    /** 低粒度（粗）单泵金额；高粒度（细）单泵 = 此值 / granularityK */
    baseRewardPerEffectiveStep: 5,
    /** 与粗/细金额耦合：细颗粒 = 5/50 = 0.1 */
    granularityK: 50
  };

  const DESIGN = "within_subjects";

  /** 与项目内《量表,md》一致：20 题，1–4 级（程序中 response 为 0–3，存档 +1 为 1–4） */
  const STRESS_SCALE_ITEMS = [
    "感到心情平静。",
    "我感到安全。",
    "我是紧张的。",
    "我感到紧张束缚。",
    "我感到安逸。",
    "我感到烦乱。",
    "我现在正烦恼，感到这种烦恼超过了可能的不幸。",
    "我感到满意。",
    "我感到害怕。",
    "我感到舒适。",
    "我有自信心。",
    "我觉得神经过敏。",
    "我极度紧张不安。",
    "优柔寡断。",
    "我是轻松的。",
    "我感到心满意足。",
    "我是烦恼的。",
    "我感到慌乱。",
    "我感到镇定。",
    "我感到愉快。"
  ];

  const STRESS_S_KEYS = Array.from(
    { length: STRESS_SCALE_ITEMS.length },
    (_, i) => `stress_s${String(i + 1).padStart(2, "0")}`
  );

  const EMPTY_STRESS_FIELDS = Object.fromEntries(STRESS_S_KEYS.map((k) => [k, ""]));

  /** 与项目内《特质量表.md》一致：20 题，1–4 级（存档为 1–4） */
  const TRAIT_SCALE_ITEMS = [
    "我感到愉快。",
    "感到神经过敏和不安。",
    "我感到自我满足。",
    "我希望能和别人那样地高兴。",
    "我感到我像衰竭一样。",
    "我感到很宁静。",
    "我是平静的、冷静的和泰然自若的。",
    "我感到困难一一堆积起来，因此无法克服。",
    "我过分忧虑一些事，实际这些事无关紧要。",
    "我是高兴的。",
    "我的思想处于混乱状态。",
    "我缺乏自信心。",
    "我感到安全。",
    "我容易做出决断。",
    "我感到不合适。",
    "我是满足的。",
    "一些不重要的思想总缠绕着我，并打扰我。",
    "我产生的沮丧是如此强烈，以致我不能从思想上排除它们。",
    "我是一个镇定的人。",
    "当我考虑我目前的事情和利益时就陷入紧张状态。"
  ];

  /** 与《特质量表.md》首行评定说明一致（HTML） */
  const TRAIT_RATING_INSTRUCTION =
    "采用<strong>1–4</strong>级评定：1—几乎没有；2—有些；3—中等程度或是经常有；4—非常明显或几乎总是如此。";

  const TRAIT_T_KEYS = Array.from(
    { length: TRAIT_SCALE_ITEMS.length },
    (_, i) => `trait_t${String(i + 1).padStart(2, "0")}`
  );

  const EMPTY_TRAIT_FIELDS = Object.fromEntries(TRAIT_T_KEYS.map((k) => [k, ""]));

  /** 与《刺激评定量表.md》一致的 1–4 说明（与状态/特质量表措辞略有不同） */
  const STIM_RATING_INSTRUCTION =
    "采用<strong>1–4</strong>级评定：1—几乎没有；2—有些；3—中等程度；4—非常明显。";

  const STIM_ATTRACT_KEYS = ["stim_attract_01", "stim_attract_5"];
  const EMPTY_STIM_FIELDS = Object.fromEntries(STIM_ATTRACT_KEYS.map((k) => [k, ""]));

  let subjectNumber = 0;
  let subjectId = "";
  let totalEarnings = 0;
  /** BART 试次 + 区块自评，供下载与分析 */
  const bartResults = [];
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const blockGranOrder = shuffle(["high", "low"]);
  const blockOrderLabel = blockGranOrder[0] === "high" ? "high_first" : "low_first";

  function parseSubjectFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    for (const key of ["subj", "subject", "id", "sid"]) {
      const raw = params.get(key);
      if (raw == null || String(raw).trim() === "") continue;
      const n = Number.parseInt(String(raw).trim(), 10);
      if (Number.isFinite(n) && n > 0) return String(raw).trim();
    }
    return "";
  }

  /** 自出生年月至当前日期的完整月数（用于自报出生年月时的年龄操作化） */
  function computeAgeMonths(birthYYYYMM) {
    const m = /^(\d{4})-(\d{2})$/.exec(birthYYYYMM);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    const d = new Date();
    const cm = d.getFullYear() * 12 + d.getMonth() + 1;
    const bm = y * 12 + mo;
    const months = cm - bm;
    return months >= 0 ? months : null;
  }

  const DEMO_FIELDS = ["birth_month", "gender", "age_months"];
  const EMPTY_DEMO_FIELDS = Object.fromEntries(DEMO_FIELDS.map((k) => [k, ""]));

  class DemographicsPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    static info = {
      name: "bart-demographics",
      parameters: {
        _pad: { type: ParameterType.INT, default: 0 }
      }
    };

    trial(display_element) {
      const urlPref = parseSubjectFromUrl();
      display_element.innerHTML = `
        <div class="bart-wrapper bart-demo-wrap">
          <h2 class="bart-demo-title">基本信息</h2>
          <p class="bart-demo-hint">被试编号由<strong>主试</strong>分配并填写；出生年月精确到月；请选择性别。</p>
          <div class="bart-demo-form">
            <label class="bart-demo-label" for="bart-subj-num">被试编号</label>
            <input type="number" id="bart-subj-num" class="bart-demo-input" min="1" step="1" inputmode="numeric" autocomplete="off" />
            <label class="bart-demo-label" for="bart-birth-month">出生年月</label>
            <input type="month" id="bart-birth-month" class="bart-demo-input" />
            <span class="bart-demo-label">性别</span>
            <div class="bart-demo-genders">
              <label class="bart-demo-radio"><input type="radio" name="bart-gender" value="男" /> 男</label>
              <label class="bart-demo-radio"><input type="radio" name="bart-gender" value="女" /> 女</label>
              <label class="bart-demo-radio"><input type="radio" name="bart-gender" value="其他" /> 其他</label>
            </div>
            <button type="button" class="bart-btn bart-demo-submit" id="bart-demo-submit">确认并继续</button>
          </div>
        </div>`;
      const numInput = display_element.querySelector("#bart-subj-num");
      if (urlPref) {
        const n = Number.parseInt(urlPref, 10);
        if (Number.isFinite(n) && n > 0) numInput.value = String(n);
      }
      const start = performance.now();
      display_element.querySelector("#bart-demo-submit").addEventListener("click", () => {
        const raw = numInput.value.trim();
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) {
          window.alert("请填写主试分配的被试编号（正整数）。");
          return;
        }
        const birth = display_element.querySelector("#bart-birth-month").value;
        if (!birth) {
          window.alert("请选择出生年月。");
          return;
        }
        const genderEl = display_element.querySelector('input[name="bart-gender"]:checked');
        if (!genderEl) {
          window.alert("请选择性别。");
          return;
        }
        subjectNumber = n;
        subjectId = `S${n}`;
        const ageM = computeAgeMonths(birth);
        bartResults.push({
          task: "bart_demographics",
          subject_id: subjectId,
          subject_number: subjectNumber,
          design: DESIGN,
          balance_rule: "n_a",
          block_index: 0,
          block_order: blockOrderLabel,
          birth_month: birth,
          gender: genderEl.value,
          age_months: ageM != null ? ageM : "",
          rt: Number((performance.now() - start).toFixed(2))
        });
        this.jsPsych.finishTrial({
          subject_number: subjectNumber,
          subject_id: subjectId
        });
      });
    }
  }

  function makeDemographicsTimeline() {
    return [{ type: DemographicsPlugin }];
  }

  /**
   * 等价于爆炸点 N ~ Uniform{1,…,M}：第 k 次充气后，若尚未爆炸，则本步爆炸概率为 1/(M−k+1)。
   * @param {number} pumpsAfterClick 本次点击后的累计充气次数 k
   * @param {number} M 爆炸充气上限（各气球相同，由 CONFIG.explosionCapM 指定，当前为 64）
   */
  function shouldExplodeAfterPump(pumpsAfterClick, M) {
    if (pumpsAfterClick >= M) return true;
    return Math.random() < 1 / (M - pumpsAfterClick + 1);
  }

  const audioCollect = new Audio("material/collect.m4a");
  const audioExplode = new Audio("material/explode.m4a");

  function playSfx(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function money(v) {
    return `$${v.toFixed(2)}`;
  }

  function getColorName(color) {
    if (color === "orange") return "橙色";
    if (color === "yellow") return "黄色";
    return "蓝色";
  }

  function getGranularityLabel(granularity) {
    return granularity === "high" ? "高粒度（多步小额）" : "低粒度（少步大额）";
  }

  /**
   * @param {"high"|"low"} _granularity 保留参数以便与调用方一致；试次池不依赖粒度
   */
  function buildTrials(_granularity) {
    const pool = [];
    const M = CONFIG.explosionCapM;
    CONFIG.colors.forEach((color) => {
      for (let i = 0; i < CONFIG.trialCountPerColor; i += 1) {
        pool.push({
          color,
          maxPumps: M
        });
      }
    });
    return shuffle(pool);
  }

  class BartPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    static info = {
      name: "bart-plugin",
      parameters: {
        trial_index_global: { type: ParameterType.INT, default: 0 },
        total_trials_in_block: { type: ParameterType.INT, default: 21 },
        trial_index_in_block: { type: ParameterType.INT, default: 1 },
        balloon_color: { type: ParameterType.STRING, default: "orange" },
        max_pumps: { type: ParameterType.INT, default: 8 },
        granularity: { type: ParameterType.STRING, default: "high" },
        granularity_k: { type: ParameterType.INT, default: 50 },
        base_reward_per_effective_step: { type: ParameterType.FLOAT, default: 5 },
        pumps_per_click: { type: ParameterType.FLOAT, default: 0.1 },
        block_index: { type: ParameterType.INT, default: 1 },
        block_order: { type: ParameterType.STRING, default: "" },
        subject_number: { type: ParameterType.INT, default: 0 },
        design: { type: ParameterType.STRING, default: "within_subjects" },
        balance_rule: { type: ParameterType.STRING, default: "" }
      }
    };

    trial(display_element, trial) {
      const trialStart = performance.now();
      const pumpRts = [];
      let pumps = 0;
      let exploded = false;
      let cashedOut = false;
      let trialEarning = 0;
      let locked = false;
      const pumpLabel = money(trial.pumps_per_click);

      display_element.innerHTML = `
        <div class="bart-wrapper">
          <div class="bart-top">
            <div>第 ${trial.block_index}/2 部分 · ${getGranularityLabel(trial.granularity)} · 试次 ${trial.trial_index_in_block}/${trial.total_trials_in_block}</div>
            <div>编号 <strong>${trial.subject_number}</strong> · ${getColorName(trial.balloon_color)}气球</div>
            <div>本气球 <span id="current-earning">${money(0)}</span> · 本部分累计 <span id="total-earning">${money(totalEarnings)}</span></div>
          </div>
          <div class="bart-main">
            <div class="balloon-stage">
              <div id="balloon" class="balloon balloon-${trial.balloon_color}"></div>
            </div>
            <div id="status" class="bart-status">点击“充气”开始本试次</div>
            <div class="bart-controls">
              <button id="pump-btn" class="bart-btn btn-pump">充气 (+${pumpLabel})</button>
              <button id="cash-btn" class="bart-btn btn-cash">收账</button>
            </div>
          </div>
        </div>
      `;

      const balloonEl = display_element.querySelector("#balloon");
      const pumpBtn = display_element.querySelector("#pump-btn");
      const cashBtn = display_element.querySelector("#cash-btn");
      const statusEl = display_element.querySelector("#status");
      const currentEarningEl = display_element.querySelector("#current-earning");
      const totalEarningEl = display_element.querySelector("#total-earning");

      /** 视觉缩放按「点击次数」计，避免高粒度下 pumps/k 导致每泵增量过小、看起来不膨胀 */
      function refreshBalloonScale() {
        const scale = Math.min(
          CONFIG.maxScale,
          CONFIG.baseScale + pumps * CONFIG.scalePerPump
        );
        balloonEl.style.transform = `scale(${scale.toFixed(3)})`;
      }

      const endTrial = (reason) => {
        locked = true;
        pumpBtn.disabled = true;
        cashBtn.disabled = true;

        const adjustedForThisTrial = exploded ? null : pumps;
        const rtSummary = {
          mean_pump_rt:
            pumpRts.length > 0
              ? Number((pumpRts.reduce((a, b) => a + b, 0) / pumpRts.length).toFixed(2))
              : null,
          pump_count_with_rt: pumpRts.length
        };

        const data = {
          task: "bart_trial",
          subject_id: subjectId,
          subject_number: trial.subject_number,
          design: trial.design,
          balance_rule: trial.balance_rule,
          trial_index: trial.trial_index_global,
          trial_index_in_block: trial.trial_index_in_block,
          block_index: trial.block_index,
          block_order: trial.block_order,
          granularity: trial.granularity,
          granularity_k: trial.granularity_k,
          base_reward_per_effective_step: trial.base_reward_per_effective_step,
          pumps_per_click: trial.pumps_per_click,
          balloon_color: trial.balloon_color,
          risk_type: trial.max_pumps,
          explosion_model: "uniform_1_M",
          pumps,
          exploded,
          cashed_out: cashedOut,
          trial_earning: Number(trialEarning.toFixed(2)),
          total_earning_after_trial: Number(totalEarnings.toFixed(2)),
          adjusted_pumps: adjustedForThisTrial,
          end_reason: reason,
          rt_summary: JSON.stringify(rtSummary),
          rt: Number((performance.now() - trialStart).toFixed(2))
        };

        bartResults.push(data);
        this.jsPsych.finishTrial(data);
      };

      pumpBtn.addEventListener("click", () => {
        if (locked) return;
        const now = performance.now();
        pumpRts.push(Number((now - trialStart).toFixed(2)));

        pumps += 1;
        trialEarning += trial.pumps_per_click;
        refreshBalloonScale();
        currentEarningEl.textContent = money(trialEarning);

        const M = trial.max_pumps;
        if (shouldExplodeAfterPump(pumps, M)) {
          exploded = true;
          trialEarning = 0;
          currentEarningEl.textContent = money(0);
          statusEl.textContent = "气球爆炸！本试次收益清零。";
          balloonEl.classList.add("exploded");
          playSfx(audioExplode);
          setTimeout(() => endTrial("explode"), 280);
        } else {
          statusEl.textContent = `已充气 ${pumps} 次，继续还是收账？`;
        }
      });

      cashBtn.addEventListener("click", () => {
        if (locked) return;
        cashedOut = true;
        totalEarnings += trialEarning;
        totalEarningEl.textContent = money(totalEarnings);
        statusEl.textContent = `已收账 ${money(trialEarning)}，进入下一试次。`;
        playSfx(audioCollect);
        setTimeout(() => endTrial("cash_out"), 180);
      });
    }
  }

  function summarizeBartTrials(rows) {
    const totalPumps = rows.reduce((sum, r) => sum + r.pumps, 0);
    const nonExploded = rows.filter((r) => !r.exploded);
    const adjustedPumps =
      nonExploded.length > 0
        ? Number(
            (
              nonExploded.reduce((sum, r) => sum + r.pumps, 0) / nonExploded.length
            ).toFixed(2)
          )
        : 0;
    const explosionCount = rows.filter((r) => r.exploded).length;
    const blockEarning = rows.reduce((sum, r) => {
      if (r.exploded) return sum;
      return sum + (r.trial_earning || 0);
    }, 0);
    return { totalPumps, adjustedPumps, explosionCount, blockEarning };
  }

  function buildSummaryHtml() {
    const trials = bartResults.filter((r) => r.task === "bart_trial");
    const b1 = trials.filter((r) => r.block_index === 1);
    const b2 = trials.filter((r) => r.block_index === 2);
    const s1 = summarizeBartTrials(b1);
    const s2 = summarizeBartTrials(b2);
    const all = summarizeBartTrials(trials);
    const g1 = b1[0]?.granularity ?? "";
    const g2 = b2[0]?.granularity ?? "";

    const demo = bartResults.find((r) => r.task === "bart_demographics");
    const demoLine =
      demo != null
        ? `<p>人口学：出生年月 <strong>${demo.birth_month ?? "—"}</strong> · 性别 <strong>${demo.gender ?? "—"}</strong> · 距出生 <strong>${demo.age_months ?? "—"}</strong> 个月</p>`
        : "";

    return `
      <div class="bart-wrapper">
        <div class="bart-main">
          <div class="summary">
            <h2>实验完成</h2>
            <p>被试编号：<strong>${subjectId}</strong>（数字编号 <strong>${subjectNumber}</strong>）</p>
            ${demoLine}
            <p>设计：<strong>被试内</strong>（两 block）；区块顺序：<strong>${blockOrderLabel}</strong></p>
            <p>第 1 部分：<strong>${getGranularityLabel(g1)}</strong> · 充气 <strong>${s1.totalPumps}</strong> · 爆炸 <strong>${s1.explosionCount}</strong> · 调整充气 <strong>${s1.adjustedPumps}</strong> · 本部分收益 <strong>${money(s1.blockEarning)}</strong></p>
            <p>第 2 部分：<strong>${getGranularityLabel(g2)}</strong> · 充气 <strong>${s2.totalPumps}</strong> · 爆炸 <strong>${s2.explosionCount}</strong> · 调整充气 <strong>${s2.adjustedPumps}</strong> · 本部分收益 <strong>${money(s2.blockEarning)}</strong></p>
            <p>全程合并：充气总次数 <strong>${all.totalPumps}</strong>；调整充气 <strong>${all.adjustedPumps}</strong>；爆炸 <strong>${all.explosionCount}</strong></p>
            <p>当前累计总收益（以最后一部分为准）：<strong>${money(totalEarnings)}</strong></p>
            <div class="bart-controls">
              <button id="download-csv" class="bart-btn btn-download">下载 CSV 数据</button>
              <button id="finish-exp" class="bart-btn btn-finish">结束实验</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const CSV_HEADERS = [
    "subject_id",
    "subject_number",
    "birth_month",
    "gender",
    "age_months",
    "design",
    "balance_rule",
    "task",
    "block_index",
    "block_order",
    "granularity",
    "granularity_k",
    "base_reward_per_effective_step",
    "trial_index",
    "trial_index_in_block",
    "balloon_color",
    "risk_type",
    "explosion_model",
    "pumps_per_click",
    "pumps",
    "exploded",
    "cashed_out",
    "trial_earning",
    "total_earning_after_trial",
    "adjusted_pumps",
    "end_reason",
    "measure_phase",
    ...STRESS_S_KEYS,
    ...TRAIT_T_KEYS,
    "anxiety_rating",
    "difficulty_rating",
    "stim_attract_01",
    "stim_attract_5",
    "rt_summary",
    "rt"
  ];

  function toCsv(rows) {
    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [CSV_HEADERS.join(",")];
    rows.forEach((row) => {
      lines.push(CSV_HEADERS.map((h) => esc(row[h])).join(","));
    });
    return lines.join("\n");
  }

  function rowForCsv(r) {
    if (r.task === "bart_demographics") {
      return {
        subject_id: r.subject_id,
        subject_number: r.subject_number,
        birth_month: r.birth_month ?? "",
        gender: r.gender ?? "",
        age_months: r.age_months ?? "",
        design: r.design,
        balance_rule: r.balance_rule ?? "",
        task: r.task,
        block_index: r.block_index ?? "",
        block_order: r.block_order,
        granularity: "",
        granularity_k: "",
        base_reward_per_effective_step: "",
        trial_index: "",
        trial_index_in_block: "",
        balloon_color: "",
        risk_type: "",
        explosion_model: "",
        pumps_per_click: "",
        pumps: "",
        exploded: "",
        cashed_out: "",
        trial_earning: "",
        total_earning_after_trial: "",
        adjusted_pumps: "",
        end_reason: "",
        measure_phase: "",
        ...EMPTY_STRESS_FIELDS,
        ...EMPTY_TRAIT_FIELDS,
        ...EMPTY_STIM_FIELDS,
        anxiety_rating: "",
        difficulty_rating: "",
        rt_summary: "",
        rt: r.rt ?? ""
      };
    }
    if (r.task === "bart_trait_scale") {
      return {
        subject_id: r.subject_id,
        subject_number: r.subject_number,
        ...EMPTY_DEMO_FIELDS,
        design: r.design,
        balance_rule: r.balance_rule ?? "",
        task: r.task,
        block_index: r.block_index ?? "",
        block_order: r.block_order,
        granularity: r.granularity ?? "",
        granularity_k: r.granularity_k ?? "",
        base_reward_per_effective_step: r.base_reward_per_effective_step ?? "",
        trial_index: "",
        trial_index_in_block: "",
        balloon_color: "",
        risk_type: "",
        explosion_model: "",
        pumps_per_click: "",
        pumps: "",
        exploded: "",
        cashed_out: "",
        trial_earning: "",
        total_earning_after_trial: "",
        adjusted_pumps: "",
        end_reason: "",
        measure_phase: "",
        ...EMPTY_STRESS_FIELDS,
        ...TRAIT_T_KEYS.reduce((acc, k) => {
          acc[k] = r[k] ?? "";
          return acc;
        }, {}),
        ...EMPTY_STIM_FIELDS,
        anxiety_rating: "",
        difficulty_rating: "",
        rt_summary: "",
        rt: r.rt ?? ""
      };
    }
    if (r.task === "bart_stress_scale") {
      return {
        subject_id: r.subject_id,
        subject_number: r.subject_number,
        ...EMPTY_DEMO_FIELDS,
        design: r.design,
        balance_rule: r.balance_rule ?? "",
        task: r.task,
        block_index: r.block_index,
        block_order: r.block_order,
        granularity: r.granularity ?? "",
        granularity_k: r.granularity_k ?? "",
        base_reward_per_effective_step: r.base_reward_per_effective_step ?? "",
        trial_index: "",
        trial_index_in_block: "",
        balloon_color: "",
        risk_type: "",
        explosion_model: "",
        pumps_per_click: "",
        pumps: "",
        exploded: "",
        cashed_out: "",
        trial_earning: "",
        total_earning_after_trial: "",
        adjusted_pumps: "",
        end_reason: "",
        measure_phase: r.measure_phase,
        ...STRESS_S_KEYS.reduce((acc, k) => {
          acc[k] = r[k] ?? "";
          return acc;
        }, {}),
        ...EMPTY_TRAIT_FIELDS,
        ...EMPTY_STIM_FIELDS,
        anxiety_rating: "",
        difficulty_rating: "",
        rt_summary: "",
        rt: r.rt ?? ""
      };
    }
    if (r.task === "bart_block_self_report") {
      return {
        subject_id: r.subject_id,
        subject_number: r.subject_number,
        ...EMPTY_DEMO_FIELDS,
        design: r.design,
        balance_rule: r.balance_rule ?? "",
        task: r.task,
        block_index: r.block_index,
        block_order: r.block_order,
        granularity: r.granularity,
        granularity_k: r.granularity_k,
        base_reward_per_effective_step: r.base_reward_per_effective_step,
        trial_index: "",
        trial_index_in_block: "",
        balloon_color: "",
        risk_type: "",
        explosion_model: "",
        pumps_per_click: "",
        pumps: "",
        exploded: "",
        cashed_out: "",
        trial_earning: "",
        total_earning_after_trial: "",
        adjusted_pumps: "",
        end_reason: "",
        measure_phase: "",
        ...EMPTY_STRESS_FIELDS,
        ...EMPTY_TRAIT_FIELDS,
        ...EMPTY_STIM_FIELDS,
        anxiety_rating: r.anxiety_rating,
        difficulty_rating: r.difficulty_rating,
        rt_summary: "",
        rt: r.rt ?? ""
      };
    }
    if (r.task === "bart_stimulus_rating") {
      return {
        subject_id: r.subject_id,
        subject_number: r.subject_number,
        ...EMPTY_DEMO_FIELDS,
        design: r.design,
        balance_rule: r.balance_rule ?? "",
        task: r.task,
        block_index: r.block_index ?? "",
        block_order: r.block_order,
        granularity: r.granularity ?? "",
        granularity_k: r.granularity_k ?? "",
        base_reward_per_effective_step: r.base_reward_per_effective_step ?? "",
        trial_index: "",
        trial_index_in_block: "",
        balloon_color: "",
        risk_type: "",
        explosion_model: "",
        pumps_per_click: "",
        pumps: "",
        exploded: "",
        cashed_out: "",
        trial_earning: "",
        total_earning_after_trial: "",
        adjusted_pumps: "",
        end_reason: "",
        measure_phase: "",
        ...EMPTY_STRESS_FIELDS,
        ...EMPTY_TRAIT_FIELDS,
        stim_attract_01: r.stim_attract_01 ?? "",
        stim_attract_5: r.stim_attract_5 ?? "",
        anxiety_rating: "",
        difficulty_rating: "",
        rt_summary: "",
        rt: r.rt ?? ""
      };
    }
    return {
      subject_id: r.subject_id,
      subject_number: r.subject_number,
      ...EMPTY_DEMO_FIELDS,
      design: r.design,
      balance_rule: r.balance_rule ?? "",
      task: r.task,
      block_index: r.block_index,
      block_order: r.block_order,
      granularity: r.granularity,
      granularity_k: r.granularity_k,
      base_reward_per_effective_step: r.base_reward_per_effective_step,
      trial_index: r.trial_index,
      trial_index_in_block: r.trial_index_in_block,
      balloon_color: r.balloon_color,
      risk_type: r.risk_type,
      explosion_model: r.explosion_model,
      pumps_per_click: r.pumps_per_click,
      pumps: r.pumps,
      exploded: r.exploded,
      cashed_out: r.cashed_out,
      trial_earning: r.trial_earning,
      total_earning_after_trial: r.total_earning_after_trial,
      adjusted_pumps: r.adjusted_pumps,
      end_reason: r.end_reason,
      measure_phase: "",
      ...EMPTY_STRESS_FIELDS,
      ...EMPTY_TRAIT_FIELDS,
      ...EMPTY_STIM_FIELDS,
      anxiety_rating: "",
      difficulty_rating: "",
      rt_summary: r.rt_summary,
      rt: r.rt
    };
  }

  const likert10 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  const STRESS_PHASE_COPY = {
    pre_block_1: "第 1 部分 <strong>开始前</strong>（尚未进行该部分 BART）",
    post_block_1: "第 1 部分 <strong>刚结束</strong>",
    pre_block_2: "第 2 部分 <strong>开始前</strong>（休息后、尚未进行该部分 BART）",
    post_block_2: "第 2 部分 <strong>刚结束</strong>"
  };

  /** 与《量表,md》一致的评定说明（HTML） */
  const STRESS_RATING_INSTRUCTION =
    "采用<strong>1–4</strong>级评定：1—几乎没有；2—有些；3—中等程度或是经常有；4—非常明显或几乎总是如此。";

  const likert4 = ["1", "2", "3", "4"];

  /**
   * @param {"pre_block_1"|"post_block_1"|"pre_block_2"|"post_block_2"} phase
   * @param {number} blockIndex 1 或 2（用于数据归档）
   */
  function makeStressTimeline(phase, blockIndex) {
    const phaseIntro = STRESS_PHASE_COPY[phase];
    const answers = new Array(STRESS_SCALE_ITEMS.length).fill(null);
    let t0 = null;
    const n = STRESS_SCALE_ITEMS.length;

    return STRESS_SCALE_ITEMS.map((itemText, idx) => ({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
      <div style="max-width:640px;margin:0 auto;line-height:1.85;text-align:left;">
        <p><strong>压力感受量表</strong>（${phaseIntro}）<span style="color:#555;"> · 第 ${idx + 1} / ${n} 题</span></p>
        <p>${STRESS_RATING_INSTRUCTION}</p>
        <p style="margin-top:1em;"><strong>${String(idx + 1).padStart(2, "0")}</strong> ${itemText}</p>
      </div>`,
      choices: likert4,
      on_load() {
        if (idx === 0) t0 = performance.now();
      },
      on_finish(data) {
        answers[idx] = data.response + 1;
        if (idx === n - 1) {
          const row = {
            task: "bart_stress_scale",
            subject_id: subjectId,
            subject_number: subjectNumber,
            design: DESIGN,
            balance_rule: "n_a",
            block_index: blockIndex,
            block_order: blockOrderLabel,
            measure_phase: phase,
            ...Object.fromEntries(STRESS_S_KEYS.map((k, i) => [k, answers[i]])),
            rt: t0 != null ? Number((performance.now() - t0).toFixed(2)) : null
          };
          bartResults.push(row);
        }
      }
    }));
  }

  /**
   * 实验正式开始（BART 指导语）前：与《特质量表.md》一致的特质问卷。
   */
  function makeTraitTimeline() {
    const answers = new Array(TRAIT_SCALE_ITEMS.length).fill(null);
    let t0 = null;
    const n = TRAIT_SCALE_ITEMS.length;

    return TRAIT_SCALE_ITEMS.map((itemText, idx) => ({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
      <div style="max-width:640px;margin:0 auto;line-height:1.85;text-align:left;">
        <p><strong>特质问卷</strong>（实验开始前）<span style="color:#555;"> · 第 ${idx + 1} / ${n} 题</span></p>
        <p>${TRAIT_RATING_INSTRUCTION}</p>
        <p style="margin-top:1em;"><strong>${String(idx + 1).padStart(2, "0")}</strong> ${itemText}</p>
      </div>`,
      choices: likert4,
      on_load() {
        if (idx === 0) t0 = performance.now();
      },
      on_finish(data) {
        answers[idx] = data.response + 1;
        if (idx === n - 1) {
          const row = {
            task: "bart_trait_scale",
            subject_id: subjectId,
            subject_number: subjectNumber,
            design: DESIGN,
            balance_rule: "n_a",
            block_index: 0,
            block_order: blockOrderLabel,
            ...Object.fromEntries(TRAIT_T_KEYS.map((k, i) => [k, answers[i]])),
            rt: t0 != null ? Number((performance.now() - t0).toFixed(2)) : null
          };
          bartResults.push(row);
        }
      }
    }));
  }

  function makeSelfReportTimeline() {
    let anxietyRating = null;
    let reportStart = null;
    return [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
      <div style="max-width:560px;margin:0 auto;line-height:1.8;text-align:left;">
        <p>BART 任务已全部结束。</p>
        <p>请根据<strong>此刻</strong>感受选择：你当前的紧张/焦虑程度如何？（1 = 完全不焦虑，10 = 非常焦虑）</p>
      </div>`,
        choices: likert10,
        on_load() {
          reportStart = performance.now();
        },
        on_finish(data) {
          anxietyRating = data.response + 1;
        }
      },
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
      <div style="max-width:560px;margin:0 auto;line-height:1.8;text-align:left;">
        <p>请根据<strong>此刻</strong>感受选择：你觉得刚才的决策难度如何？（1 = 非常容易，10 = 非常困难）</p>
      </div>`,
        choices: likert10,
        on_finish(data) {
          const row = {
            task: "bart_block_self_report",
            subject_id: subjectId,
            subject_number: subjectNumber,
            design: DESIGN,
            balance_rule: "n_a",
            block_index: 0,
            block_order: blockOrderLabel,
            granularity: "",
            granularity_k: CONFIG.granularityK,
            base_reward_per_effective_step: CONFIG.baseRewardPerEffectiveStep,
            anxiety_rating: anxietyRating,
            difficulty_rating: data.response + 1,
            rt:
              reportStart != null
                ? Number((performance.now() - reportStart).toFixed(2))
                : null
          };
          bartResults.push(row);
        }
      }
    ];
  }

  /**
   * BART 与焦虑/难度自评之后、结束页之前：与《刺激评定量表.md》一致的两题（1–4）。
   */
  function makeStimulusRatingTimeline() {
    let attract01 = null;
    let t0 = null;
    return [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
      <div style="max-width:640px;margin:0 auto;line-height:1.85;text-align:left;">
        <p><strong>刺激评定</strong>（实验全部结束后）<span style="color:#555;"> · 第 1 / 2 题</span></p>
        <p>${STIM_RATING_INSTRUCTION}</p>
        <p style="margin-top:1em;">你觉得 <strong>0.1 元</strong>的奖励对你的吸引力有多大？</p>
      </div>`,
        choices: likert4,
        on_load() {
          t0 = performance.now();
        },
        on_finish(data) {
          attract01 = data.response + 1;
        }
      },
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
      <div style="max-width:640px;margin:0 auto;line-height:1.85;text-align:left;">
        <p><strong>刺激评定</strong>（实验全部结束后）<span style="color:#555;"> · 第 2 / 2 题</span></p>
        <p>${STIM_RATING_INSTRUCTION}</p>
        <p style="margin-top:1em;">你觉得 <strong>5 元</strong>的奖励对你的吸引力有多大？</p>
      </div>`,
        choices: likert4,
        on_finish(data) {
          const row = {
            task: "bart_stimulus_rating",
            subject_id: subjectId,
            subject_number: subjectNumber,
            design: DESIGN,
            balance_rule: "n_a",
            block_index: 0,
            block_order: blockOrderLabel,
            stim_attract_01: attract01,
            stim_attract_5: data.response + 1,
            rt:
              t0 != null ? Number((performance.now() - t0).toFixed(2)) : null
          };
          bartResults.push(row);
        }
      }
    ];
  }

  function blockIntroStimulus(granularity, blockIndex) {
    const isHigh = granularity === "high";
    const stepMoney = isHigh
      ? money(CONFIG.baseRewardPerEffectiveStep / CONFIG.granularityK)
      : money(CONFIG.baseRewardPerEffectiveStep);
    const label = getGranularityLabel(granularity);
    return `
      <div style="max-width:640px;margin:0 auto;text-align:left;line-height:1.75;">
        <h3 style="margin-top:0;">第 ${blockIndex}/2 部分 · ${label}</h3>
        <p>单次充气 <strong>${stepMoney}</strong>；本部分 <strong>21</strong> 试次（橙/黄/蓝各 7，顺序随机），本部分收益从 <strong>$0.00</strong> 重计。</p>
        <p>可随时<strong>收账</strong>；若<strong>爆炸</strong>则本气球收益清零。<strong>M = ${CONFIG.explosionCapM}</strong>，爆炸点在 1～M 上均匀随机（第 k 次后未爆则本步概率 1/(M−k+1)）。</p>
      </div>`;
  }

  function buildBartBlockTimeline({
    granularity,
    blockIndex,
    blockOrderLabel: orderLabel,
    startGlobalIndex
  }) {
    const trials = buildTrials(granularity);
    const pumpsPerClick =
      granularity === "high"
        ? CONFIG.baseRewardPerEffectiveStep / CONFIG.granularityK
        : CONFIG.baseRewardPerEffectiveStep;

    const transition = {
      type: jsPsychHtmlButtonResponse,
      stimulus: blockIntroStimulus(granularity, blockIndex),
      choices: ["我理解了，开始本部分"],
      on_load() {
        totalEarnings = 0;
      }
    };

    const bartTrials = trials.map((t, idx) => ({
      type: BartPlugin,
      trial_index_global: startGlobalIndex + idx,
      trial_index_in_block: idx + 1,
      total_trials_in_block: trials.length,
      balloon_color: t.color,
      max_pumps: t.maxPumps,
      granularity,
      granularity_k: CONFIG.granularityK,
      base_reward_per_effective_step: CONFIG.baseRewardPerEffectiveStep,
      pumps_per_click: pumpsPerClick,
      block_index: blockIndex,
      block_order: orderLabel,
      subject_number: subjectNumber,
      design: DESIGN,
      balance_rule: "n_a"
    }));

    return [transition, ...bartTrials];
  }

  const restBetweenBlocks = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="max-width:640px;margin:0 auto;line-height:1.9;text-align:left;">
        <h3>休息</h3>
        <p>第 1 部分已结束。请<strong>稍作休息</strong>（活动身体、喝水、放松眼睛）。准备好后继续第 2 部分。</p>
      </div>`,
    choices: ["休息结束，继续实验"]
  };

  const timeline = [
    ...makeDemographicsTimeline(),
    ...makeTraitTimeline(),
    ...makeStressTimeline("pre_block_1", 1),
    ...buildBartBlockTimeline({
      granularity: blockGranOrder[0],
      blockIndex: 1,
      blockOrderLabel,
      startGlobalIndex: 1
    }),
    ...makeStressTimeline("post_block_1", 1),
    restBetweenBlocks,
    ...makeStressTimeline("pre_block_2", 2),
    ...buildBartBlockTimeline({
      granularity: blockGranOrder[1],
      blockIndex: 2,
      blockOrderLabel,
      startGlobalIndex: 22
    }),
    ...makeStressTimeline("post_block_2", 2),
    ...makeSelfReportTimeline(),
    ...makeStimulusRatingTimeline()
  ];

  const summaryScreen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildSummaryHtml(),
    choices: [],
    on_load() {
      const downloadBtn = document.querySelector("#download-csv");
      const finishBtn = document.querySelector("#finish-exp");

      downloadBtn?.addEventListener("click", () => {
        const csv = toCsv(bartResults.map(rowForCsv));
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bart_${subjectId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      finishBtn?.addEventListener("click", () => {
        jsPsychInstance.finishTrial({
          task: "bart_summary",
          subject_id: subjectId,
          subject_number: subjectNumber,
          design: DESIGN,
          balance_rule: "n_a",
          block_order: blockOrderLabel,
          total_earning: Number(totalEarnings.toFixed(2))
        });
      });
    }
  };

  jsPsychInstance.run([...timeline, summaryScreen]);
})();
