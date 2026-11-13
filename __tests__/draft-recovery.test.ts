import {readDraft,writeDraft,SavedDraft} from '../lib/sales-draft';
import {speechOptions} from '../lib/speech-options';
import {parseVoiceSale} from '../lib/voice-sales';
const products=[{id:'pen',name:'PENS',voice_aliases:[],selling_price:20}];
beforeEach(()=>localStorage.clear());
it('recovers only the same staff account and preserves the retry ID',()=>{
 const d:SavedDraft={text:'दो पेन',preparedText:'दो पेन',lines:[{product_id:'pen',quantity:2,unit_price:20}],requestId:'retry-same-id',editing:null};
 writeDraft(localStorage,'alice',d);expect(readDraft(localStorage,'bob')).toBeNull();expect(readDraft(localStorage,'alice')).toEqual(d);
 writeDraft(localStorage,'alice',{...d,text:'',lines:[]});expect(readDraft(localStorage,'alice')).toBeNull();
});
it('rejects damaged and previous-day data',()=>{localStorage.setItem('bolbahi:unfinished:alice','{');expect(readDraft(localStorage,'alice')).toBeNull();localStorage.setItem('bolbahi:unfinished:alice',JSON.stringify({day:'2000-01-01',userId:'alice',lines:[],text:''}));expect(readDraft(localStorage,'alice')).toBeNull()});
it('asks when speech alternatives disagree on quantity',()=>expect(speechOptions(['दो पेन','तीन पेन'],products)).toEqual(['दो पेन','तीन पेन']));
it('collapses equivalent recognised orders',()=>expect(speechOptions(['दो पेन','2 pens'],products)).toEqual(['दो पेन']));
it.each([['दो सौ पेन',200],['दो सौ पच्चीस पेन',225],['twenty five pens',25]])('understands compound quantity %s',(text,n)=>expect(parseVoiceSale(text,products)[0]).toMatchObject({product_id:'pen',quantity:n}));
