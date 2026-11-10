import {parseVoiceSale,saleTotal} from '../lib/voice-sales';
const products=[{id:'pen',name:'Blue pen',voice_aliases:['नीले पेन'],selling_price:10.25},{id:'book',name:'Classmate 200',voice_aliases:['कॉपी'],selling_price:50}];
describe('voice draft review',()=>{
 it('matches Hindi quantities without using the numeric product variant as quantity',()=>{expect(parseVoiceSale('दो नीले पेन और तीन Classmate 200',products)).toMatchObject([{product_id:'pen',quantity:2},{product_id:'book',quantity:3}])});
 it('does not choose between ambiguous aliases',()=>{expect(parseVoiceSale('दो नीले पेन',[...products,{...products[0],id:'another'}])[0].product_id).toBe('')});
 it('leaves pack and spoken price interpretations for manual review',()=>{for(const text of ['दो बॉक्स नीले पेन','नीले पेन','दो नीले पेन दस रुपये'])expect(parseVoiceSale(text,products)[0].quantity).toBe(0)});
 it('does not match an alias inside another product word',()=>{expect(parseVoiceSale('two blue pencil',products)[0].product_id).toBe('')});
 it('uses integer paise in draft totals',()=>{expect(saleTotal([{product_id:'pen',quantity:3,unit_price:0.1}])).toBe(0.3)});
});
describe('bilingual catalogue matching',()=>{
 const catalogue=[{id:'pencil',name:'PENCIL',selling_price:20,voice_aliases:[]},{id:'pen',name:'PENS',selling_price:10,voice_aliases:[]},{id:'red',name:'RED PEN',selling_price:15,voice_aliases:[]}];
 it('recognises the exact phrase spoken on the S24',()=>expect(parseVoiceSale('दो पेंसिल',catalogue)[0]).toMatchObject({product_id:'pencil',quantity:2,unit_price:20}));
 it('recognises Hinglish and plural English names',()=>expect(parseVoiceSale('do pensil and three pens',catalogue)).toMatchObject([{product_id:'pencil',quantity:2},{product_id:'pen',quantity:3}]));
 it('does not silently ignore a colour qualifier',()=>expect(parseVoiceSale('दो नीले पेन',catalogue)[0]).toMatchObject({product_id:'',quantity:2}));
 it('matches a specific colour when the exact item exists',()=>expect(parseVoiceSale('तीन लाल पेन',catalogue)[0]).toMatchObject({product_id:'red',quantity:3}));
 it('asks for selection when the catalogue has only variants',()=>{const p=[{...catalogue[0],id:'a',name:'PENCIL HB'},{...catalogue[0],id:'b',name:'PENCIL 2B'}];expect(parseVoiceSale('दो पेंसिल',p)[0]).toMatchObject({product_id:'',quantity:2,suggested_ids:expect.arrayContaining(['a','b'])})});
 it('does not auto-select duplicate exact names',()=>expect(parseVoiceSale('दो पेंसिल',[catalogue[0],{...catalogue[0],id:'other'}])[0].product_id).toBe(''));
});
