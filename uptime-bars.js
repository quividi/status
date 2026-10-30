// 90-day availability bars under each component, from Upptime's history/summary.json.
// Downtime comes from Upptime's incident issues (open -> close), per UTC day.
(() => {
  "use strict";

  const SUMMARY_URL = "https://raw.githubusercontent.com/quividi/status/master/history/summary.json";
  const MONITORED_SINCE = "2026-10-30";
  const DAYS = 90;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GAP = 2;
  const MIN_BAR = 6;
  const RADIUS = 2;
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
    const row = document.createElementNS(SVG_NS, "svg");
    row.setAttribute("class", "q-bars-row");

    let daysWithDowntime = 0;
    let monitoredDays = 0;
    let minutesDown = 0;
    for (const day of days) {
      let state = "none";
      let label = "no data";
      if (day >= MONITORED_SINCE) {
        monitoredDays++;
        minutesDown += down[day] || 0;
        [state, label] = barState(down[day] || 0);
        // summary.json lags the live status by a few minutes
        if (day === today && state === "up" && site.status !== "up") {
          [state, label] = ["partial", `Currently ${site.status}`];
        }
        if (state !== "up") daysWithDowntime++;
      }
      const bar = document.createElementNS(SVG_NS, "rect");
      bar.setAttribute("class", `q-bar q-bar-${state}`);
      bar.setAttribute("height", "100%");
      bar.setAttribute("rx", RADIUS);
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${day}: ${label}`;
      bar.appendChild(title);
      row.appendChild(bar);
    }
    // Upptime's own uptime line is hidden (quiotto.css), so this is the only figure on the card
    const uptime = monitoredDays
      ? `${(100 - (minutesDown / (monitoredDays * MINUTES_PER_DAY)) * 100).toFixed(2)}% uptime`
      : "no data yet";
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", `${site.name}: ${uptime}, ${daysWithDowntime} of the last ${DAYS} days with downtime`);

    const legend = document.createElement("div");
    legend.className = "q-bars-legend";
    legend.innerHTML = `<span>${DAYS} days ago</span><span>${uptime}</span><span>Today</span>`;

    const wrap = document.createElement("div");
    wrap.className = "q-bars";
    wrap.append(row, legend);
    resized.observe(row);
    return wrap;
  };

  // Every bar gets the same whole number of device pixels and starts on a device-pixel line;
  // the spare pixels are split around the row. Only x is snapped; the row's top and bottom are
  // left to the page layout.
  const layout = (row) => {
    const dpr = window.devicePixelRatio || 1;
    const box = row.getBoundingClientRect();
    const width = box.width * dpr;
    // phones: a 1px gap, so the bars don't shrink to slivers
    const gap = Math.max(1, Math.round((width / DAYS >= (MIN_BAR + GAP) * dpr ? GAP : 1) * dpr));
    const slot = Math.max(gap + 1, Math.floor((width + gap) / DAYS));
    const left = (box.left + window.scrollX) * dpr;
    const x0 = Math.round(left + (width - (DAYS * slot - gap)) / 2) - left;
    row.querySelectorAll("rect").forEach((bar, i) => {
      bar.setAttribute("x", (x0 + i * slot) / dpr);
      bar.setAttribute("width", (slot - gap) / dpr);
    });
  };

  // Also observes <html>: a scrollbar appearing, a window resize or a zoom moves the centred
  // rows sideways without resizing them, which shifts their pixel grid.
  const resized = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      if (target === document.documentElement) document.querySelectorAll(".q-bars-row").forEach(layout);
      else if (target.isConnected) layout(target);
      else resized.unobserve(target);
    }
  });

  const attach = (summary) => {
    let days = null;
    for (const article of document.querySelectorAll("section.live-status article")) {
      if (article.querySelector(".q-bars")) continue;
      const link = article.querySelector("h4 a");
      if (!link) continue;
      const slug = link.getAttribute("href").split("/").pop();
      const site = summary.find((s) => s.slug === slug);
      if (!site) continue;
      // cards don't open the per-component history page: an <a> without href is plain text
      link.removeAttribute("href");
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
      resized.observe(document.documentElement);
    })
    .catch((err) => console.warn("uptime-bars: no availability history", err));
})();
