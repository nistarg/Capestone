import { useEffect, useState } from "react";
import {
  degToDir,
  estimateDewPoint,
  fetchForecast,
  formatSpeedMs,
  formatTempC,
  geocode,
  resolveInitialPlace,
  tempUnitLabel,
  wmoInfo,
} from "./weather.js";

function useBodyTheme(current) {
  useEffect(() => {
    if (!current) {
      document.body.classList.remove("theme-day", "theme-clear-night");
      return;
    }
    const isDay = current.is_day === 1;
    const code = current.weather_code;
    document.body.classList.remove("theme-day", "theme-clear-night");
    if (isDay) document.body.classList.add("theme-day");
    else if (code === 0 || code === 1) document.body.classList.add("theme-clear-night");
  }, [current]);
}

function buildHighlights(current, f) {
  const rainMm = (current.rain || 0) + (current.showers || 0);
  const highlights = [
    { k: "Humidity", v: `${current.relative_humidity_2m ?? "—"}%` },
    { k: "Cloud cover", v: `${current.cloud_cover ?? "—"}%` },
    {
      k: "Wind",
      v: `${formatSpeedMs(current.wind_speed_10m, f)} ${degToDir(current.wind_direction_10m || 0)}`,
    },
  ];
  if (current.wind_gusts_10m != null) {
    highlights.push({ k: "Gusts", v: formatSpeedMs(current.wind_gusts_10m, f) });
  }
  if (rainMm > 0 || (current.precipitation ?? 0) > 0) {
    highlights.push({
      k: "Precip",
      v: `${(current.precipitation ?? rainMm).toFixed(1)} mm`,
    });
  }
  if ((current.snowfall ?? 0) > 0) {
    highlights.push({ k: "Snow", v: `${current.snowfall} cm` });
  }
  return highlights;
}

function buildMetrics(current, daily, f) {
  const uv = daily?.uv_index_max?.[0];
  return [
    {
      icon: "💧",
      label: "Humidity",
      value: `${current.relative_humidity_2m ?? "—"}%`,
      sub: "Relative",
    },
    {
      icon: "🧭",
      label: "Wind",
      value: formatSpeedMs(current.wind_speed_10m, f),
      sub: `${degToDir(current.wind_direction_10m || 0)} · Gusts ${formatSpeedMs(current.wind_gusts_10m, f)}`,
    },
    {
      icon: "📊",
      label: "Pressure",
      value: current.pressure_msl != null ? `${Math.round(current.pressure_msl)} hPa` : "—",
      sub:
        current.surface_pressure != null
          ? `Surface ${Math.round(current.surface_pressure)} hPa`
          : "",
    },
    {
      icon: "☁️",
      label: "Clouds",
      value: `${current.cloud_cover ?? "—"}%`,
      sub: "Cover",
    },
    {
      icon: "🌧️",
      label: "Rain (now)",
      value:
        (current.rain || 0) + (current.showers || 0) > 0
          ? `${((current.rain || 0) + (current.showers || 0)).toFixed(1)} mm`
          : "None",
      sub: `Total precip ${(current.precipitation ?? 0).toFixed(1)} mm`,
    },
    {
      icon: "❄️",
      label: "Snow",
      value: (current.snowfall ?? 0) > 0 ? `${current.snowfall} cm` : "None",
      sub: "Surface",
    },
    {
      icon: "☀️",
      label: "UV index (today)",
      value: uv != null ? String(uv.toFixed(1)) : "—",
      sub: "Daily max",
    },
    {
      icon: "🌡️",
      label: "Dew point (est.)",
      value: estimateDewPoint(current.temperature_2m, current.relative_humidity_2m, f),
      sub: "Approximation",
    },
  ];
}

