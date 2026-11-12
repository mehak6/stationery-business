'use client';
import {useState} from 'react';
import {SalesProduct, productSuggestions, productWords} from '../../lib/voice-sales';
import {productLabel} from '../../lib/hindi-products';
export default function ProductPicker({products,value,onChange,index,suggestions=[]}:{products:SalesProduct[];value:string;onChange:(p:SalesProduct)=>void;index:number;suggestions?:string[]}){
 const [search,setSearch]=useState('');
 const direct=search.trim()?products.filter(p=>productWords(productLabel(p)+' '+(p.voice_aliases||[]).join(' ')).includes(productWords(search))):products;
 const listed=direct.length?direct:productSuggestions(search,products);
 const selected=products.find(p=>p.id===value);
 const suggested=suggestions.map(id=>products.find(p=>p.id===id)).filter((p):p is SalesProduct=>!!p);
 const cards=(search.trim()?listed:suggested.length?suggested:products).slice(0,8);
 const choices=selected&&!listed.some(p=>p.id===value)?[selected,...listed]:listed;
 return <div className="col-span-12 md:col-span-6 text-xs">
 <label>Find product<input aria-label={'Find product '+index} className="block w-full mt-2 border rounded-xl p-3 text-sm" placeholder="Search English / हिंदी…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 {!value&&cards.length>0&&<div className="my-3"><p className="text-amber-800 mb-2">{search.trim()?'Search results — choose your product:':suggested.length?'Possible matches — choose the exact product:':'No close match. Browse products below or search by name:'}</p><div className="flex flex-wrap gap-2">{cards.map(p=><button type="button" key={p.id} onClick={()=>onChange(p)} className="text-left rounded-lg border border-emerald-200 bg-emerald-50 p-2">{productLabel(p)} · ₹{p.selling_price}</button>)}</div></div>}
 <label className="block mt-3">Product<select aria-label={'Product '+index} className="w-full mt-2 rounded-xl border bg-white p-3 text-sm" value={value} onChange={e=>{const p=products.find(p=>p.id===e.target.value);if(p)onChange(p)}}><option value="">Choose exact product</option>{choices.map(p=><option key={p.id} value={p.id}>{productLabel(p)} · ₹{p.selling_price}</option>)}</select></label>
 {!choices.length&&<p className="mt-2 text-amber-800">No matching name. Clear the search to browse all products, or try a shorter Hindi / English name.</p>}
 </div>;
}
