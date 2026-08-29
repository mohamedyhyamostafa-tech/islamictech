export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function newId(prefix) {
  return prefix + '_' + crypto.randomUUID().split('-')[0];
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
