// Replace with your RapidAPI key
const RAPIDAPI_KEY  = "PASTE_YOUR_RAPIDAPI_KEY_HERE";
const RAPIDAPI_HOST = "indian-railway-irctc.p.rapidapi.com";
const RAPIDAPI_BASE = "https://indian-railway-irctc.p.rapidapi.com";

export async function handler(event) {
  try {
    const q = event.queryStringParameters || {};
    if (q.ping) return json(200, { ok: true, ts: new Date().toISOString() });

    const train_number   = (q.train_number || "").trim();
    const departure_date = (q.departure_date || "").trim(); // YYYYMMDD

    if (!/^\d{3,5}$/.test(train_number)) return json(400, { error: "Invalid train_number" });
    if (!/^\d{8}$/.test(departure_date))  return json(400, { error: "Invalid departure_date (YYYYMMDD)" });

    const url = new URL("/api/trains/v1/train/status", RAPIDAPI_BASE);
    url.searchParams.set("departure_date", departure_date);
    url.searchParams.set("isH5", "true");
    url.searchParams.set("client", "web");
    url.searchParams.set("deviceIdentifier", "Mozilla%2520Firefox-138.0.0.0");
    url.searchParams.set("train_number", train_number);

    const r = await fetch(url.toString(), {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_HOST }
    });

    const text = await r.text();
    if (!r.ok) return json(r.status, { error: "Upstream error", status: r.status, body: text.slice(0, 600) });

    let raw; try { raw = JSON.parse(text); } catch { return json(502, { error: "Invalid JSON from API" }); }

    const body = raw?.body || {};
    const stations = Array.isArray(body?.stations) ? body.stations : [];

    const brief = {
      trainNumber: train_number,
      trainName: raw?.trainName || raw?.train_name || raw?.train?.name || null,
      current_station: body?.current_station || null,
      train_status_message: body?.train_status_message || null,
      stations: stations.map(s => ({
        code: s.stationCode,
        name: s.stationName,
        planArr: s.arrivalTime,
        planDep: s.departureTime,
        actArr: s.actual_arrival_time,
        actDep: s.actual_departure_time,
        actArrDate: s.actual_arrival_date,
        actDepDate: s.actual_departure_date,
        dayCount: s.dayCount // needed to compute origin from a chosen station
      }))
    };

    return json(200, { brief });
  } catch (e) {
    return json(500, { error: "Function failure", detail: String(e) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(body)
  };
}
