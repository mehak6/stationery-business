'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase_client';
import VoiceAliases from './VoiceAliases';
import CreateStaff from './CreateStaff';
export default function StaffAccess() {
 const [accounts,setAccounts]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const {data,error}=await (supabase.rpc as any)('admin_staff_accounts');if(error)setError(error.message);else setAccounts(data||[]);}
 useEffect(()=>{void load()},[]);
 async function toggle(id:string,enabled:boolean){setBusy(true);setError('');const {error}=await (supabase.rpc as any)('admin_set_salesperson',{p_user_id:id,p_enabled:enabled});if(error)setError(error.message);else await load();setBusy(false)}
 return <section className="max-w-4xl mx-auto p-6"><h1 className="text-2xl font-bold">Salesperson access</h1><p className="my-4 text-gray-600">Create a mobile-number account with a password below. Approve only your staff. They receive sales entry, their own corrections for today, and today's shop sales total.</p><CreateStaff onCreated={load}/>{error&&<p role="alert" className="text-red-700">{error}</p>}<div className="space-y-3">{accounts.map(a=><div key={a.id} className="bg-white rounded-xl border p-4 flex justify-between items-center gap-4"><div><strong>{a.email||a.phone}</strong><p className="text-sm text-gray-500">{a.role==='admin'?'Administrator':a.enabled?'Salesperson · approved':a.verified?'Pending / disabled':'Awaiting verification'}</p></div>{a.role!=='admin'&&<button disabled={busy||!a.verified} onClick={()=>toggle(a.id,!a.enabled)} className="rounded-lg bg-primary-600 text-white px-4 py-2 disabled:opacity-40">{a.enabled?'Remove sales access':'Approve sales access'}</button>}</div>)}</div><VoiceAliases /></section>
}
