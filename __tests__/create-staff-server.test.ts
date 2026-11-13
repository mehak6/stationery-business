/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function server(role='admin') {
 let handler: (req: Request)=>Promise<Response>;
 const createUser=jest.fn().mockResolvedValue({data:{user:{id:'new-staff'}},error:null});
 const rpc=jest.fn(async (name:string)=>({data:name==='get_app_access'?role:null,error:null}));
 const caller={auth:{getUser:jest.fn().mockResolvedValue({data:{user:{id:'caller'}},error:null})},rpc};
 const createClient=jest.fn((_url:string,key:string)=>key==='service'?{auth:{admin:{createUser}}}:caller);
 const source=fs.readFileSync(path.join(process.cwd(),'supabase/functions/create-staff/index.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports:{},require:()=>({createClient}),Response,Request,JSON,Deno:{env:{get:(key:string)=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':'public'},serve:(fn:typeof handler)=>{handler=fn}}});
 return {invoke:(body:any,auth=true)=>handler(new Request('https://test.invalid',{method:'POST',headers:auth?{Authorization:'Bearer test'}:{},body:JSON.stringify(body)})),createUser,rpc,createClient};
}
it('rejects anonymous calls before creating an account',async()=>{const s=server();expect((await s.invoke({},false)).status).toBe(401);expect(s.createUser).not.toHaveBeenCalled()});
it.each(['salesperson','pending'])('rejects %s callers before creating an account',async role=>{const s=server(role);expect((await s.invoke({})).status).toBe(403);expect(s.createUser).not.toHaveBeenCalled()});
it('rejects weak passwords without creating an account',async()=>{const s=server();expect((await s.invoke({phone:'+919999999999',password:'short'})).status).toBe(400);expect(s.createUser).not.toHaveBeenCalled()});
it('creates a no-SMS identifier and approves only the returned new user',async()=>{const s=server();const response=await s.invoke({phone:'+919999999999',password:'Test-only-password-123'});expect(response.status).toBe(200);expect(s.createUser).toHaveBeenCalledWith(expect.objectContaining({email:'staff.919999999999@bolbahi.invalid',phone:'+919999999999',email_confirm:true}));expect(s.rpc).toHaveBeenCalledWith('admin_set_salesperson',{p_user_id:'new-staff',p_enabled:true})});
