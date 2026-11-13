import {parseVoiceSale,SalesProduct} from './voice-sales';
// Never silently replace the recogniser's first result with a different count/product.
export function speechOptions(matches:string[],products:SalesProduct[]):string[]{
 const options=[...new Set(matches.map(t=>t.trim()).filter(Boolean))].slice(0,3);
 if(options.length<2)return options;
 const signatures=options.map(text=>{const lines=parseVoiceSale(text,products);return lines.length&&lines.every(l=>l.product_id&&l.quantity>0)?JSON.stringify(lines.map(l=>[l.product_id,l.quantity])):null});
 return signatures[0]&&signatures.every(s=>s===signatures[0])?[options[0]]:options;
}
