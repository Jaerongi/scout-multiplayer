export const COLOR_MAP={1:"#5c6ae6",2:"#3b4df5",3:"#74c1e8",4:"#31b3bd",5:"#31bd7c",6:"#7be39c",7:"#f2fa0a",8:"#c7cc35",9:"#f2c913",10:"#fa2e23"};
function vals(cards){return cards.map(c=>c.top);}
export function isSet(cards){ if(cards.length<=1)return false; return vals(cards).every(v=>v===vals(cards)[0]); }
export function isRun(cards){ if(cards.length<=1)return false; const a=vals(cards).sort((a,b)=>a-b); for(let i=1;i<a.length;i++)if(a[i]!==a[i-1]+1)return false; return true; }
export function getComboType(cards){ if(isSet(cards))return "set"; if(isRun(cards))return "run"; return "invalid"; }
export function isStrongerCombo(n,o){
 if(o.length===0)return true;
 if(n.length!==o.length)return n.length>o.length;
 const rank={set:2,run:1,invalid:0};
 const tn=getComboType(n), to=getComboType(o);
 if(rank[tn]!==rank[to])return rank[tn]>rank[to];
 const mn=Math.max(...vals(n)), mo=Math.max(...vals(o));
 return mn>mo;
}
