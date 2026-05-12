(() => {
  const jsPsychInstance = initJsPsych({
    show_progress_bar: false
  });
  const ParameterType = window.jsPsychModule?.ParameterType || window.jsPsych?.ParameterType;

  const CONFIG = {
    pumpsPerClick: 0.05,
    trialCountPerColor: 10,
    colors: ["orange", "yellow", "blue"],
    riskCaps: [8, 32, 128],
    baseScale: 1,
    scalePerPump: 0.015,
    maxScale: 2.4
  };

  const subjectId = `S${Date.now().toString(36).toUpperCase()}`;
  let totalEarnings = 0;
  const bartResults = [];
  let colorRiskMapping = {};

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sampleThreshold(maxPumps) {
    return Math.floor(Math.random() * (maxPumps - 1)) + 2;
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

  function buildTrials() {
    const shuffledCaps = shuffle(CONFIG.riskCaps);
    colorRiskMapping = CONFIG.colors.reduce((acc, color, idx) => {
      acc[color] = shuffledCaps[idx];
      return acc;
    }, {});

    const pool = [];
    CONFIG.colors.forEach((color) => {
      for (let i = 0; i < CONFIG.trialCountPerColor; i += 1) {
        const maxPumps = colorRiskMapping[color];
        pool.push({
          color,
          maxPumps,
          threshold: sampleThreshold(maxPumps)
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
        total_trials: { type: ParameterType.INT, default: 30 },
        balloon_color: { type: ParameterType.STRING, default: "orange" },
        max_pumps: { type: ParameterType.INT, default: 8 },
        threshold: { type: ParameterType.INT, default: 1 }
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

      display_element.innerHTML = `
        <div class="bart-wrapper">
          <div class="bart-top">
            <div>试次：${trial.trial_index_global}/${trial.total_trials}</div>
            <div>当前气球：${getColorName(trial.balloon_color)}</div>
            <div>本气球收益：<span id="current-earning">${money(0)}</span></div>
            <div>总收益：<span id="total-earning">${money(totalEarnings)}</span></div>
          </div>
          <div class="bart-main">
            <div class="balloon-stage">
              <div id="balloon" class="balloon balloon-${trial.balloon_color}"></div>
            </div>
            <div id="status" class="bart-status">点击“充气”开始本试次</div>
            <div class="bart-controls">
              <button id="pump-btn" class="bart-btn btn-pump">充气 (+$0.05)</button>
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
          trial_index: trial.trial_index_global,
          balloon_color: trial.balloon_color,
          risk_type: trial.max_pumps,
          threshold: trial.threshold,
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
        trialEarning += CONFIG.pumpsPerClick;
        refreshBalloonScale();
        currentEarningEl.textContent = money(trialEarning);

        if (pumps >= trial.threshold) {
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

  function buildSummaryHtml() {
    const totalPumps = bartResults.reduce((sum, r) => sum + r.pumps, 0);
    const nonExploded = bartResults.filter((r) => !r.exploded);
    const adjustedPumps =
      nonExploded.length > 0
        ? Number(
            (
              nonExploded.reduce((sum, r) => sum + r.pumps, 0) / nonExploded.length
            ).toFixed(2)
          )
        : 0;
    const explosionCount = bartResults.filter((r) => r.exploded).length;

    return `
      <div class="bart-wrapper">
        <div class="bart-main">
          <div class="summary">
            <h2>实验完成</h2>
            <p>被试编号：<strong>${subjectId}</strong></p>
            <p>充气总次数（Total Pumps）：<strong>${totalPumps}</strong></p>
            <p>调整充气次数（Adjusted Pumps）：<strong>${adjustedPumps}</strong></p>
            <p>气球爆炸次数（Explosion Count）：<strong>${explosionCount}</strong></p>
            <p>总收益（Total Earnings）：<strong>${money(totalEarnings)}</strong></p>
            <div class="bart-controls">
              <button id="download-csv" class="bart-btn btn-download">下载 CSV 数据</button>
              <button id="finish-exp" class="bart-btn btn-finish">结束实验</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function toCsv(rows) {
    const headers = [
      "subject_id",
      "trial_index",
      "balloon_color",
      "risk_type",
      "threshold",
      "pumps",
      "exploded",
      "cashed_out",
      "trial_earning",
      "total_earning_after_trial",
      "adjusted_pumps",
      "end_reason",
      "rt_summary",
      "rt"
    ];
    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((h) => esc(row[h])).join(","));
    });
    return lines.join("\n");
  }

  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="max-width:780px;margin:0 auto;text-align:left;line-height:1.8;">
        <h2>BART 风险决策偏好实验</h2>
        <p>你将看到不同颜色的气球。每点击一次“充气”，当前气球收益增加 <strong>$0.05</strong>。</p>
        <p>你可以随时点击“收账”把当前收益累计到总收益；若气球爆炸，本气球收益清零。</p>
        <p>实验共 30 个气球，请尽量获得更高总收益。</p>
      </div>
    `,
    choices: ["开始实验"]
  };

  const trials = buildTrials();
  const bartTimeline = trials.map((t, idx) => ({
    type: BartPlugin,
    trial_index_global: idx + 1,
    total_trials: trials.length,
    balloon_color: t.color,
    max_pumps: t.maxPumps,
    threshold: t.threshold
  }));

  const summaryScreen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildSummaryHtml(),
    choices: [],
    on_load() {
      const downloadBtn = document.querySelector("#download-csv");
      const finishBtn = document.querySelector("#finish-exp");

      downloadBtn?.addEventListener("click", () => {
        const csv = toCsv(bartResults);
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
          total_earning: Number(totalEarnings.toFixed(2))
        });
      });
    }
  };

  jsPsychInstance.run([intro, ...bartTimeline, summaryScreen]);
})();
