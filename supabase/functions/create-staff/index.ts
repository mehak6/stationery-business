import { createClient } from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:identity,error:identityError}=await caller.auth.getUser();
  if(identityError||!identity.user)return reply({error:'Sign in required'},401);
  const {data:role,error:roleError}=await caller.rpc('get_app_access');
  if(roleError||role!=='admin')return reply({error:'Admin access required'},403);
  const {phone,password}=await req.json();
  if(typeof phone!=='string'||!/^\+[1-9]\d{7,14}$/.test(phone))return reply({error:'Use a valid mobile number with country code'},400);
  if(typeof password!=='string'||password.length<12||password.length>128)return reply({error:'Password must contain 12–128 characters'},400);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  // Admin-provisioned identifier, not proof of SMS ownership. Never use editable metadata as a role.
  const email=`staff.${phone.slice(1)}@bolbahi.invalid`;
  const {data,error}=await admin.auth.admin.createUser({email,phone,password,email_confirm:true,phone_confirm:true});
  if(error||!data.user)return reply({error:'Could not create account. The number may already be registered or the password may not meet requirements.'},400);
  const {error:approvalError}=await caller.rpc('admin_set_salesperson',{p_user_id:data.user.id,p_enabled:true});
  if(approvalError)return reply({warning:'Account created but approval failed. Find the pending account below and approve it.'});
  return reply({ok:true});
 }catch{return reply({error:'Request could not be processed'},400)}
});
