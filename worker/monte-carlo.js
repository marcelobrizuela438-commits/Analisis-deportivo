export function monteCarlo(rows, n=10000, seed=123456789) {
  if(!rows.length || !Number.isInteger(n) || n<1) throw new Error('Distribución o número de simulaciones inválido');
  let total=0;const cdf=rows.map(r=>total+=r.p);
  if(!Number.isFinite(total)||total<=0)throw new Error('Distribución inválida');
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  const counts=new Uint32Array(rows.length);let home=0,draw=0,away=0,btts=0,gh=0,ga=0;const lines=[0.5,1.5,2.5,3.5,4.5],over=lines.map(()=>0);
  for(let i=0;i<n;i++){const u=random()*total;let lo=0,hi=cdf.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(u<cdf[mid])hi=mid;else lo=mid+1;}counts[lo]++;const {h,a}=rows[lo];gh+=h;ga+=a;if(h>a)home++;else if(h===a)draw++;else away++;if(h>0&&a>0)btts++;for(let j=0;j<lines.length;j++)if(h+a>lines[j])over[j]++;}
  const p=x=>x/n;
  return {n,seed,mean:[gh/n,ga/n],markets:[['1X2',[['Local',p(home)],['Empate',p(draw)],['Visitante',p(away)]]],['Doble oportunidad',[['1X',p(home+draw)],['X2',p(draw+away)],['12',p(home+away)]]],...lines.map((l,j)=>['Goles '+l,[['Más de '+l,p(over[j])],['Menos de '+l,p(n-over[j])]]]),['Ambos marcan',[['Sí',p(btts)],['No',p(n-btts)]]]],scores:rows.map((r,i)=>({h:r.h,a:r.a,p:p(counts[i])})).filter(r=>r.p>0).sort((a,b)=>b.p-a.p).slice(0,5)};
}
