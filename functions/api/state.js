const APP_STATE_ID = "default";

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ state: null, error: "D1 binding DB is not configured" }, 200);
  }
  if (!isAuthorized(request, env)) {
    return json({ state: null, error: "Unauthorized" }, 401);
  }

  const row = await env.DB.prepare(
    "select data, updated_at from app_state where id = ?"
  )
    .bind(APP_STATE_ID)
    .first();

  return json({
    state: row?.data ? JSON.parse(row.data) : null,
    updatedAt: row?.updated_at || null,
  });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) {
    return json({ ok: false, error: "D1 binding DB is not configured" }, 503);
  }
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const body = await request.json();
  if (!body?.state || typeof body.state !== "object") {
    return json({ ok: false, error: "Expected JSON body with a state object" }, 400);
  }

  await env.DB.prepare(
    `insert into app_state (id, data, updated_at)
     values (?, ?, datetime('now'))
     on conflict(id) do update set
       data = excluded.data,
       updated_at = excluded.updated_at`
  )
    .bind(APP_STATE_ID, JSON.stringify(body.state))
    .run();

  return json({ ok: true });
}

function isAuthorized(request, env) {
  if (!env.APP_KEY) return true;
  const headerKey = request.headers.get("x-app-key") || "";
  const authorization = request.headers.get("authorization") || "";
  const bearerKey = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return timingSafeEqual(headerKey || bearerKey, env.APP_KEY);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
