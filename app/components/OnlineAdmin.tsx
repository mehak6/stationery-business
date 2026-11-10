'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../supabase_client';
import {indiaDay} from '../../lib/voice-sales';
import StaffAccess from './StaffAccess';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n);
export default function OnlineAdmin(){
 const [tab,setTab]=useState('sales'),[day,setDay]=useState(indiaDay()),[products,setProducts]=useState<any[]>([]),[sales,setSales]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[search,setSearch]=useState('');
 const generation=useRef(0);
 async function load(){
  const request=++generation.current;setBusy(true);setError('');setProducts([]);setSales([]);
  try{
   const inventory:any[]=[];const entries:any[]=[];
   for(let start=0;;start+=500){const {data,error}=await supabase.from('products').select('id,name,stock_quantity,purchase_price,selling_price,min_stock_level,supplier_info').order('id').range(start,start+499);if(error)throw error;inventory.push(...(data||[]));if(!data||data.length<500)break}
   for(let start=0;;start+=500){const {data,error}=await supabase.from('sales').select('id,product_id,quantity,unit_price,total_amount,profit,sale_date,created_at').eq('sale_date',day).order('id').range(start,start+499);if(error)throw error;entries.push(...(data||[]));if(!data||data.length<500)break}
   if(request===generation.current){setProducts(inventory);setSales(entries)}
  }catch{if(request===generation.current)setError('Unable to load live business details. Check your connection and try again.')}finally{if(request===generation.current)setBusy(false)}
 }
 useEffect(()=>{void load();return()=>{generation.current++}},[day]);
 const total=sales.reduce((n,s)=>n+Number(s.total_amount),0),profit=sales.reduce((n,s)=>n+Number(s.profit),0);
 const names=new Map(products.map(p=>[p.id,p.name]));
 return <main className="max-w-5xl mx-auto p-5"><h1 className="text-2xl font-bold text-emerald-950">Admin dashboard</h1><p className="text-sm text-slate-500 mt-2">Live business details · visible only to the admin</p>
 <nav className="flex gap-2 my-5 flex-wrap">{['sales','stock','staff'].map(t=><button key={t} onClick={()=>setTab(t)} className={'px-5 py-3 rounded-xl capitalize '+(tab===t?'bg-emerald-800 text-white':'bg-white border')}>{t}</button>)}</nav>
 {tab==='staff'?<StaffAccess/>:<><div className="flex gap-3 items-end flex-wrap mb-5"><label className="text-sm">Sales date<input aria-label="Sales date" type="date" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value)}} className="block border p-3 rounded-xl mt-1"/></label><button onClick={load} disabled={busy} className="border rounded-xl p-3">Refresh</button></div>
 {error&&<p role="alert" className="p-4 bg-red-50 text-red-800 rounded-xl">{error}</p>}
 {busy?<p role="status">Loading live details…</p>:!error&&<>{tab==='sales'?<><div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-white p-5 border rounded-xl"><p className="text-sm">Sales total</p><strong className="text-xl">{money(total)}</strong></div><div className="bg-white p-5 border rounded-xl"><p className="text-sm">Profit</p><strong className="text-xl">{money(profit)}</strong></div></div>
 <h2 className="font-semibold mb-4">{sales.length} sale lines · {day}</h2>{sales.map(s=><article key={s.id} className="bg-white p-4 border rounded-xl mb-3"><strong>{names.get(s.product_id)||'Removed product'}</strong><p>{s.quantity} × {money(Number(s.unit_price))} = {money(Number(s.total_amount))}</p></article>)}{!sales.length&&<p>No sales recorded on this date.</p>}</>:
 <><label className="block mb-4">Find stock<input className="block w-full p-3 border rounded-xl mt-2" value={search} onChange={e=>setSearch(e.target.value)}/></label><p className="mb-4">{products.length} products · Stock cost {money(products.reduce((n,p)=>n+Number(p.purchase_price)*Number(p.stock_quantity),0))}</p>{products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><article key={p.id} className="bg-white border rounded-xl p-4 mb-3"><strong>{p.name}</strong><p className="mt-2">Stock: {p.stock_quantity} · Minimum: {p.min_stock_level}</p><p>Cost: {money(Number(p.purchase_price))} · Selling: {money(Number(p.selling_price))}</p>{p.supplier_info&&<p className="text-sm mt-2 break-words">Supplier: {typeof p.supplier_info==='string'?p.supplier_info:JSON.stringify(p.supplier_info)}</p>}</article>)}</>}</>}</>}
 <p className="mt-8 text-xs text-slate-500">This dashboard loads online and does not save inventory for offline access. Use Inventory Pro on your admin device for stock management, ledger, purchases, and exports.</p></main>;
}
