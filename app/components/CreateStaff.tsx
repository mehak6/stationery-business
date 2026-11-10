'use client';
import {useState} from 'react';
import {supabase} from '../../supabase_client';
import {normalizePhone} from '../../lib/phone';
export default function CreateStaff({onCreated}:{onCreated:()=>void}){
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <form className="p-5 my-6 border rounded-2xl bg-white space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{
 const {data,error}=await supabase.functions.invoke('create-staff',{body:{phone:normalizePhone(phone),password}});
 if(error){const response=await error.context?.json?.().catch(()=>null);throw Error(response?.error||'Staff account could not be created. Check the connection and server setup.')}
 if(data?.error)throw Error(data.error);
 setPassword('');setPhone('');setMessage(data?.warning||'Staff account created and approved. Give the password to this salesperson privately.');onCreated();
 }catch(e:any){setMessage(e.message)}finally{setBusy(false)}}}>
 <h2 className="font-semibold text-lg">Create staff account</h2><p className="text-sm text-slate-500">Mobile number + password. You are approving this person; no SMS is sent.</p>
 <label className="block text-sm">Mobile number<input className="mt-2 block w-full border rounded-xl p-3" type="tel" autoComplete="off" required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label className="block text-sm">Initial password<input className="mt-2 block w-full border rounded-xl p-3" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <p className="text-xs text-slate-500">At least 12 characters. Use a different password for each person.</p>
 <button disabled={busy} className="bg-emerald-800 text-white px-4 py-3 rounded-xl">{busy?'Creating…':'Create and approve staff'}</button>
 {message&&<p role="status" className="text-sm">{message}</p>}</form>;
}
