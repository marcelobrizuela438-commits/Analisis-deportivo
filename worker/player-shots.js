// Player forecasts are conditional on playing a role comparable to the observed appearances.
export function shotObservations(data) {
 const rows=[];
 for(const team of data.rosters||[])for(const player of team.roster||[]){
  const stat=name=>{const s=player.stats?.find(s=>s.name===name);const v=s?.value??s?.displayValue;return v==null||v===''?null:Number(v);};
  const shots=stat('shotsOnTarget');
  if(stat('appearances')!==1||!Number.isInteger(shots)||shots<0||!player.athlete?.id)continue;
  rows.push({id:String(player.athlete.id),teamId:String(team.team.id),name:player.athlete.displayName,position:player.position?.abbreviation,shots,starter:player.starter===true});
 }
 return rows;
}
export function playerShots(games,match,rosters=[]) {
 const cutoff=Math.min(Date.now(),Date.parse(match.date));
 const history=games.filter(g=>Date.parse(g.date)<cutoff&&Date.parse(g.date)>=cutoff-365*86400000).sort((a,b)=>a.date.localeCompare(b.date));
 return match.teams.map(team=>{
  const published=rosters.find(r=>String(r.team?.id)===String(team.id));
  const hasLineup=(published?.roster||[]).filter(p=>p.starter).length===11;
  const latest=history.filter(g=>g.playerShots?.some(p=>p.teamId===String(team.id))).at(-1);
  const candidates=hasLineup?new Set(published.roster.filter(p=>p.starter).map(p=>String(p.athlete?.id))):new Set((latest?.playerShots||[]).filter(p=>p.teamId===String(team.id)).map(p=>p.id));
  const byPlayer=new Map();
  for(const game of history)for(const p of game.playerShots||[]){
   if(p.teamId!==String(team.id)||!candidates.has(p.id)||p.position==='G'||p.position==='GK')continue;
   if(!byPlayer.has(p.id))byPlayer.set(p.id,{id:p.id,name:p.name,position:p.position,observations:[]});
   const row=byPlayer.get(p.id);if(!row.observations.some(o=>o.id===game.id))row.observations.push({id:game.id,date:game.date,shots:p.shots,starter:p.starter});
  }
  const players=[...byPlayer.values()].map(p=>{
   const n=p.observations.length,total=p.observations.reduce((s,o)=>s+o.shots,0),hits=p.observations.filter(o=>o.shots>=1).length;
   const poisson=1-Math.exp(-total/n),frequency=(hits+1)/(n+2);
   return {...p,n,total,hits,average:total/n,probability:(poisson+frequency)/2,poisson,frequency,limited:n<5};
  }).sort((a,b)=>b.probability-a.probability||b.n-a.n);
  return {teamId:team.id,team:team.name,hasLineup,players,source:'ESPN',latest:latest?.date||null};
 });
}
