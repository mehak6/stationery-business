import {parseVoiceSale,saleTotal} from '../lib/voice-sales';
import {hindiName,suggestedHindiAliases} from '../lib/hindi-products';
const products=[{id:'pen',name:'Blue pen',voice_aliases:['नीले पेन'],selling_price:10.25},{id:'book',name:'Classmate 200',voice_aliases:['कॉपी'],selling_price:50}];
describe('voice draft review',()=>{
 it('matches Hindi quantities without using the numeric product variant as quantity',()=>{expect(parseVoiceSale('दो नीले पेन और तीन Classmate 200',products)).toMatchObject([{product_id:'pen',quantity:2},{product_id:'book',quantity:3}])});
 it('does not choose between ambiguous aliases',()=>{expect(parseVoiceSale('दो नीले पेन',[...products,{...products[0],id:'another'}])[0].product_id).toBe('')});
 it('leaves pack and spoken price interpretations for manual review',()=>{for(const text of ['दो बॉक्स नीले पेन','नीले पेन','दो नीले पेन दस रुपये'])expect(parseVoiceSale(text,products)[0].quantity).toBe(0)});
 it('does not match an alias inside another product word',()=>{expect(parseVoiceSale('two blue pencil',products)[0].product_id).toBe('')});
 it('uses integer paise in draft totals',()=>{expect(saleTotal([{product_id:'pen',quantity:3,unit_price:0.1}])).toBe(0.3)});
});
describe('multiple products in a spoken order',()=>{
 const p=[{id:'pencil',name:'PENCIL',selling_price:10,voice_aliases:[]},{id:'pen',name:'PENS',selling_price:20,voice_aliases:[]},{id:'eraser',name:'ERASER',selling_price:5,voice_aliases:[]},{id:'diary',name:'DIARY @30',selling_price:30,voice_aliases:[]},{id:'set',name:'PEN & DIARY ',selling_price:90,voice_aliases:[]}];
 it.each(['दो पेंसिल तीन पेन एक रबड़','दो पेंसिल और तीन पेन और एक रबड़','दो पेंसिल, तीन पेन; एक रबड़','दो पेंसिल फिर तीन पेन प्लस एक रबड़','पेंसिल दो पेन तीन रबड़ एक'])('creates separate rows: %s',text=>expect(parseVoiceSale(text,p)).toMatchObject([{product_id:'pencil',quantity:2},{product_id:'pen',quantity:3},{product_id:'eraser',quantity:1}]));
 it('keeps quantity distinct from a spoken price variant',()=>expect(parseVoiceSale('दो तीस वाली डायरी तीन पेंसिल',p)).toMatchObject([{product_id:'diary',quantity:2},{product_id:'pencil',quantity:3}]));
 it('protects conjunctions inside a product name',()=>expect(parseVoiceSale('दो पेन और डायरी सेट और तीन पेंसिल',p)).toMatchObject([{product_id:'set',quantity:2},{product_id:'pencil',quantity:3}]));
 it('retains unknown clauses for correction',()=>expect(parseVoiceSale('दो पेंसिल और तीन अनजान सामान और एक रबड़',p)).toMatchObject([{product_id:'pencil',quantity:2},{product_id:'',quantity:3},{product_id:'eraser',quantity:1}]));
 it('keeps an unknown product as a separate row with its quantity',()=>expect(parseVoiceSale('दो पेंसिल तीन अनजान सामान',p)).toMatchObject([{product_id:'pencil',quantity:2},{product_id:'',quantity:3,heard:'तीन अनजान सामान'}]));
 it('does not choose duplicate Hindi names',()=>expect(parseVoiceSale('दो तीस वाली डायरी',[...p,{...p[3],id:'duplicate'}])[0].product_id).toBe(''));
 it('retains both identical products in an order',()=>expect(parseVoiceSale('दो पेंसिल तीन पेंसिल',p)).toMatchObject([{product_id:'pencil',quantity:2},{product_id:'pencil',quantity:3}]));
 it('provides Hindi labels and price-specific aliases',()=>{expect(hindiName(p[0])).toBe('पेंसिल');expect(suggestedHindiAliases('DIARY @30')).toContain('30 वाली डायरी')});
});
describe('uncertain products keep their own quantities',()=>{
 const p=[{id:'clay',name:'BELAN CLAY',voice_aliases:[],selling_price:100},{id:'pen',name:'PENS',voice_aliases:[],selling_price:20},{id:'diary1',name:'DIARY @60',voice_aliases:[],selling_price:60},{id:'diary2',name:'DIARY @60 ',voice_aliases:[],selling_price:60}];
 it('reproduces the exact phone transcript as two rows',()=>expect(parseVoiceSale('बेलन के लिए एक पीस पेन दो पीस',p)).toMatchObject([{product_id:'',quantity:1,heard:'बेलन के लिए एक पीस',suggested_ids:['clay']},{product_id:'pen',quantity:2,heard:'पेन दो पीस'}]));
 it.each(['बेलन एक पेन दो','एक बेलन दो पेन','एक पीस बेलन दो पीस पेन'])('splits an uncertain name: %s',text=>expect(parseVoiceSale(text,p)).toMatchObject([{product_id:'',quantity:1},{product_id:'pen',quantity:2}]));
 it('retains a duplicate numeric product count',()=>expect(parseVoiceSale('दो डायरी 60',p)).toMatchObject([{product_id:'',quantity:2}]));
 it('keeps the second item when the first name is duplicated',()=>expect(parseVoiceSale('दो डायरी 60 तीन पेन',p)).toMatchObject([{product_id:'',quantity:2},{product_id:'pen',quantity:3}]));
 it('does not turn a price into an item or drop it',()=>expect(parseVoiceSale('दो पेन दस रुपये',p)).toMatchObject([{product_id:'',quantity:0}]));
 it('does not drop a trailing unknown word',()=>expect(parseVoiceSale('बेलन एक पेन दो बाकी',p)).toHaveLength(1));
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
