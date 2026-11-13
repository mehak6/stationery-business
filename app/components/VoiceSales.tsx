'use client';
import { useEffect,useRef,useState } from 'react';
import { Capacitor } from '@capacitor/core';
import ProductPicker from './ProductPicker';
import { Mic,Square,Plus,Check,Trash2,LogOut,RefreshCw,Pencil } from 'lucide-react';
import { supabase } from '../../supabase_client';
import { useAuth } from '../context/AuthContext';
import { parseVoiceSale,saleTotal,SalesLine,SalesProduct } from '../../lib/voice-sales';
import { isNativeAndroid,nativeSpeechAvailable,captureNativeAlternatives,stopNativeSpeech } from '../../lib/native-speech';
import {readDraft,writeDraft} from '../../lib/sales-draft';
import {speechOptions} from '../../lib/speech-options';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n);
interface Receipt {id:string;created_at:string;version:string;lines:(SalesLine&{name:string;total_amount:number})[]}
export default function VoiceSales(){
 const {role,signOut,user}=useAuth();
 const [products,setProducts]=useState<SalesProduct[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]),[total,setTotal]=useState(0),[date,setDate]=useState('');
 const [text,setText]=useState(''),[lines,setLines]=useState<SalesLine[]>([]),[editing,setEditing]=useState<Receipt|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[canSpeak,setCanSpeak]=useState(false),[listening,setListening]=useState(false);
 const [draftReady,setDraftReady]=useState(false),[alternatives,setAlternatives]=useState<string[]>([]);
 const [preparedText,setPreparedText]=useState<string|null>(null);
 const staleDraft=alternatives.length>0 || (preparedText===null ? text.trim().length>0 : text!==preparedText);
 const speechReady=useRef(false);
 const reviewHeading=useRef<HTMLHeadingElement|null>(null);
 const needsReview=lines.filter(l=>!l.product_id||!Number.isInteger(l.quantity)||l.quantity<1||!Number.isFinite(l.unit_price)||l.unit_price<0).length;
 const speech=useRef<any>(null),requestId=useRef<string|null>(null),inFlight=useRef(false);
 useEffect(()=>{
  try{if(user?.id){const saved=readDraft(localStorage,user.id);if(saved){setText(saved.text);setLines(saved.lines);setPreparedText(saved.preparedText);requestId.current=saved.requestId;setEditing(saved.editing?{...saved.editing,lines:[]}:null);setMessage('अधूरी बिक्री वापस मिली — जाँचकर सेव करें। Unfinished order restored.');}}}catch{setMessage('Recovery is unavailable on this device.');}
  setDraftReady(true);
 },[user?.id]);
 useEffect(()=>{
  if(!draftReady||!user?.id)return;
  try{writeDraft(localStorage,user.id,{text,preparedText,lines,editing,requestId:requestId.current});}catch{setMessage('इस फोन पर ऑर्डर सुरक्षित नहीं हो सका। Keep the app open until saved.');}
 },[draftReady,user?.id,text,preparedText,lines,editing]);
 function acceptSpeech(heard:string){setAlternatives([]);speechReady.current=true;setText(t=>(t?t+' और ':'')+heard)}
 function reviewSpeech(matches:string[]){const options=speechOptions(matches,products);if(options.length>1)setAlternatives(options);else if(options[0])acceptSpeech(options[0]);else setMessage('आवाज़ साफ़ नहीं मिली। फिर बोलिए या टाइप करें।');}
 // Final speech updates immediately; typing waits briefly so rows do not jump per keystroke.
 useEffect(()=>{
  if(loading||busy||listening||!products.length||text===preparedText||(!text&&preparedText===null))return;
  const fromSpeech=speechReady.current;
  const delay=fromSpeech?0:400;
  const timer=setTimeout(()=>{
   speechReady.current=false;
   setLines(previous=>{
    if(preparedText && text.startsWith(preparedText+' और '))return [...previous,...parseVoiceSale(text.slice(preparedText.length+4),products)];
    const available=[...previous];
    const parsed=parseVoiceSale(text,products).map(line=>{const i=available.findIndex(old=>old.heard===line.heard);return i<0?line:available.splice(i,1)[0]});
    return [...parsed,...available.filter(line=>!line.heard)];
   });
   setPreparedText(text);requestId.current=null;setMessage('');
   if(fromSpeech)requestAnimationFrame(()=>reviewHeading.current?.scrollIntoView?.({behavior:'smooth',block:'start'}));
  },delay);
  return()=>clearTimeout(timer);
 },[text,preparedText,products,loading,busy,listening]);
 async function load(){
  setLoading(true);
  try{const [catalogue,summary]=await Promise.all([(supabase.rpc as any)('staff_catalogue'),(supabase.rpc as any)('staff_today')]);
   if(catalogue.error||summary.error)throw Error('Unable to load sales access. Check your connection or contact the admin.');
   setProducts(catalogue.data||[]);setReceipts(summary.data.receipts||[]);setTotal(Number(summary.data.total));setDate(summary.data.date);
  }catch(e:any){setProducts([]);setReceipts([]);setTotal(0);setMessage(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{let active=true;void load();if(isNativeAndroid()){void nativeSpeechAvailable().then(available=>{if(active)setCanSpeak(available)})}else{setCanSpeak(!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition))}return()=>{active=false;speech.current?.abort();if(isNativeAndroid())void stopNativeSpeech().catch(()=>{})}},[]);
 // Refresh totals when a counter left open overnight or backgrounded is resumed.
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void load()};document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh)},[]);
 async function mic(){
  if(alternatives.length)return;
  if(isNativeAndroid()){
   if(listening){await stopNativeSpeech().catch(()=>{});setListening(false);return}
   setListening(true);setMessage('');
   try{reviewSpeech(await captureNativeAlternatives())}
   catch(e:any){setMessage(e.message||'Voice could not be captured. Try again or type your order.')}
   finally{setListening(false)}
   return;
  }
  if(listening){speech.current?.stop();return}const R=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!R)return;const r=new R();speech.current=r;r.lang='hi-IN';r.interimResults=false;r.maxAlternatives=3;r.onresult=(e:any)=>reviewSpeech(Array.from(e.results[0],(r:any)=>r.transcript));r.onerror=()=>{setMessage('Voice could not be captured. Check microphone permission, or type your order.');setListening(false)};r.onend=()=>setListening(false);try{r.start();setListening(true)}catch{setMessage('Microphone could not start. Type or add an item instead.')}
 }
 function change(i:number,patch:Partial<SalesLine>){setLines(old=>old.map((l,j)=>j===i?{...l,...patch}:l));requestId.current=null}
 function clear(){setLines([]);setText('');setPreparedText(null);setAlternatives([]);setEditing(null);requestId.current=null;if(user?.id){try{writeDraft(localStorage,user.id,{text:'',preparedText:null,lines:[],editing:null,requestId:null})}catch{}}}
 async function save(){
  if(inFlight.current)return;
  if(staleDraft||listening){setMessage('Please wait for the review items to update.');return;}
  if(!lines.length||lines.some(l=>!l.product_id||!Number.isInteger(l.quantity)||l.quantity<1||!Number.isFinite(l.unit_price)||l.unit_price<0)){setMessage('Choose each exact product and a valid quantity and price.');return}
  inFlight.current=true;setBusy(true);setMessage('');requestId.current??=crypto.randomUUID();
  try{if(user?.id){try{writeDraft(localStorage,user.id,{text,preparedText,lines,editing,requestId:requestId.current})}catch{/* Online save still works if local storage is full. */}}const {error}=await (supabase.rpc as any)('staff_save_sale',{p_request_id:requestId.current,p_lines:lines.map(({product_id,quantity,unit_price})=>({product_id,quantity,unit_price})),p_receipt_id:editing?.id||null,p_expected_version:editing?.version||null});if(error)throw error;
   clear();setMessage('Sale saved. Inventory and daily totals updated.');await load();
  }catch(e:any){setMessage(e.message||'Save could not be confirmed. Keep this draft and retry; duplicate saves are prevented.')}finally{setBusy(false);inFlight.current=false}
 }
 const input='w-full mt-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none';
 return <div className="min-h-screen bg-[#f4f6f1] text-slate-800"><header className="border-b bg-white"><div className="max-w-5xl mx-auto px-5 py-5 flex justify-between items-center gap-4"><div><strong className="text-xl text-emerald-900">बोल बही <span className="text-sm font-normal ml-2">Sales counter</span></strong><p className="text-xs text-slate-500 mt-1">Daily sales register</p></div><div className="flex gap-3 items-center shrink-0">{role==='admin'&&<a href={Capacitor.isNativePlatform()?"/admin.html":"/admin"} className="text-sm text-emerald-800 whitespace-nowrap">Admin login</a>}<button onClick={signOut} className="flex items-center gap-2 text-sm whitespace-nowrap"><LogOut size={17}/> Sign out</button></div></div></header><main className="max-w-5xl mx-auto p-5 pb-36 md:p-8 md:pb-36"><div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center mb-7"><div><p className="text-emerald-700 text-sm mb-2">बोलिए, जाँचिए, सेव कीजिए</p><h1 className="text-3xl font-bold tracking-tight">बिक्री लिखें</h1><p className="text-slate-500 mt-2 text-sm">No customer details. Just the items you sold.</p></div><div className="bg-emerald-900 text-white rounded-2xl px-6 py-5 min-w-[150px]"><p className="text-xs opacity-75">आज की बिक्री</p><strong className="block text-2xl mt-2">{loading?'…':money(total)}</strong><small className="opacity-70">{date} · India</small></div></div>{message&&<div role="status" className="mb-5 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-sm">{message}</div>}<section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-7"><div className="flex justify-between items-center mb-5"><h2 className="font-semibold text-lg">{editing?'Correct sale':'New sale'}</h2><span className="text-xs text-slate-500">Review before saving</span></div><fieldset disabled={busy||loading} className="disabled:opacity-60"><div className="bg-emerald-50/60 border border-dashed border-emerald-200 rounded-xl p-6 text-center"><button type="button" disabled={!canSpeak||alternatives.length>0} onClick={mic} aria-label={listening?'Stop recording':'Start voice recording'} className={'rounded-full p-5 text-white shadow-lg disabled:opacity-40 '+(listening?'bg-red-600':'bg-emerald-800')}>{listening?<Square size={26}/>:<Mic size={26}/>}</button><p className="font-medium mt-4">{listening?'Listening… बोलिए':canSpeak?'Tap and say the product and quantity':'Type or select the items below'}</p><p className="text-xs text-slate-500 mt-2">Speak → Review items → Confirm & save. Example: “दो पेन और तीन पेंसिल”</p></div><label className="block mt-5 text-sm font-medium">बोला हुआ ऑर्डर<textarea aria-label="Spoken or typed order" className={input} rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Use the product name or its Hindi alias…"/></label><div className="flex justify-between items-center gap-4 mt-3"><p className="text-xs text-slate-500 max-w-sm">Speech uses the recognition service on your device. Check quantities, packs and prices yourself.</p><span className="text-sm font-medium text-emerald-800">Items appear automatically</span></div><div className="border-t my-6"/>{alternatives.length>0&&<div role="group" aria-label="Choose what you said" className="mb-4 p-4 bg-amber-50 border rounded-xl"><strong>आपने क्या बोला? सही वाक्य चुनें</strong><p className="text-sm my-2">नाम या मात्रा अलग सुनाई दी।</p>{alternatives.map(option=><button key={option} type="button" onClick={()=>acceptSpeech(option)} className="block w-full text-left bg-white border rounded-lg p-3 my-2">{option}</button>)}<button type="button" onClick={()=>setAlternatives([])} className="underline p-2">फिर बोलें / Cancel</button></div>}{staleDraft&&!alternatives.length&&<p role="alert" className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-900">Updating review items…</p>}{lines.length>0&&<p role="status" className="mb-4 text-sm">{lines.length} item rows · {needsReview?`${needsReview} need correction`:'All products and quantities selected — review before saving'}</p>}<div className="flex justify-between"><h3 ref={reviewHeading} className="font-semibold scroll-mt-4">सामान जाँचें · Review items</h3><button type="button" disabled={!canSpeak||alternatives.length>0} onClick={mic} className="text-sm text-emerald-800 border rounded-lg px-3 py-2">{listening?'रोकें':'और बोलिए'}</button><button type="button" aria-label="Add item" disabled={!products.length||alternatives.length>0} onClick={()=>{setLines([...lines,{product_id:'',quantity:1,unit_price:0}]);requestId.current=null}} className="flex gap-1 items-center text-sm text-emerald-800"><Plus size={16}/> सामान जोड़ें</button></div>{!products.length&&!loading&&<p className="py-8 text-center text-slate-500">No products available. Ask the admin to check inventory setup.</p>}{!lines.length&&products.length>0&&<p className="py-10 text-center text-slate-400 text-sm">Speak an order or add an item manually.</p>}{lines.map((l,i)=><div key={i} className="grid grid-cols-12 gap-2 md:gap-4 py-4 border-b">{l.heard&&<p className="col-span-12 text-sm font-medium text-slate-700">Item {i+1} · Heard: {l.heard}</p>}<p className="col-span-12 text-xs text-amber-800">{!l.product_id?'Choose the exact product. ':''}{!Number.isInteger(l.quantity)||l.quantity<1?'Quantity unclear — enter the number of pieces.':''}</p><ProductPicker products={products} value={l.product_id} index={i+1} suggestions={l.suggested_ids} onChange={p=>change(i,{product_id:p.id,unit_price:p.selling_price})}/><label className="col-span-5 md:col-span-2 text-xs">मात्रा<input aria-label={'Quantity '+(i+1)} className={input} type="number" min="1" step="1" value={l.quantity||''} placeholder="Enter quantity" onChange={e=>change(i,{quantity:Number(e.target.value)})}/><span className="flex gap-2 mt-2"><button type="button" aria-label={'Decrease quantity '+(i+1)} disabled={l.quantity<=1} onClick={()=>change(i,{quantity:l.quantity-1})} className="border rounded-lg px-5 py-2 text-lg">−</button><button type="button" aria-label={'Increase quantity '+(i+1)} onClick={()=>change(i,{quantity:l.quantity+1})} className="border rounded-lg px-5 py-2 text-lg">+</button></span></label><label className="col-span-5 md:col-span-3 text-xs">दर ₹<input aria-label={'Rate '+(i+1)} className={input} type="number" min="0" step="0.01" value={l.unit_price} onChange={e=>change(i,{unit_price:Number(e.target.value)})}/></label><button type="button" aria-label={'Remove item '+(i+1)} className="col-span-2 md:col-span-1 self-end mb-3 text-slate-400" onClick={()=>{setLines(lines.filter((_,j)=>j!==i));requestId.current=null}}><Trash2 size={18}/></button></div>)}<div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t shadow-lg px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex justify-between items-center gap-3"><div><p className="text-xs text-slate-500">कुल रकम</p><strong className="text-2xl">{money(saleTotal(lines))}</strong></div><div className="flex gap-2"><button type="button" aria-label="Speak from toolbar" disabled={!canSpeak||alternatives.length>0} onClick={mic} className="border rounded-xl px-3 py-2">{listening?'रोकें':'🎤 बोलिए'}</button>{editing&&<button type="button" onClick={clear} className="text-sm">Cancel edit</button>}<button type="button" aria-label={editing?'Save correction':'Confirm & save'} onClick={save} disabled={listening||staleDraft||!lines.length||needsReview>0} className="flex items-center gap-2 bg-emerald-800 text-white rounded-xl px-5 py-3 disabled:opacity-40"><Check size={18}/>{busy?'सेव हो रहा…':editing?'सुधार सेव करें':'बिक्री सेव करें'}</button></div></div></fieldset></section><section className="mt-7"><div className="flex justify-between items-center mb-4"><div><h2 className="text-lg font-semibold">{role==='admin'?'Today’s counter entries':'Your entries today'}</h2><p className="text-xs text-slate-500 mt-1">Correct a wrong product, quantity or selling rate.</p></div><button disabled={busy||loading} onClick={load} aria-label="Refresh sales"><RefreshCw size={18}/></button></div>{receipts.map(r=><article key={r.id} className="rounded-xl bg-white border border-slate-200 p-5 mb-3"><div className="flex justify-between mb-3"><span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}</span><strong>{money(saleTotal(r.lines))}</strong></div>{r.lines.map((l,i)=><p key={i} className="text-sm py-1">{l.name} · {l.quantity} × {money(l.unit_price)}</p>)}<button disabled={busy} onClick={()=>{if(lines.length&&!confirm('Replace the current draft to correct this sale?'))return;setEditing(r);setLines(r.lines.map(({product_id,quantity,unit_price})=>({product_id,quantity,unit_price})));setText('');setPreparedText(null);requestId.current=null;setMessage('Correct the items above, then save. Inventory will be adjusted automatically.');window.scrollTo({top:0,behavior:'smooth'})}} className="mt-3 inline-flex gap-2 items-center text-emerald-800 text-sm"><Pencil size={15}/> Correct entry</button></article>)}{!receipts.length&&!loading&&<p className="text-sm text-slate-400 py-8 text-center">Your saved entries will appear here.</p>}</section></main></div>
}
