'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../supabase_client';
import {hindiName,suggestedHindiAliases} from '../../lib/hindi-products';
type Item={id:string;name:string;voice_aliases:string[]};
export default function VoiceAliases(){
 const [items,setItems]=useState<Item[]>([]),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
 useEffect(()=>{(async()=>{const {data,error}=await (supabase.from('products') as any).select('id,name,voice_aliases').order('name');if(error)setMessage(error.message);else setItems(data||[])})()},[]);
 const filtered=items.filter(p=>(p.name+' '+hindiName(p)+' '+p.voice_aliases.join(' ')).toLowerCase().includes(search.toLowerCase()));
 return <section className="mt-6"><h2 className="text-xl font-bold">हिंदी उत्पाद नाम · Hindi names</h2>
 <p className="text-sm text-gray-600 my-3">{items.length} products. The first Hindi name is shown in the inventory and sales picker. Add other names staff say, separated by commas. Include the price variant or pack size where needed.</p>
 <input aria-label="Find product aliases" className="border rounded-lg p-3 w-full mb-3" placeholder="नाम या English name खोजें…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/>
 {message&&<p role="status" className="text-sm mb-3">{message}</p>}
 {filtered.slice(page*20,(page+1)*20).map(p=><form key={p.id} className="p-4 border rounded-xl bg-white mb-2" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setMessage('');
  const value=new FormData(e.currentTarget).get('aliases') as string;
  const aliases=[...new Set(value.split(',').map(s=>s.trim()).filter(Boolean))];
  try{const {error}=await (supabase.from('products') as any).update({voice_aliases:aliases,updated_at:new Date().toISOString()}).eq('id',p.id);if(error)throw error;
   setItems(old=>old.map(item=>item.id===p.id?{...item,voice_aliases:aliases}:item));setMessage('Names saved. Refresh the sales counter to use them.');
  }catch(e:any){setMessage(e.message||'Names could not be saved.')}finally{setBusy(false)}
 }}><h3 className="font-semibold">{hindiName(p)||'हिंदी नाम जोड़ें'}</h3><p className="text-sm text-gray-500 mb-3">{p.name}</p>
 <label className="text-sm">Spoken names / बोले जाने वाले नाम<input name="aliases" className="block border rounded-lg p-3 mt-2 w-full" defaultValue={(p.voice_aliases.length?p.voice_aliases:suggestedHindiAliases(p.name)).join(', ')} placeholder="पेंसिल, पेन्सिल"/></label>
 <button disabled={busy} className="mt-3 text-sm text-emerald-800 border rounded-lg px-4 py-2">Save names</button></form>)}
 <div className="flex justify-between items-center gap-3 py-4"><button disabled={page===0} onClick={()=>setPage(p=>p-1)} className="border rounded-lg p-3 disabled:opacity-40">Previous</button><span>{filtered.length?`${page*20+1}–${Math.min((page+1)*20,filtered.length)} of ${filtered.length}`:'No matches'}</span><button disabled={(page+1)*20>=filtered.length} onClick={()=>setPage(p=>p+1)} className="border rounded-lg p-3 disabled:opacity-40">Next</button></div>
 </section>;
}
