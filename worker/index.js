import { shotObservations, playerShots } from './player-shots.js';
import { enhancePage } from './features.js';

import { countMarkets } from './count-model.js';
import { html } from './page.js';
import { analyze } from './model.js';
const leagues={'eng.1':'Premier League','esp.1':'LaLiga','ita.1':'Serie A','ger.1':'Bundesliga','fra.1':'Ligue 1','uefa.champions':'Champions League','uefa.nations':'Nations League','fifa.friendly':'Selecciones','usa.1':'MLS','mex.1':'Liga MX','slv.1':'El Salvador','uefa.europa':'Europa League','uefa.europa.conf':'Conference League','uefa.euro':'Eurocopa','fifa.world':'Copa Mundial','conmebol.america':'Copa América','conmebol.libertadores':'Copa Libertadores','conmebol.sudamericana':'Copa Sudamericana','bra.1':'Brasileirão','arg.1':'Liga Argentina','por.1':'Primeira Liga','ned.1':'Eredivisie','eng.fa':'FA Cup','esp.copa_del_rey':'Copa del Rey','usa.nwsl':'NWSL','eng.w.1':'Women’s Super League'};
const root='https://site.api.espn.com/apis/site/v2/sports/soccer/';
const memory=new Map();
async function json(url,ttl=900){const old=memory.get(url);if(ttl>0&&old&&old.until>Date.now())return old.value;const response=await fetch(url,{signal:AbortSignal.timeout(12000),...(ttl===0?{cache:"no-store"}:{cf:{cacheTtl:ttl,cacheEverything:true}})});if(!response.ok)throw Error('HTTP '+response.status+' en '+new URL(url).hostname);const value=await response.json();if(memory.size>150)memory.clear();memory.set(url,{value,until:Date.now()+ttl*1000});return value;}
const stamp=d=>d.toISOString().slice(0,10).replaceAll('-','');
function event(e,league){const c=e.competitions?.[0];if(!c)return null;return {id:e.id,date:e.date||c.date,league,competition:leagues[league],venue:c.venue,state:c.status?.type?.state||e.status?.type?.state,teams:c.competitors.map(t=>({id:t.id,name:t.team.displayName,short:t.team.abbreviation,logo:t.team.logo||t.team.logos?.[0]?.href,side:t.homeAway,score:Number(t.score?.value??t.score),form:t.form})).sort((a,b)=>a.side==='home'?-1:1)};}
async function weather(venue,date,get=json){if(!venue?.address?.city)return null;const geo=await get('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(venue.address.city)+'&count=5&language=en');const loc=geo.results?.find(x=>x.country===venue.address.country);if(!loc)return null;const day=date.slice(0,10);const w=await get('https://api.open-meteo.com/v1/forecast?latitude='+loc.latitude+'&longitude='+loc.longitude+'&hourly=temperature_2m,precipitation_probability,wind_speed_10m&timezone=GMT&start_date='+day+'&end_date='+day);const hour=new Date(date).toISOString().slice(0,13)+':00';const i=w.hourly?.time.indexOf(hour);if(i==null||i<0)return null;return {city:loc.name,temp:w.hourly.temperature_2m[i],rain:w.hourly.precipitation_probability[i],wind:w.hourly.wind_speed_10m[i]};}
function countPair(a,b){if(a==null||b==null||String(a).trim()===''||String(b).trim()==='')return null;const x=Number(a),y=Number(b);return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0?x+y:null;}
const divisions={'eng.1':'E0','esp.1':'SP1','ita.1':'I1','ger.1':'D1','fra.1':'F1'};
const aliases={'Manchester United':'Man United','Manchester City':'Man City','Brighton & Hove Albion':'Brighton','Nottingham Forest':"Nott'm Forest",'Wolverhampton Wanderers':'Wolves','Tottenham Hotspur':'Tottenham','West Ham United':'West Ham','Newcastle United':'Newcastle','Leeds United':'Leeds','Leicester City':'Leicester','Ipswich Town':'Ipswich','Internazionale':'Inter','AC Milan':'Milan','AS Roma':'Roma','Atletico Madrid':'Ath Madrid','Atlético Madrid':'Ath Madrid','Athletic Club':'Ath Bilbao','Real Betis':'Betis','Celta Vigo':'Celta','Rayo Vallecano':'Vallecano','Paris Saint-Germain':'Paris SG','Bayern Munich':'Bayern Munich','Borussia Dortmund':'Dortmund','Bayer Leverkusen':'Leverkusen','Borussia Mönchengladbach':"M'gladbach",'Eintracht Frankfurt':'Ein Frankfurt','1. FC Union Berlin':'Union Berlin','VfB Stuttgart':'Stuttgart','VfL Wolfsburg':'Wolfsburg','SC Freiburg':'Freiburg'};
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function history(league,match,fresh=false){const division=divisions[league];if(!division)return [];const key='history-'+division;const old=memory.get(key);let rows=!fresh&&old?.until>Date.now()?old.value:null;
if(!rows){rows=[];const now=new Date();const year=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);for(const y of [year-1,year]){const season=String(y).slice(-2)+String(y+1).slice(-2);const response=await fetch('https://football-data.co.uk/mmz4281/'+season+'/'+division+'.csv',{signal:AbortSignal.timeout(12000),...(fresh?{cache:"no-store"}:{cf:{cacheTtl:3600,cacheEverything:true}})});if(!response.ok)continue;const lines=(await response.text()).trim().split(/\r?\n/);const header=lines.shift().split(',');for(const line of lines){const fields=line.split(',');const r=Object.fromEntries(header.map((h,i)=>[h,fields[i]]));if(!r.Date||r.FTHG===''||r.FTAG===''||r.FTHG==null)continue;const [d,m,y]=r.Date.split('/');const date=(y.length===2?'20'+y:y)+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0')+'T00:00:00Z';if(!Number.isFinite(Date.parse(date)))continue;rows.push({date,source:'Football-Data',firstHalf:countPair(r.HTHG,r.HTAG),corners:countPair(r.HC,r.AC),yellow:countPair(r.HY,r.AY),teams:[{id:r.HomeTeam,score:Number(r.FTHG)},{id:r.AwayTeam,score:Number(r.FTAG)}]});}}memory.set(key,{value:rows,until:Date.now()+3600000});}
let supplemental=[];
// Avoid duplicate observations when provider seasons overlap. CSV has precedence.
const unique=new Map();
for(const g of [...supplemental,...rows])unique.set(g.date.slice(0,10)+'|'+g.teams.map(t=>normalize(t.id)).join('|'),g);
rows=[...unique.values()];
const names=[...new Set(rows.flatMap(g=>g.teams.map(t=>t.id)))];const mapping={};for(const t of match.teams){const name=names.find(n=>normalize(n)===normalize(aliases[t.name]||t.name));if(name)mapping[name]=t.id;}
return rows.filter(g=>g.date.slice(0,10)<match.date.slice(0,10)&&g.date<new Date().toISOString()).map(g=>({...g,teams:g.teams.map(t=>({...t,id:mapping[t.id]||'csv:'+t.id}))})).sort((a,b)=>a.date.localeCompare(b.date));}
async function recentResults(league,match,get=json){
 const cutoff=Math.min(Date.now(),Date.parse(match.date));
 const year=new Date(cutoff).getUTCFullYear();
 const responses=await Promise.allSettled(match.teams.flatMap(t=>[year,year-1].map(y=>get(root+league+'/teams/'+t.id+'/schedule?season='+y,1800))));
 const rows=[...new Map(responses.flatMap(r=>r.status==='fulfilled'?r.value.events||[]:[]).map(e=>event(e,league)).filter(e=>e?.state==='post'&&e.id!==match.id&&Date.parse(e.date)<cutoff&&Date.parse(e.date)>=cutoff-365*86400000&&e.teams.length===2&&e.teams.every(t=>Number.isInteger(t.score)&&t.score>=0)).map(e=>[e.id,{...e,source:'ESPN'}])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 // Bound requests and take recent observations from both teams, not just the busier team.
 const selected=[...new Map(match.teams.flatMap(t=>rows.filter(g=>g.teams.some(x=>x.id===t.id)).slice(-6)).map(g=>[g.id,g])).values()];
 await Promise.allSettled(selected.map(async g=>{
  const d=await get(root+league+'/summary?event='+g.id,1800);
  const competitors=d.header?.competitions?.[0]?.competitors||[];
  const boxes=d.boxscore?.teams||[];
  const stat=name=>boxes.length===2?countPair(...boxes.map(t=>t.statistics?.find(v=>v.name===name)?.displayValue)):null;
  g.firstHalf=competitors.length===2?countPair(...competitors.map(t=>t.linescores?.[0]?.displayValue)):null;
  g.corners=stat('wonCorners');g.yellow=stat('yellowCards');g.playerShots=shotObservations(d);
 }));
 return rows.map(g=>({...g,url:'https://www.espn.com/soccer/match/_/gameId/'+g.id}));
}
function mergeResults(csv,espn){
 const espnNames=new Map(espn.flatMap(g=>g.teams.map(t=>[normalize(aliases[t.name]||t.name),t.id])));
 const rows=csv.map(g=>({...g,source:g.source||'Football-Data',teams:g.teams.map(t=>{
  if(!t.id.startsWith('csv:'))return t;
  return {...t,id:espnNames.get(normalize(t.id.slice(4)))||t.id};
 })}));
 const day=86400000;
 const pairs=new Map();
 const pair=g=>g.teams.map(t=>t.id).join('/');
 for(const g of rows){
  const key=pair(g);
  if(!pairs.has(key))pairs.set(key,[]);
  pairs.get(key).push(Date.parse(g.date));
 }
 const seen=new Set();
 for(const g of espn){
  if(seen.has(g.id))continue;
  seen.add(g.id);
  if((pairs.get(pair(g))||[]).some(date=>Math.abs(date-Date.parse(g.date))<2*day))continue;
  rows.push(g);
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
const oddsSports={
 'eng.1':'soccer_epl','esp.1':'soccer_spain_la_liga','ita.1':'soccer_italy_serie_a',
 'ger.1':'soccer_germany_bundesliga','fra.1':'soccer_france_ligue_one','usa.1':'soccer_usa_mls',
 'mex.1':'soccer_mexico_ligamx','uefa.champions':'soccer_uefa_champs_league',
 'uefa.europa':'soccer_uefa_europa_league','bra.1':'soccer_brazil_campeonato',
 'por.1':'soccer_portugal_primeira_liga','ned.1':'soccer_netherlands_eredivisie'
};
const books=['pinnacle','williamhill','betsson','betvictor'];
const oddsAliases={
 'Manchester United':'Man United','Manchester City':'Man City','Tottenham Hotspur':'Tottenham',
 'Brighton & Hove Albion':'Brighton','Newcastle United':'Newcastle','West Ham United':'West Ham',
 'Atlético Madrid':'Atletico Madrid','Athletic Bilbao':'Athletic Club',
 'Internazionale':'Inter Milan','Inter':'Inter Milan','Paris Saint-Germain':'Paris SG',
 'Paris Saint Germain':'Paris SG','PSG':'Paris SG','Guadalajara':'Chivas Guadalajara',
 'CD Guadalajara':'Chivas Guadalajara','América':'Club América'
};
const oddsName=name=>normalize((oddsAliases[name]||name).replace(/^(FC|CF|SC) | (FC|CF|SC)$/gi,''));
const oddsPending=new Map();
async function bookmakerOdds(league,match,key){
 const sport=oddsSports[league];
 if(!sport)return {status:'unsupported'};
 if(!key)return {status:'unconfigured'};
 const url=new URL('https://api.the-odds-api.com/v4/sports/'+sport+'/odds');
 url.search=new URLSearchParams({apiKey:key,bookmakers:books.join(','),markets:'h2h',oddsFormat:'decimal'});
 // Coalesce requests for the same league while its shared snapshot is loading.
 const requestUrl=url.toString();
 if(!oddsPending.has(requestUrl)){
  oddsPending.set(requestUrl,json(requestUrl,900).finally(()=>oddsPending.delete(requestUrl)));
 }
 const games=await oddsPending.get(requestUrl);
 const start=Date.parse(match.date);
 const [home,away]=match.teams;
 const matches=games.filter(g=>Math.abs(Date.parse(g.commence_time)-start)<=30*60000&&
  oddsName(g.home_team)===oddsName(home.name)&&oddsName(g.away_team)===oddsName(away.name));
 if(matches.length!==1)return {status:'unavailable'};
 const game=matches[0];
 const quotes=(game.bookmakers||[]).filter(b=>books.includes(b.key)).flatMap(b=>{
  const market=b.markets?.find(m=>m.key==='h2h');
  const prices=[game.home_team,'Draw',game.away_team].map(name=>market?.outcomes?.find(o=>o.name===name)?.price);
  return prices.every(p=>Number.isFinite(p)&&p>1)?[{name:b.title,updated:market.last_update||b.last_update,prices}]:[];
 });
 return {status:quotes.length?'available':'unavailable',quotes};
}
async function upcoming(){
 const now=new Date(),end=new Date(+now+7*86400000);
 const range=stamp(now)+'-'+stamp(end);
 const competitions=Object.keys(leagues);
 const results=await Promise.allSettled(competitions.map(async league=>{
  const data=await json(root+league+'/scoreboard?dates='+range+'&limit=150');
  return (data.events||[]).map(e=>event(e,league));
 }));
 const games=results.flatMap(r=>r.status==='fulfilled'?r.value:[])
  .filter(e=>e&&e.state==='pre'&&Date.parse(e.date)>=+now&&Date.parse(e.date)<=+end)
  .sort((a,b)=>a.date.localeCompare(b.date));
 return {events:[...new Map(games.map(e=>[e.id,e])).values()],
  unavailable:results.filter(r=>r.status==='rejected').length,competitions:competitions.length};
}
export default {async fetch(request,env){const u=new URL(request.url);try{
if(u.pathname==='/api/picks')return Response.json({error:'Agenda temporalmente deshabilitada: integración segura con Supabase pendiente.'},{status:503,headers:{'Cache-Control':'no-store'}});

if(u.pathname==='/api/fixtures'){const raw=u.searchParams.get('date');const start=raw&&/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T00:00:00Z'):new Date();if(!Number.isFinite(+start))return Response.json({error:'Fecha inválida'},{status:400});const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);const chosen=u.searchParams.get('league');const keys=chosen&&leagues[chosen]?[chosen]:['eng.1','esp.1','ita.1','ger.1','fra.1','mex.1'];const results=await Promise.allSettled(keys.map(async l=>{const days=await Promise.all(Array.from({length:7},async(_,i)=>{const day=new Date(start);day.setUTCDate(day.getUTCDate()+i);const d=await json(root+l+'/scoreboard?dates='+stamp(day)+'&limit=100');return (d.events||[]).map(e=>event(e,l)).filter(Boolean)}));return days.flat()}));return Response.json({events:results.flatMap(r=>r.status==='fulfilled'?r.value:[]).sort((a,b)=>a.date.localeCompare(b.date)),failed:keys.filter((_,i)=>results[i].status==='rejected'),leagues,updated:new Date().toISOString()});}
if(u.pathname==='/api/upcoming')return Response.json(await upcoming());
if(u.pathname==='/api/odds'){
 const league=u.searchParams.get('league'),id=u.searchParams.get('id');
 if(!Object.hasOwn(leagues,league)||!/^\d+$/.test(id||''))return Response.json({error:'Partido inválido'},{status:400});
 if(!oddsSports[league])return Response.json({status:'unsupported'});
 if(!env?.ODDS_API_KEY)return Response.json({status:'unconfigured'});
 const data=await json(root+league+'/summary?event='+id,600);
 const match=event(data.header,league);
 if(!match||match.state!=='pre'||Date.parse(match.date)<=Date.now())return Response.json({status:'unavailable'});
 return Response.json(await bookmakerOdds(league,match,env.ODDS_API_KEY));
}
if(u.pathname==='/api/news'){const league=u.searchParams.get('league')||'eng.1';if(!leagues[league])return Response.json({error:'Liga inválida'},{status:400});const data=await json(root+league+'/news?limit=30&lang=es&region=mx',u.searchParams.has('fresh')?0:900);return Response.json({articles:(data.articles||[]).map(a=>({title:a.headline,url:a.links?.web?.href,date:a.published,image:a.images?.[0]?.url,teams:(a.categories||[]).filter(x=>x.type==='team').map(x=>String(x.teamId)),category:/lesi[oó]n|lesionad|baja|operaci[oó]n/i.test(a.headline)?'Lesiones':/fichaj|contrat|traspas|transfer|refuerzo/i.test(a.headline)?'Fichajes':/camiseta|uniforme|equipaci/i.test(a.headline)?'Equipaciones':'Noticias'}))});}
if(u.pathname==='/api/match'){const league=u.searchParams.get('league'),id=u.searchParams.get('id');if(!leagues[league]||!/^\d+$/.test(id||''))return Response.json({error:'Partido inválido'},{status:400});const startedAt=new Date().toISOString();const fresh=url=>json(url,0);const data=await fresh(root+league+'/summary?event='+id);const match=event(data.header,league);if(match)match.venue=data.gameInfo?.venue||match.venue;if(!match)return Response.json({error:'Partido no disponible'},{status:404});const [w,csv,espn]=await Promise.allSettled([weather(data.gameInfo?.venue||match.venue,match.date,fresh),history(league,match,true),recentResults(league,match,fresh)]);const cutoff=Math.min(Date.now(),Date.parse(match.date));const games=mergeResults(csv.value||[],espn.value||[]).filter(g=>Date.parse(g.date)>=cutoff-365*86400000&&Date.parse(g.date)<cutoff);return Response.json({run:{id:crypto.randomUUID(),startedAt,mode:"on-demand",models:["Poisson","Dixon–Coles","Elo","Monte Carlo (si hay histórico)","Binomial negativa","Frecuencia observada"],checks:[{name:"ESPN · partido",status:"consultado"},{name:"ESPN · histórico y estadísticas",status:espn.status==="fulfilled"?(espn.value.length?"consultado":"sin registros"):"falló la consulta"},{name:"Football-Data",status:!divisions[league]?"liga sin cobertura":csv.status==="fulfilled"?(csv.value.length?"consultado":"sin registros"):"falló la consulta"},{name:"Open-Meteo",status:w.status==="fulfilled"&&w.value?"consultado":w.status==="rejected"?String(w.reason?.message||"error de conexión"):"sin fecha o ubicación verificable"},{name:"FootyStats / API-Football / Sportmonks",status:"sin conexión configurada"},{name:"Sofascore",status:"referencia manual, no integrado"}]},match,observations:games.filter(g=>g.teams.some(t=>match.teams.some(m=>m.id===t.id))),rosters:(data.rosters||[]).map(r=>({team:r.team.displayName,formation:r.formation,players:(r.roster||[]).filter(p=>p.starter).map(p=>({name:p.athlete?.displayName,number:p.jersey,position:p.position?.abbreviation}))})),officials:data.gameInfo?.officials||[],weather:w.status==='fulfilled'?w.value:null,weatherError:w.status==='rejected'?String(w.reason?.message||'Error de conexión'):null,analysis:analyze(games,match),countAnalysis:countMarkets(games,match),playerAnalysis:playerShots(espn.value||[],match,data.rosters||[]),sources:[...new Set(games.map(g=>g.source))],news:[],updated:new Date().toISOString()},{headers:{"Cache-Control":"no-store, max-age=0"}});}
if(u.pathname.startsWith('/api/'))return Response.json({error:'Ruta no encontrada'},{status:404});return new Response(enhancePage(html),{headers:{'Content-Type':'text/html;charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src 'self' https://geocoding-api.open-meteo.com https://api.open-meteo.com; frame-ancestors 'none'; base-uri 'self'"}});
}catch(error){return Response.json({error:'No se pudo consultar la fuente. Intenta actualizar en unos minutos.'},{status:502});}}};

