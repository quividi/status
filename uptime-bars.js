// 90-day availability bars under each component, from Upptime's history/summary.json.
// Downtime comes from Upptime's incident issues (open -> close), per UTC day.
(() => {
  "use strict";

  const SUMMARY_URL = "https://raw.githubusercontent.com/quividi/status/master/history/summary.json";
  const MONITORED_SINCE = "2026-10-30";
  const DAYS = 90;
  const MINUTES_PER_DAY = 1440;

  const utcDay = (daysAgo) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const barState = (minutes) => {
    if (minutes === 0) return ["up", "No downtime"];
    if (minutes < 60) return ["partial", `${minutes} min down`];
    return ["down", `${Math.floor(minutes / 60)} h ${minutes % 60} min down`];
  };

  const render = (site, days) => {
    const down = site.dailyMinutesDown || {};
    const today = days[days.length - 1];
    const row = document.createElement("div");
    row.className = "q-bars-row";

    let daysWithDowntime = 0;
    let monitoredDays = 0;
    let minutesDown = 0;
    for (const day of days) {
      const bar = document.createElement("span");
      if (day < MONITORED_SINCE) {
        bar.className = "q-bar q-bar-none";
        bar.title = `${day}: no data`;
      } else {
        monitoredDays++;
        minutesDown += down[day] || 0;
        let [state, label] = barState(down[day] || 0);
        // summary.json lags the live status by a few minutes
        if (day === today && state === "up" && site.status !== "up") {
          [state, label] = ["partial", `Currently ${site.status}`];
        }
        if (state !== "up") daysWithDowntime++;
        bar.className = `q-bar q-bar-${state}`;
        bar.title = `${day}: ${label}`;
      }
      row.appendChild(bar);
    }
    // Upptime's own uptime line is hidden (quiotto.css), so this is the only figure on the card
    const uptime = (100 - (minutesDown / (monitoredDays * MINUTES_PER_DAY)) * 100).toFixed(2);
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", `${site.name}: ${uptime}% uptime, ${daysWithDowntime} of the last ${DAYS} days with downtime`);

    const legend = document.createElement("div");
    legend.className = "q-bars-legend";
    legend.innerHTML = `<span>${DAYS} days ago</span><span>${uptime}% uptime</span><span>Today</span>`;

    const wrap = document.createElement("div");
    wrap.className = "q-bars";
    wrap.append(row, legend);
    return wrap;
  };

  const attach = (summary) => {
    let days = null;
    for (const article of document.querySelectorAll("section.live-status article")) {
      if (article.querySelector(".q-bars")) continue;
      const link = article.querySelector("h4 a");
      if (!link) continue;
      const slug = link.getAttribute("href").split("/").pop();
      const site = summary.find((s) => s.slug === slug);
      if (!site) continue;
      days ??= Array.from({ length: DAYS }, (_, i) => utcDay(DAYS - 1 - i));
      article.appendChild(render(site, days));
    }
  };

  // Svelte renders the components after loading and re-creates them on client-side navigation.
  fetch(SUMMARY_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((summary) => {
      const run = () => attach(summary);
      run();
      new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
    })
    .catch((err) => console.warn("uptime-bars: no availability history", err));
})();
