// Count markets combine parametric forecasts with observed frequencies.
const marketDefinitions = [
  {key:'firstHalf',title:'Goles en primer tiempo',lines:[0.5,1.5,2.5]},
  {key:'corners',title:'Córners totales',lines:[7.5,8.5,9.5,10.5,11.5]},
  {key:'yellow',title:'Tarjetas amarillas totales',lines:[2.5,3.5,4.5,5.5]},
];
const weightCandidates = [[.6,.2,.2],[.2,.6,.2],[.2,.2,.6],[1/3,1/3,1/3]];
function mean(values) { return values.reduce((sum,x)=>sum+x,0)/values.length; }
function countOver(mu,variance,line,negativeBinomial) {
  const size = variance>mu ? mu*mu/(variance-mu) : Infinity;
  const useNB = negativeBinomial && Number.isFinite(size) && size>0;
  let probability = useNB ? (size/(size+mu))**size : Math.exp(-mu);
  let cdf=probability;
  for(let k=1;k<=Math.floor(line);k++) {
    probability *= useNB ? ((k-1+size)/k)*(mu/(size+mu)) : mu/k;
    cdf+=probability;
  }
  return Math.max(0,Math.min(1,1-cdf));
}
function candidates(history,match,key,line) {
  const values=history.map(g=>g[key]);
  const leagueMean=mean(values);
  const relevant=history.filter(g=>g.teams.some(t=>match.teams.some(m=>m.id===t.id)));
  const recent=relevant.slice(-40);
  if(recent.length<1) return null;
  const average=(recent.reduce((sum,g)=>sum+g[key],0)+10*leagueMean)/(recent.length+10);
  const variance=mean(values.map(x=>(x-leagueMean)**2));
  const empirical=(recent.filter(g=>g[key]>line).length+10*values.filter(x=>x>line).length/values.length)/(recent.length+10);
  return [countOver(average,variance,line,false),countOver(average,variance,line,true),empirical];
}
function mix(values,weights) { return values.reduce((sum,p,i)=>sum+p*weights[i],0); }
export function countMarkets(games,match) {
 const cutoff=Math.min(Date.now(),Date.parse(match.date));games=games.filter(g=>Date.parse(g.date)>=cutoff-365*86400000&&Date.parse(g.date)<cutoff).sort((a,b)=>a.date.localeCompare(b.date));
  return marketDefinitions.map(definition=>{
    const eligible=games.filter(g=>g.date<match.date&&Number.isInteger(g[definition.key])&&g[definition.key]>=0);
    const samples=match.teams.map(t=>eligible.filter(g=>g.teams.some(s=>s.id===t.id)).length);
    if(!eligible.length||!Math.max(...samples))return {...definition,unavailable:true,samples,total:eligible.length};
    // Split on complete calendar days so simultaneous fixtures cannot cross boundaries.
    const dates=[...new Set(eligible.map(g=>g.date.slice(0,10)))];
    const validationDate=dates[Math.floor(dates.length*.6)],testDate=dates[Math.floor(dates.length*.8)];
    const training=eligible.filter(g=>g.date.slice(0,10)<validationDate);
    const validation=eligible.filter(g=>g.date.slice(0,10)>=validationDate&&g.date.slice(0,10)<testDate);
    const testing=eligible.filter(g=>g.date.slice(0,10)>=testDate);
    const center=definition.lines[Math.floor(definition.lines.length/2)];
    const validationPredictions=validation.map(g=>({p:candidates(training,g,definition.key,center),actual:Number(g[definition.key]>center)})).filter(x=>x.p);

    const errors=weightCandidates.map(weights=>mean(validationPredictions.map(x=>(mix(x.p,weights)-x.actual)**2)));
    const calibrated=validationPredictions.length>=20;
    const weights=calibrated?weightCandidates[errors.indexOf(Math.min(...errors))]:[1/3,1/3,1/3];
    const frozen=eligible.filter(g=>g.date.slice(0,10)<testDate);
    const rows=definition.lines.map(line=>{
      const components=candidates(eligible,match,definition.key,line);
      const predicted=mix(components,weights);
      const trials=testing.map(g=>({p:candidates(frozen,g,definition.key,line),actual:Number(g[definition.key]>line)})).filter(x=>x.p);
      const brier=trials.length?mean(trials.map(x=>(mix(x.p,weights)-x.actual)**2)):null;
      return {line,over:predicted,components,brier,n:trials.length};
    });
    return {...definition,samples,total:eligible.length,calibrated,limited:Math.min(...samples)<8,weights,rows,from:eligible[0].date,to:eligible.at(-1).date,sources:[...new Set(eligible.map(g=>g.source))]};
  });
}
