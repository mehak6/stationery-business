import {parseVoiceSale,saleTotal} from '../lib/voice-sales';
const products=[{id:'pen',name:'Blue pen',voice_aliases:['नीले पेन'],selling_price:10.25},{id:'book',name:'Classmate 200',voice_aliases:['कॉपी'],selling_price:50}];
describe('voice draft review',()=>{
 it('matches Hindi quantities without using the numeric product variant as quantity',()=>{expect(parseVoiceSale('दो नीले पेन और तीन Classmate 200',products)).toMatchObject([{product_id:'pen',quantity:2},{product_id:'book',quantity:3}])});
 it('does not choose between ambiguous aliases',()=>{expect(parseVoiceSale('दो नीले पेन',[...products,{...products[0],id:'another'}])[0].product_id).toBe('')});
 it('leaves pack and spoken price interpretations for manual review',()=>{for(const text of ['दो बॉक्स नीले पेन','नीले पेन','दो नीले पेन दस रुपये'])expect(parseVoiceSale(text,products)[0].quantity).toBe(0)});
 it('does not match an alias inside another product word',()=>{expect(parseVoiceSale('two blue pencil',products)[0].product_id).toBe('')});
 it('uses integer paise in draft totals',()=>{expect(saleTotal([{product_id:'pen',quantity:3,unit_price:0.1}])).toBe(0.3)});
});
