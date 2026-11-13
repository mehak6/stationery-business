'use client';
import {useState} from 'react';
import {useAuth} from '../context/AuthContext';
import PhoneLogin from './PhoneLogin';
export default function AuthScreen(){
 const {signIn}=useAuth();
 const [mode,setMode]=useState<'staff'|'admin'|'email'>('staff');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <main className="min-h-screen bg-[#f4f6f1] px-5 py-12 flex items-center justify-center"><section className="w-full max-w-md">
 <header className="mb-8 text-center"><p className="text-4xl font-bold text-emerald-900">बोल बही</p><h1 className="mt-2 text-2xl font-semibold">Bol Bahi</h1><p className="text-slate-500 mt-3">बोलिए, जाँचिए, बिक्री लिखिए</p></header>
 <div className="bg-white border rounded-2xl p-6 shadow-sm"><h2 className="text-xl font-semibold mb-2">{mode==='staff'?'Staff login':mode==='admin'?'Admin login':'Staff email login'}</h2><p className="text-sm text-slate-500 mb-6">{mode==='admin'?'Only an authorised admin can open business details.':'Record sales and review your entries.'}</p>
 {mode==='staff'?<PhoneLogin/>:<form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const {error}=await signIn(email.trim(),password);if(error)throw error;setPassword('')}catch{setError('Unable to sign in. Check your email and password.')}finally{setBusy(false)}}}>
 <label className="block text-sm">Email<input aria-label="Email address" className="block border rounded-xl p-3 w-full mt-2" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label className="block text-sm">Password<input aria-label="Password" className="block border rounded-xl p-3 w-full mt-2" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy} className="w-full rounded-xl bg-emerald-800 text-white p-3">{busy?'Signing in…':'Sign in'}</button>{error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}</form>}
 </div>
 <nav className="flex flex-wrap justify-center gap-5 mt-6 text-sm text-emerald-900">
 {mode!=='staff'&&<button onClick={()=>{setMode('staff');setPassword('');setError('')}}>Staff mobile login</button>}
 {mode!=='admin'&&<button onClick={()=>{setMode('admin');setPassword('');setError('')}}>Admin login</button>}
 {mode==='staff'&&<button onClick={()=>{setMode('email');setPassword('');setError('')}}>Use existing staff email</button>}
 </nav></section></main>;
}
