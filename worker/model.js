import { monteCarlo } from './monte-carlo.js';
function fit(games){
 const names=[...new Set(games.flatMap(g=>g.teams.map(t=>t.id)))];const attack=Object.fromEntries(names.map(n=>[n,0]));const defense={...attack};let base=.15,home=.15;
 const latest=Date.parse(games.at(-1).date);
 const weighted=games.map(g=>({...g,weight:Math.exp(-(latest-Date.parse(g.date))/15552000000)}));
 for(let step=0;step<160;step++){const da=Object.fromEntries(names.map(n=>[n,0])),dd={...da};let db=0,dh=0;
 for(const g of weighted){const [h,a]=g.teams;const w=g.weight;const lh=Math.exp(base+home+attack[h.id]-defense[a.id]),la=Math.exp(base+attack[a.id]-defense[h.id]);const eh=w*(h.score-lh),ea=w*(a.score-la);da[h.id]+=eh;da[a.id]+=ea;dd[a.id]-=eh;dd[h.id]-=ea;db+=eh+ea;dh+=eh;}
 const rate=.08/games.length;for(const n of names){attack[n]+=rate*(da[n]-2*attack[n]);defense[n]+=rate*(dd[n]-2*defense[n]);}base+=rate*db;home+=rate*dh;}
 const rates=(h,a)=>[Math.exp(base+home+(attack[h]||0)-(defense[a]||0)),Math.exp(base+(attack[a]||0)-(defense[h]||0))];let rho=0,best=-Infinity;
 for(let r=-.15;r<=.151;r+=.01){let ll=0,valid=true;for(const g of games){const [h,a]=g.teams;const [x,y]=rates(h.id,a.id);const t=tau(h.score,a.score,x,y,r);if(t<=0){valid=false;break;}ll+=Math.log(t);}if(valid&&ll>best){best=ll;rho=r;}}
 return {rates,rho};
}
function tau(h,a,x,y,r){if(h===0&&a===0)return 1-x*y*r;if(h===0&&a===1)return 1+x*r;if(h===1&&a===0)return 1+y*r;if(h===1&&a===1)return 1-r;return 1;}
export function distribution(x,y,r){const ph=[Math.exp(-x)],pa=[Math.exp(-y)];for(let i=1;i<=20;i++){ph[i]=ph[i-1]*x/i;pa[i]=pa[i-1]*y/i;}const rows=[];let total=0;for(let h=0;h<=20;h++)for(let a=0;a<=20;a++){const p=ph[h]*pa[a]*tau(h,a,x,y,r);if(p<0)return distribution(x,y,0);total+=p;rows.push({h,a,p});}return rows.map(v=>({...v,p:v.p/total}));}
function elo(games){const scores={};for(const g of games){const [h,a]=g.teams;const hr=scores[h.id]||1500,ar=scores[a.id]||1500;const expected=1/(1+10**((ar-hr-65)/400));const actual=h.score>a.score?1:h.score===a.score?.5:0;const delta=20*(actual-expected);scores[h.id]=hr+delta;scores[a.id]=ar-delta;}return scores;}
function estimate(games,h,a){
 const count=id=>games.filter(g=>g.teams.some(t=>t.id===id)).length;
 const sample=[count(h),count(a)];
 const ratings=elo(games);
 const scores=[ratings[h]||1500,ratings[a]||1500];
 const model=fit(games);
 const [rawHome,rawAway]=model.rates(h,a);
 // Shrink rates and the low-score correction toward neutral values in small samples.
 const leagueWeight=games.length/(games.length+24);
 const teamWeight=sample.map(n=>n/(n+4));
 const [baseHome,baseAway]=model.rates(null,null);
 const homeRate=(1-leagueWeight)*1.45+leagueWeight*(baseHome+teamWeight[0]*teamWeight[1]*(rawHome-baseHome));
 const awayRate=(1-leagueWeight)*1.15+leagueWeight*(baseAway+teamWeight[0]*teamWeight[1]*(rawAway-baseAway));
 const total=homeRate+awayRate;
 const tilt=Math.exp(Math.max(-.2,Math.min(.2,(scores[0]-scores[1])/1200)));
 const x=total*homeRate*tilt/(homeRate*tilt+awayRate);
 const y=total-x;
 const rho=model.rho*leagueWeight;
 return {x,y,rho,scores,sample,rows:distribution(x,y,rho)};
}
export function analyze(games,match){
 const cutoff=Math.min(Date.now(),Date.parse(match.date));games=games.filter(g=>Date.parse(g.date)>=cutoff-365*86400000&&Date.parse(g.date)<cutoff).sort((a,b)=>a.date.localeCompare(b.date));
 games=games.filter(g=>g.date<match.date);
 const [h,a]=match.teams;
 const sources=[...new Set(games.map(g=>g.source).filter(Boolean))];
 if(!games.some(g=>g.teams.some(t=>t.id===h.id||t.id===a.id))){
  return {unavailable:true,reason:'Las fuentes consultadas todavía no aportan resultados anteriores de estos equipos en esta competición.'};
 }
 const {x,y,rho,scores,sample,rows}=estimate(games,h.id,a.id);
 const sum=f=>rows.filter(f).reduce((s,v)=>s+v.p,0);
 const home=sum(v=>v.h>v.a),draw=sum(v=>v.h===v.a),away=sum(v=>v.h<v.a);
 const markets=[['1X2',[['Local',home],['Empate',draw],['Visitante',away]]],['Doble oportunidad',[['1X',home+draw],['X2',draw+away],['12',home+away]]],... [1.5,2.5,3.5].map(line=>['Goles '+line,[['Más de '+line,sum(v=>v.h+v.a>line)],['Menos de '+line,sum(v=>v.h+v.a<line)]]]),['Ambos marcan',[['Sí',sum(v=>v.h>0&&v.a>0)],['No',sum(v=>v.h===0||v.a===0)]]]];
 const split=Math.floor(games.length*.8);
 let brier=0,loss=0,n=0,hits=0;
 if(split>=20){
  const training=games.slice(0,split);
  const observed=new Set(training.flatMap(g=>g.teams.map(t=>t.id)));
  // Validate the original scoring model on the chronological holdout.
  const validation=fit(training);
  for(const g of games.slice(split)){
   const [th,ta]=g.teams;
   if(!observed.has(th.id)||!observed.has(ta.id))continue;
   const d=distribution(...validation.rates(th.id,ta.id),validation.rho);
   const p=[0,0,0];
   for(const v of d)p[v.h>v.a?0:v.h===v.a?1:2]+=v.p;
   const actual=th.score>ta.score?0:th.score===ta.score?1:2;
   loss-=Math.log(Math.max(p[actual],1e-12));
   brier+=p.reduce((s,v,i)=>s+(v-(i===actual?1:0))**2,0);
   hits+=p.indexOf(Math.max(...p))===actual?1:0;n++;
  }
 }
 const best=markets.map(([market,options])=>{
  const [label,p]=options.reduce((best,option)=>option[1]>best[1]?option:best);
  return {market,label,p};
 }).sort((a,b)=>b.p-a.p);
 return {monteCarlo:monteCarlo(rows),markets,best,sources,rates:[x,y],sample,total:games.length,rho,elo:scores,limited:games.length<24||Math.min(...sample)<5,scores:rows.sort((a,b)=>b.p-a.p).slice(0,5),validation:n?{n,brier:brier/n,logloss:loss/n,accuracy:hits/n}:null,from:games[0].date,to:games.at(-1).date,method:'Poisson con ataque, defensa, localía y ponderación temporal, con corrección Dixon–Coles. Elo ajusta el reparto de goles entre equipos. Con pocos resultados, las tasas se acercan a valores de referencia. La prueba cronológica 80/20 evalúa el modelo base de goles.'};
}
