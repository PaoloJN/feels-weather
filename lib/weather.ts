export type Hour = {
  time: string; // local ISO, e.g. 2026-11-25T14:00
  t: number; // °C
  feels: number; // °C, apparent temperature
  rh: number;
  pop: number; // precipitation probability %
  precip: number; // mm
  snow: number; // cm
  code: number;
  wind: number; // km/h
  gust: number;
  cloud: number;
  uv: number;
  isDay: boolean;
};

export type Forecast = { hours: Hour[]; nowIndex: number };

export type Place = { lat: number; lon: number; name: string };

const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "snowfall",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "uv_index",
  "is_day",
].join(",");

export async function fetchForecast(p: Place): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(2)}&longitude=${p.lon.toFixed(2)}` +
    `&current=temperature_2m&hourly=${HOURLY}&past_days=1&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  const j = await res.json();
  const h = j.hourly;
  const hours: Hour[] = h.time.map((time: string, i: number) => ({
    time,
    t: h.temperature_2m[i] ?? 0,
    feels: h.apparent_temperature[i] ?? h.temperature_2m[i] ?? 0,
    rh: h.relative_humidity_2m[i] ?? 0,
    pop: h.precipitation_probability[i] ?? 0,
    precip: h.precipitation[i] ?? 0,
    snow: h.snowfall[i] ?? 0,
    code: h.weather_code[i] ?? 0,
    wind: h.wind_speed_10m[i] ?? 0,
    gust: h.wind_gusts_10m[i] ?? 0,
    cloud: h.cloud_cover[i] ?? 0,
    uv: h.uv_index[i] ?? 0,
    isDay: h.is_day[i] === 1,
  }));
  const nowKey = (j.current.time as string).slice(0, 13);
  const nowIndex = Math.max(
    0,
    hours.findIndex((x) => x.time.slice(0, 13) === nowKey),
  );
  return { hours, nowIndex };
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${encodeURIComponent(q)}`,
  );
  if (!res.ok) throw new Error(`Place search answered ${res.status}`);
  const j = await res.json();
  return (j.results ?? []).map(
    (r: { latitude: number; longitude: number; name: string; admin1?: string; country_code?: string }) => ({
      lat: r.latitude,
      lon: r.longitude,
      name: [r.name, r.admin1 ?? r.country_code].filter(Boolean).join(", "),
    }),
  );
}

/** Current conditions on a 5×5 grid around a place, rows north to south, columns west to east. Cells are ~10 miles apart. */
export async function fetchNearby(p: Place): Promise<Hour[]> {
  const STEP = 0.15; // degrees of latitude, about 10 miles
  const lonStep = STEP / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
  const lats: string[] = [];
  const lons: string[] = [];
  for (let r = 2; r >= -2; r--) {
    for (let c = -2; c <= 2; c++) {
      lats.push((p.lat + r * STEP).toFixed(2));
      lons.push((p.lon + c * lonStep).toFixed(2));
    }
  }
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,is_day&timezone=auto`,
  );
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  const j = await res.json();
  return (j as { current: Record<string, number | string> }[]).map(({ current: c }) => ({
    time: String(c.time),
    t: Number(c.temperature_2m),
    feels: Number(c.apparent_temperature),
    rh: Number(c.relative_humidity_2m),
    pop: Number(c.precipitation) > 0 ? 100 : 0,
    precip: Number(c.precipitation),
    snow: Number(c.snowfall),
    code: Number(c.weather_code),
    wind: Number(c.wind_speed_10m),
    gust: Number(c.wind_gusts_10m),
    cloud: Number(c.cloud_cover),
    uv: 0,
    isDay: c.is_day === 1,
  }));
}
