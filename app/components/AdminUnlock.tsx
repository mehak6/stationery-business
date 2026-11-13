'use client';
import {useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../../supabase_client';
export default function AdminUnlock({onUnlock}:{onUnlock:()=>void}){
 const {user,signIn}=useAuth();const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <main className="min-h-screen bg-[#f4f6f1] flex items-center justify-center p-5"><form className="max-w-md w-full p-6 bg-white border rounded-2xl space-y-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const {error}=await signIn(user?.email||'',password);if(error)throw error;const access=await (supabase.rpc as any)('get_app_access');if(access.error||access.data!=='admin')throw Error();setPassword('');onUnlock()}catch{setError('Admin verification failed. Check your password and connection.')}finally{setBusy(false)}}}>
 <h1 className="text-2xl font-bold text-emerald-900">Bol Bahi · Admin login</h1><p className="text-sm">Enter your admin password to view business details.</p><p className="text-sm break-all">{user?.email}</p><label className="block">Admin password<input aria-label="Admin password" className="block w-full border rounded-xl p-3 mt-2" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="bg-emerald-800 text-white rounded-xl p-3 w-full">{busy?'Checking…':'Open admin dashboard'}</button>{error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}<button type="button" className="block w-full text-center text-sm" onClick={()=>window.location.assign("/")}>Back to Bol Bahi</button></form></main>;
}
