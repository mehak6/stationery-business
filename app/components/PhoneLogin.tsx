'use client';
import {useState} from 'react';
import {supabase} from '../../supabase_client';
import {staffLoginEmail} from '../../lib/phone';
export default function PhoneLogin(){
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <form className="space-y-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{
 const {error}=await supabase.auth.signInWithPassword({email:staffLoginEmail(phone),password});
 if(error)throw Error('Mobile number or password is incorrect, or your account is not ready. Ask the admin for help.');
 setPassword('');
 }catch(e:any){setMessage(e.message)}finally{setBusy(false)}}}>
 <label className="block text-sm font-medium">Mobile number<input aria-label="Staff mobile number" className="block border rounded-xl p-3 w-full mt-2" type="tel" autoComplete="tel" required disabled={busy} placeholder="10-digit mobile number" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label className="block text-sm font-medium">Password<input aria-label="Staff password" className="block border rounded-xl p-3 w-full mt-2" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy} className="w-full bg-emerald-800 text-white px-4 py-3 rounded-xl">{busy?'Signing in…':'Open Bol Bahi'}</button>
 {message&&<p role="alert" className="text-sm text-red-700">{message}</p>}
 <p className="text-xs text-slate-500">Use the account created by your shop admin. No SMS or OTP needed.</p></form>;
}
