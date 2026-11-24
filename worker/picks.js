const pickStatuses = ['pendiente', 'acertado', 'errado', 'anulado'];
export function validatePick(input) {
  if (!input || typeof input !== 'object') throw Error('Registro inválido.');
  const text = (value, max, required = true) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Error('Revisa los campos de texto.');
    return value.trim();
  };
  if (!/^[a-f0-9-]{36}$/i.test(input.id)) throw Error('Identificador inválido.');
  if (!['pick', 'parley'].includes(input.kind) || !pickStatuses.includes(input.status)) throw Error('Tipo o estado inválido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10)!==input.date) throw Error('Fecha inválida.');
  if (!Number.isInteger(input.stakeCents) || input.stakeCents < 1 || input.stakeCents > 100000000) throw Error('Importe inválido.');
  if (!Number.isFinite(input.odds) || input.odds < 1 || input.odds > 100000) throw Error('Cuota inválida.');
  if (!Array.isArray(input.selections) || input.selections.length < 1 || input.selections.length > 30) throw Error('Agrega entre 1 y 30 selecciones.');
  if (input.kind === 'pick' && input.selections.length !== 1) throw Error('Un pick debe tener una selección.');
  if (input.kind === 'parley' && input.selections.length < 2) throw Error('Un parley necesita al menos dos selecciones.');
  return { ...input, title:text(input.title,120), notes:text(input.notes || '',1000,false), selections:input.selections.map(s=>text(s,250)) };
}
function pickRecord(row) {
  return {id:row.id,title:row.title,kind:row.kind,date:row.date,stakeCents:row.stake_cents,odds:row.odds,status:row.status,selections:JSON.parse(row.selections),notes:row.notes,revision:row.revision};
}
export async function picksApi(request, env) {
  const userId = request.headers.get('oai-authenticated-user-id');
  const reply = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  if (!userId) return reply({error:'Inicia sesión para abrir tu agenda.',signin:'/signin-with-chatgpt?return_to=%2F%23mis-picks'},401);
  if (!env.DB) return reply({error:'La agenda requiere la base de datos del sitio publicado.'},503);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM picks WHERE user_id = ? ORDER BY date DESC, created_at DESC').bind(userId).all();
    return reply({items:rows.results.map(pickRecord)});
  }
  if (!['POST','PUT'].includes(request.method)) return reply({error:'Método no permitido.'},405);
  if (request.headers.get('Origin') !== new URL(request.url).origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return reply({error:'Solicitud no autorizada.'},403);
  const body = await request.text();
  if (body.length > 16000) return reply({error:'Registro demasiado grande.'},413);
  let pick;
  try { pick = validatePick(JSON.parse(body)); } catch(error) { return reply({error:error.message},400); }
  const now = new Date().toISOString();
  if (request.method === 'POST') {
    await env.DB.prepare('INSERT INTO picks (user_id,id,title,kind,date,stake_cents,odds,status,selections,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').bind(userId,pick.id,pick.title,pick.kind,pick.date,pick.stakeCents,pick.odds,pick.status,JSON.stringify(pick.selections),pick.notes,now,now).run();
  } else {
    if (!Number.isInteger(pick.revision) || pick.revision < 1) return reply({error:'Versión inválida.'},400);
    const result = await env.DB.prepare('UPDATE picks SET title=?,kind=?,date=?,stake_cents=?,odds=?,status=?,selections=?,notes=?,revision=revision+1,updated_at=? WHERE user_id=? AND id=? AND revision=?').bind(pick.title,pick.kind,pick.date,pick.stakeCents,pick.odds,pick.status,JSON.stringify(pick.selections),pick.notes,now,userId,pick.id,pick.revision).run();
    if (!result.meta.changes) return reply({error:'Este registro cambió en otra sesión. Actualiza la agenda antes de editar.'},409);
  }
  const row = await env.DB.prepare('SELECT * FROM picks WHERE user_id=? AND id=?').bind(userId,pick.id).first();
  return reply({item:pickRecord(row)});
}
