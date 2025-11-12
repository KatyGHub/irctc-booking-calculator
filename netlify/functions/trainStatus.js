// Self-contained RapidAPI proxy (no env vars).
// 1) Replace RAPIDAPI_KEY below.
// 2) Deploy. Test health at /.netlify/functions/trainStatus?ping=1

const RAPIDAPI_KEY  = "4bb217ccb0msh6a95ea8451ccf9cp15b146jsn8040bbd53b68"; // <-- REQUIRED
const RAPIDAPI_HOST = "indian-railway-irctc.p.rapidapi.com";
const RAPIDAPI_BASE = "https://indian-railway-irctc.p.rapidapi.com";

export async function handler(event) {
  try {
    const q = event.queryStringParameters || {};
    // quick health check
    if (q.ping) {
      return json(200, { ok: true, ts: new Date().toISOString() });
    }
    // optional sample (no network) -> /.netlify/functions/trainStatus?sample=1
    if (q.sample) {
      return json(200, samplePayload());
    }

    if (!RAPIDAPI_KEY) return json(500, { error: "RapidAPI key missing in function code" });

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
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
      }
    });

    const text = await r.text();
    if (!r.ok) return json(r.status, { error: "Upstream error", status: r.status, body: text.slice(0, 800) });

    let raw; try { raw = JSON.parse(text); }
    catch { return json(502, { error: "Non-JSON upstream", body: text.slice(0, 200) }); }

    const body = raw?.body || {};
    const stations = Array.isArray(body?.stations) ? body.stations : [];

    // Normalize what the UI needs
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
        actDepDate: s.actual_departure_date
      }))
    };

    return json(200, { raw, brief });
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

function samplePayload() {
  // Minimal realistic sample for offline verification
  return {
    brief: {
      trainNumber: "16527",
      trainName: "YPR–CAN",
      current_station: "CRLM",
      train_status_message: "Train has crossed Heelalige at 21:09",
      stations: [
        { code: "YPR", name: "Yesvantpur Jn", planArr: "--",   planDep: "20:00", actArrDate:"20260115", actDepDate:"20260115", actArr:"--",   actDep:"20:00" },
        { code: "CRLM",name: "Carmelaram",    planArr: "20:41", planDep: "20:42", actArrDate:"20260115", actDepDate:"20260115", actArr:"20:41", actDep:"20:42" },
        { code: "CAN", name: "Kannur",        planArr: "09:45", planDep: "--",    actArrDate:"20260116", actDepDate:"20260116", actArr:"09:45", actDep:"--" }
      ]
    }
  };
}