import translations from './hindi-product-names.json';
type NamedProduct = {name:string;voice_aliases?:string[]};
export const catalogueKey=(name:string)=>name.trim().replace(/\s+/g,' ').toUpperCase();
export function hindiName(p:NamedProduct):string {
 return p.voice_aliases?.find(a=>/[\u0900-\u097f]/.test(a)) || (translations as Record<string,string>)[catalogueKey(p.name)] || '';
}
export function productLabel(p:NamedProduct):string {const hi=hindiName(p);return hi?`${hi} · ${p.name}`:p.name;}
export function suggestedHindiAliases(name:string):string[]{
 const hi=(translations as Record<string,string>)[catalogueKey(name)];if(!hi)return [];
 const aliases=[hi];
 const price=name.match(/@\s*(\d+)/)?.[1];
 if(price){const base=hi.replace(new RegExp('\\b'+price+'\\b'),'').replace(/\s+/g,' ').trim();aliases.push(`${price} वाली ${base}`,`${price} रुपये वाली ${base}`,`${price} वाला ${base}`,`${price} रुपये वाला ${base}`);}
 return aliases;
}
