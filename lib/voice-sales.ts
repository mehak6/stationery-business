import {suggestedHindiAliases} from './hindi-products';
export interface SalesProduct { id: string; name: string; selling_price: number; voice_aliases: string[] }
export interface SalesLine { product_id: string; quantity: number; unit_price: number; heard?: string; suggested_ids?: string[] }
export const indiaDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const normalize = (value: string) => value.normalize('NFC').toLowerCase().replace(/[०-९]/g, c => String('०१२३४५६७८९'.indexOf(c))).replace(/[.,।@()\-_/]/g, ' ').replace(/\s+/g, ' ').trim();

// Translate product words, never prices or quantities. Variants require review.
const vocabulary: Record<string, string[]> = {
 pencil: ['पेंसिल','पेन्सिल','पेंसिलें','pensil','pencils'],
 pen: ['पेन','पैन','pens'], notebook: ['कॉपी','कापी','नोटबुक','copy','copies','notebooks'],
 eraser: ['रबड़','रबर','इरेज़र','इरेजर','rubber','erasers'],
 sharpener: ['शार्पनर','sharpners','sharpeners'],
 ruler: ['स्केल','रूलर','scale','scales'], diary: ['डायरी','diaries'],
 blue: ['नीला','नीले','नीली','neela','neele'], red: ['लाल','laal'], black: ['काला','काले','काली'],
 green: ['हरा','हरे','हरी'], book: ['बुक','किताब','books'],
 ball: ['बॉल','गेंद','balls'], car: ['कार','cars'], doll: ['डॉल','गुड़िया','dolls'],
 keychain: ['कीचेन','कीरिंग','keychains'], glue: ['ग्लू','गोंद'],
 marker: ['मार्कर','markers'], file: ['फाइल','फ़ाइल','files'],
 folder: ['फोल्डर','folders'], tape: ['टेप','tapes'], clay: ['क्ले'],
 crayon: ['क्रेयॉन','क्रेयोन','crayons'], colour: ['कलर','कलर्स','color','colors','colours'],
 cover: ['कवर','covers'], mobile: ['मोबाइल'], watch: ['वॉच','घड़ी','watches'],
 bottle: ['बोतल','बॉटल','bottles'], bag: ['बैग','bags'],
};
const translations = new Map(Object.entries(vocabulary).flatMap(([word, aliases]) => aliases.map(alias => [normalize(alias), word] as const)));
export const productWords = (text: string) => normalize(text).split(' ').map(word => numbers[word] !== undefined ? String(numbers[word]) : translations.get(word) || word).join(' ');
const numbers: Record<string, number> = { 'एक':1,'दो':2,'तीन':3,'चार':4,'पांच':5,'पाँच':5,'छह':6,'सात':7,'आठ':8,'नौ':9,'दस':10,'ग्यारह':11,'बारह':12,'तेरह':13,'चौदह':14,'पंद्रह':15,'बीस':20, one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12,ek:1,do:2,teen:3,char:4,paanch:5 };
const filler = new Set(['पीस','piece','pieces','बेचे','बेची','बेचा','बिके','बिकी','बिका','sold','दे']);
const quantity = (word: string) => numbers[word] ?? (/^\d+$/.test(word) ? Number(word) : null);
Object.assign(numbers, {'सोलह':16,'सत्रह':17,'अठारह':18,'उन्नीस':19,'इक्कीस':21,'बाईस':22,'तीस':30,'चालीस':40,'पचास':50,'साठ':60,'सत्तर':70,'अस्सी':80,'नब्बे':90,'सौ':100,'दो सौ':200});
const namesFor = (p: SalesProduct) => [...new Set([p.name, ...(p.voice_aliases || []), ...suggestedHindiAliases(p.name)].map(productWords).filter(Boolean))];

