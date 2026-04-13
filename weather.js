export const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
export const WX_URL = "https://api.open-meteo.com/v1/forecast";

export const WMO = {
  0: { label: "Clear", emoji: "☀️", day: true },
  1: { label: "Mainly clear", emoji: "🌤️", day: true },
  2: { label: "Partly cloudy", emoji: "⛅", day: true },
  3: { label: "Overcast", emoji: "☁️", day: false },
  45: { label: "Fog", emoji: "🌫️", day: false },
  48: { label: "Rime fog", emoji: "🌫️", day: false },
  51: { label: "Light drizzle", emoji: "🌦️", day: false },
  53: { label: "Drizzle", emoji: "🌧️", day: false },
  55: { label: "Heavy drizzle", emoji: "🌧️", day: false },
  56: { label: "Freezing drizzle", emoji: "🌧️", day: false },
  57: { label: "Freezing drizzle", emoji: "🌧️", day: false },
  61: { label: "Light rain", emoji: "🌧️", day: false },
  63: { label: "Rain", emoji: "🌧️", day: false },
  65: { label: "Heavy rain", emoji: "🌧️", day: false },
  66: { label: "Freezing rain", emoji: "🌨️", day: false },
  67: { label: "Freezing rain", emoji: "🌨️", day: false },
  71: { label: "Light snow", emoji: "🌨️", day: false },
  73: { label: "Snow", emoji: "❄️", day: false },
  75: { label: "Heavy snow", emoji: "❄️", day: false },
  77: { label: "Snow grains", emoji: "❄️", day: false },
  80: { label: "Rain showers", emoji: "🌦️", day: false },
  81: { label: "Rain showers", emoji: "🌧️", day: false },
  82: { label: "Violent rain", emoji: "⛈️", day: false },
  85: { label: "Snow showers", emoji: "🌨️", day: false },
  86: { label: "Snow showers", emoji: "🌨️", day: false },
  95: { label: "Thunderstorm", emoji: "⛈️", day: false },
  96: { label: "Thunderstorm & hail", emoji: "⛈️", day: false },
  99: { label: "Thunderstorm & hail", emoji: "⛈️", day: false },
};

export function wmoInfo(code, isDay) {
  const row = WMO[code] ?? { label: "Unknown", emoji: "🌡️", day: true };
  const night = isDay === 0 || isDay === false;
  if (night && code === 0) return { label: "Clear", emoji: "🌙", day: false };
  return row;
}

export function degToDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export function formatTempC(c, useFahrenheit) {
  if (c == null || Number.isNaN(c)) return "—";
  if (useFahrenheit) return Math.round((c * 9) / 5 + 32);
  return Math.round(c);
}

export function tempUnitLabel(useFahrenheit) {
  return useFahrenheit ? "°F" : "°C";
}

export function formatSpeedMs(ms, useFahrenheit) {
  if (ms == null) return "—";
  if (useFahrenheit) {
    const mph = ms * 2.23694;
    return `${mph.toFixed(1)} mph`;
  }
  return `${ms.toFixed(1)} m/s`;
}

export function estimateDewPoint(tempCVal, rh, useFahrenheit) {
  if (tempCVal == null || rh == null) return "—";
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempCVal) / (b + tempCVal) + Math.log(rh / 100);
  const dp = (b * alpha) / (a - alpha);
  return `${formatTempC(dp, useFahrenheit)}${tempUnitLabel(useFahrenheit)}`;
}

export async function geocode(query) {
  const url = new URL(GEO_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  if (!data.results?.length) throw new Error("No results for that search");
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    admin: [r.admin1, r.country].filter(Boolean).join(", ") || r.country || "",
    timezone: r.timezone || "auto",
  };
}

export async function fetchForecast(place) {
  const url = new URL(WX_URL);
  url.searchParams.set("latitude", String(place.lat));
  url.searchParams.set("longitude", String(place.lon));
  url.searchParams.set("timezone", place.timezone);
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code,is_day"
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "uv_index_max",
    ].join(",")
  );
  url.searchParams.set("forecast_days", "8");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}

const FALLBACK_PLACE = {
  lat: 37.7749,
  lon: -122.4194,
  name: "San Francisco",
  admin: "California, United States",
  timezone: "America/Los_Angeles",
};

export async function resolveInitialPlace() {
  try {
    return await geocode("San Francisco");
  } catch {
    return { ...FALLBACK_PLACE };
  }
}