function buildHourlySlots(hourly, f) {
  const times = hourly.time;
  const now = new Date();
  let startIdx = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]) >= now) {
      startIdx = i;
      break;
    }
  }
  const slice = times.slice(startIdx, startIdx + 24);
  return slice.map((t, i) => {
    const idx = startIdx + i;
    const temp = hourly.temperature_2m[idx];
    const code = hourly.weather_code[idx];
    const pop = hourly.precipitation_probability[idx];
    const isDay = hourly.is_day[idx];
    const info = wmoInfo(code, isDay);
    const d = new Date(t);
    const label =
      i === 0 ? "Now" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return { key: t, label, emoji: info.emoji, temp: formatTempC(temp, f), pop };
  });
}

function buildDailyRows(daily, f) {
  const days = daily.time.length;
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  let minLow = Infinity;
  let maxHigh = -Infinity;
  for (let i = 0; i < days; i++) {
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    if (lo < minLow) minLow = lo;
    if (hi > maxHigh) maxHigh = hi;
  }
  const range = maxHigh - minLow || 1;

  return daily.time.map((t, i) => {
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const code = daily.weather_code[i];
    const info = wmoInfo(code, true);
    const d = new Date(`${t}T12:00:00`);
    const name = i === 0 ? "Today" : formatter.format(d);
    const pop = daily.precipitation_probability_max?.[i];
    const precip = daily.precipitation_sum?.[i];
    const windMax = daily.wind_speed_10m_max?.[i];
    const gustMax = daily.wind_gusts_10m_max?.[i];
    const uv = daily.uv_index_max?.[i];
    const sunrise = daily.sunrise[i]?.split("T")[1]?.slice(0, 5);
    const sunset = daily.sunset[i]?.split("T")[1]?.slice(0, 5);

    const leftPct = ((lo - minLow) / range) * 100;
    const widthPct = ((hi - lo) / range) * 100;

    const summaryParts = [];
    if (pop != null && pop > 0) summaryParts.push(`${pop}% rain`);
    if (precip != null && precip > 0.1) summaryParts.push(`${precip.toFixed(1)} mm`);
    if (windMax != null) summaryParts.push(`wind ${formatSpeedMs(windMax, f)}`);
    if (gustMax != null) summaryParts.push(`gusts ${formatSpeedMs(gustMax, f)}`);
    if (uv != null) summaryParts.push(`UV ${Math.round(uv)}`);
    if (sunrise && sunset) summaryParts.push(`↑${sunrise} ↓${sunset}`);
    const summary = summaryParts.join(" · ");

    return {
      key: t,
      name,
      emoji: info.emoji,
      label: info.label,
      summary,
      leftPct,
      widthPct: Math.max(widthPct, 8),
      low: formatTempC(lo, f),
      high: formatTempC(hi, f),
    };
  });
}

