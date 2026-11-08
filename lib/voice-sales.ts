export interface SalesProduct { id:string;name:string;selling_price:number;voice_aliases:string[] }
export interface SalesLine { product_id:string;quantity:number;unit_price:number;heard?:string }
export const indiaDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
export const normalize=(value:string)=>value.toLowerCase().replace(/[०-९]/g,c=>String('०१२३४५६७८९'.indexOf(c))).replace(/[.,।]/g,' ').replace(/\s+/g,' ').trim();
export function parseVoiceSale(text:string,products:SalesProduct[]):SalesLine[]{
 const numbers:Record<string,number>={'एक':1,'दो':2,'तीन':3,'चार':4,'पांच':5,'पाँच':5,'छह':6,'सात':7,'आठ':8,'नौ':9,'दस':10,'ग्यारह':11,'बारह':12,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'ten':10,'twelve':12};
 return text.split(/[,\n।]+|\s+और\s+|\s+and\s+/i).filter(c=>c.trim()).map(heard=>{
  const clause=normalize(heard);
  const matches=products.filter(p=>[p.name,...(p.voice_aliases||[])].filter(a=>a.trim()).some(a=>(' '+clause+' ').includes(' '+normalize(a)+' ')));
  const p=matches.length===1?matches[0]:undefined;let rest=clause;
  if(p)for(const name of [p.name,...(p.voice_aliases||[])].sort((a,b)=>b.length-a.length)){const alias=normalize(name);if(alias)rest=(' '+rest+' ').replace(' '+alias+' ',' ').trim()}
  const quantities=rest.split(' ').map(w=>numbers[w]??(/^\d+$/.test(w)?Number(w):null)).filter(v=>v!==null);
  const ambiguous=quantities.length!==1||/रुप|₹|rate|discount|डिस्काउंट|परसेंट|percent|box|बॉक्स|dozen|दर्जन|packet|पैकेट/.test(rest);
  return {product_id:p?.id||'',quantity:ambiguous?0:quantities[0]!,unit_price:p?.selling_price||0,heard};
 });
}
export function saleTotal(lines:SalesLine[]){return lines.reduce((total,l)=>total+Math.round(l.unit_price*100)*l.quantity,0)/100}