export function productSuggestions(text: string, products: SalesProduct[]): SalesProduct[] {
 const query = productWords(text).split(' ').filter(w => quantity(w) === null && !filler.has(w));
 if (!query.length) return [];
 return products.map(p => ({p, score: Math.max(...namesFor(p).map(name => query.filter(w => name.split(' ').includes(w)).length))}))
  .filter(item => item.score > 0).sort((a,b) => b.score-a.score || a.p.name.localeCompare(b.p.name)).slice(0,8).map(item => item.p);
}
export function parseVoiceSale(text: string, products: SalesProduct[]): SalesLine[] {
 const namedProducts=products.map(p=>({p,names:namesFor(p)}));
 function parseLine(heard:string):SalesLine {
  const clause = productWords(heard);
  const candidates = namedProducts.flatMap(({p,names}) => names.flatMap(name => {
   if (!(' '+clause+' ').includes(' '+name+' ')) return [];
   const rest = (' '+clause+' ').replace(' '+name+' ', ' ').trim();
   // Never silently discard an unmatched brand, colour, pack or price.
   if (rest.split(' ').some(w => w && quantity(w) === null && !filler.has(w))) return [];
   return [{p, name, rest}];
  })).sort((a,b) => b.name.length-a.name.length);
  const best = candidates[0];
  const exact = best && new Set(candidates.filter(c => c.name.length===best.name.length).map(c=>c.p.id)).size===1 ? best : undefined;
  // A duplicate catalogue name still identifies which number is the quantity.
  // Leave the product unselected, but do not mistake its price/size for a quantity.
  const top=candidates.filter(c=>c.name.length===best?.name.length);
  const rest = exact?.rest || (top.length && new Set(top.map(c=>c.rest)).size===1 ? top[0].rest : clause);
  const quantities = rest.split(' ').map(quantity).filter((v): v is number => v!==null);
  const ambiguous = quantities.length!==1 || /रुप|₹|rate|discount|डिस्काउंट|परसेंट|percent|box|बॉक्स|dozen|दर्जन|packet|पैकेट/.test(rest);
  return {product_id:exact?.p.id||'', quantity:ambiguous?0:quantities[0], unit_price:exact?.p.selling_price||0, heard,
   suggested_ids: exact ? [] : productSuggestions(heard, products).map(p=>p.id)};
 }
 // First recognise complete catalogue names, including names containing 'and/और'.
 // Prefer exact segmentation. If a name is unclear, quantity boundaries can still
 // preserve separate rows; matching a product and detecting its count are separate.
 function segment(heard:string):SalesLine[]{
  const whole=parseLine(heard);
  if(whole.product_id && whole.quantity>0)return [whole];
  const words=heard.trim().split(/\s+/);
  if(words.length>100)return [whole];
  const memo=new Map<number,SalesLine[][]>();
  function paths(start:number):SalesLine[][] {
   if(start===words.length)return [[]];
   if(memo.has(start))return memo.get(start)!;
   const found:SalesLine[][]=[];
   for(let end=start+1;end<=words.length;end++){
    const line=parseLine(words.slice(start,end).join(' '));
    if(!line.product_id || line.quantity<=0)continue;
    for(const suffix of paths(end)){found.push([line,...suffix]);if(found.length>1)break;}
    if(found.length>1)break;
   }
   memo.set(start,found);return found;
  }
  const possible=paths(0);if(possible.length===1)return possible[0];
  if(possible.length>1 || words.some(w=>/^(और|and|फिर|plus|प्लस)$/i.test(w)))return [whole];
  const canonical=words.map(w=>productWords(w));
  // A numeric size or price inside a known name must never become a new item.
  const nameNumbers=new Set<number>();
  for(let start=0;start<words.length;start++)for(let end=start+1;end<=words.length;end++){
   const phrase=canonical.slice(start,end).join(' ');
   if(namedProducts.some(p=>p.names.includes(phrase)))for(let i=start;i<end;i++)if(quantity(canonical[i])!==null)nameNumbers.add(i);
  }
  const counts=canonical.flatMap((w,i)=>quantity(w)!==null&&!nameNumbers.has(i)?[i]:[]);
  if(counts.length<2)return [whole];
  const prefix=counts[0]===0;
  const boundaries:number[]=[0];
  if(prefix)boundaries.push(...counts.slice(1));
  else for(const i of counts){let end=i+1;while(end<words.length&&filler.has(canonical[end]))end++;boundaries.push(end);}
  if(boundaries[boundaries.length-1]!==words.length)boundaries.push(words.length);
  const separated=boundaries.slice(0,-1).map((start,i)=>parseLine(words.slice(start,boundaries[i+1]).join(' ')));
  // Keep unknown product words for manual selection. Never discard prices, packs,
  // leftover words or a fragment that consists only of a number/unit.
  return separated.length>1 && separated.every(l=>l.quantity>0 && productWords(l.heard||'').split(' ').some(w=>quantity(w)===null&&!filler.has(w))) ? separated : [whole];
 }
 return text.split(/[,\n।;]+/).filter(c=>c.trim()).flatMap(chunk=>{
  const whole=segment(chunk);if(whole.every(l=>l.product_id&&l.quantity>0))return whole;
  // Protect conjunctions inside known catalogue names, such as a pen-and-diary set.
  const tokens=chunk.trim().split(/\s+/);const protectedCuts=new Set<number>();
  for(let start=0;start<tokens.length;start++)for(let end=start+1;end<=tokens.length;end++){
   const phrase=productWords(tokens.slice(start,end).join(' '));
   if(namedProducts.some(p=>p.names.includes(phrase)))for(let i=start;i<end;i++)protectedCuts.add(i);
  }
  const parts:string[]=[];let start=0;
  tokens.forEach((token,i)=>{if(/^(और|and|फिर|plus|प्लस)$/i.test(token)&&!protectedCuts.has(i)){parts.push(tokens.slice(start,i).join(' '));start=i+1;}});
  parts.push(tokens.slice(start).join(' '));return parts.filter(p=>p.trim()).flatMap(segment);
 });
}
export function saleTotal(lines: SalesLine[]) { return lines.reduce((total,l)=>total+Math.round(l.unit_price*100)*l.quantity,0)/100; }