export default function App() {
  const [place, setPlace] = useState(null);
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState({ text: "", error: false });
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const [query, setQuery] = useState("San Francisco");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus({ text: "Finding location…", error: false });
      try {
        const p = await resolveInitialPlace();
        if (!cancelled) {
          setPlace(p);
          setQuery(p.name);
        }
      } catch (e) {
        if (!cancelled) setStatus({ text: e.message || "Could not load location", error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus({ text: "Loading forecast…", error: false });
        const data = await fetchForecast(place);
        if (cancelled) return;
        if (!data.current) throw new Error("No current conditions");
        setWeather(data);
        setStatus({ text: "", error: false });
      } catch (e) {
        if (!cancelled) setStatus({ text: e.message || "Something went wrong", error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place]);

  useBodyTheme(weather?.current ?? null);

  const current = weather?.current;
  const hourly = weather?.hourly;
  const daily = weather?.daily;
  const unit = tempUnitLabel(useFahrenheit);

  async function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setStatus({ text: "Finding location…", error: false });
    try {
      const loc = await geocode(q);
      setPlace(loc);
      setQuery(loc.name);
    } catch (err) {
      setStatus({ text: err.message || "Search failed", error: true });
    }
  }

  const highlights = current ? buildHighlights(current, useFahrenheit) : [];
  const metrics = current && daily ? buildMetrics(current, daily, useFahrenheit) : [];
  const hourlySlots = hourly ? buildHourlySlots(hourly, useFahrenheit) : [];
  const dailyRows = daily ? buildDailyRows(daily, useFahrenheit) : [];

  const heroInfo = current ? wmoInfo(current.weather_code, current.is_day === 1) : null;

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Atmos</span>
        </div>
        <form className="search" role="search" onSubmit={onSearch}>
          <label className="visually-hidden" htmlFor="city-input">
            Search city
          </label>
          <input
            id="city-input"
            name="q"
            type="search"
            placeholder="Search city…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            Go
          </button>
        </form>
        <button
          type="button"
          className="unit-toggle"
          aria-label="Toggle Celsius and Fahrenheit"
          onClick={() => setUseFahrenheit((v) => !v)}
        >
          {unit}
        </button>
      </header>

      <main className="main">
        <p className={`status${status.error ? " error" : ""}`} role="status">
          {status.text}
        </p>

        {current && heroInfo && (
          <section className="hero card">
            <div className="hero-main">
              <div className="hero-location">
                <h1 className="place">{place?.name ?? "—"}</h1>
                <p className="place-meta">{place?.admin ?? ""}</p>
              </div>
              <div className="hero-icon-wrap">
                <span className="hero-icon" aria-hidden="true">
                  {heroInfo.emoji}
                </span>
              </div>
              <div className="hero-temp-block">
                <span className="hero-temp">{String(formatTempC(current.temperature_2m, useFahrenheit))}</span>
                <span className="hero-unit">{unit}</span>
                <p className="hero-feels">
                  Feels like {formatTempC(current.apparent_temperature, useFahrenheit)}
                  {unit}
                </p>
                <p className="hero-desc">{heroInfo.label}</p>
              </div>
            </div>
            <div className="hero-highlights">
              {highlights.map((h) => (
                <span key={h.k} className="pill">
                  <span>{h.k}</span> <strong>{h.v}</strong>
                </span>
              ))}
            </div>
          </section>
        )}

        {current && daily && (
          <section className="section">
            <h2 className="section-title">Right now</h2>
            <div className="grid metrics">
              {metrics.map((m) => (
                <div key={m.label} className="metric">
                  <div className="metric-label">
                    <span className="metric-icon">{m.icon}</span> {m.label}
                  </div>
                  <div className="metric-value">{m.value}</div>
                  {m.sub ? <div className="metric-sub">{m.sub}</div> : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {hourlySlots.length > 0 && (
          <section className="section">
            <h2 className="section-title">Next 24 hours</h2>
            <div className="hourly-scroll card">
              {hourlySlots.map((slot) => (
                <div key={slot.key} className="hour-slot">
                  <div className="hour-time">{slot.label}</div>
                  <div className="hour-emoji">{slot.emoji}</div>
                  <div className="hour-temp">{slot.temp}°</div>
                  {slot.pop != null && slot.pop > 0 ? (
                    <div className="hour-pop">{slot.pop}%</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {dailyRows.length > 0 && (
          <section className="section">
            <h2 className="section-title">7-day outlook</h2>
            <div className="daily-list card">
              {dailyRows.map((row) => (
                <div key={row.key} className="day-row">
                  <div className="day-name">{row.name}</div>
                  <div className="day-icon" title={row.label}>
                    {row.emoji}
                  </div>
                  <div className="day-summary">{row.summary}</div>
                  <div className="day-bar" aria-hidden="true">
                    <div
                      className="day-bar-fill"
                      style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%` }}
                    />
                  </div>
                  <div className="day-temps">
                    <span className="day-low">{row.low}°</span>
                    <span className="day-high">{row.high}°</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section section-footnote">
          <p className="footnote">
            Data from{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Open-Meteo
            </a>
            . Location search via Open-Meteo Geocoding.
          </p>
        </section>
      </main>
    </>
  );
}
