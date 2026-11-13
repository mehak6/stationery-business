import {indiaDay,SalesLine} from './voice-sales';
export interface SavedDraft {text:string;preparedText:string|null;lines:SalesLine[];requestId:string|null;editing:{id:string;version:string;created_at:string}|null}
const key=(userId:string)=>`bolbahi:unfinished:${userId}`;
export function readDraft(storage:Storage,userId:string):SavedDraft|null {
 try{const raw=storage.getItem(key(userId));if(!raw)return null;const d=JSON.parse(raw);
  if(d.day!==indiaDay()||d.userId!==userId||!Array.isArray(d.lines)||d.lines.length>200||typeof d.text!=='string'||!(d.preparedText===null||typeof d.preparedText==='string'))return null;
  if(!d.lines.every((l:any)=>typeof l.product_id==='string'&&Number.isFinite(l.quantity)&&l.quantity>=0&&Number.isFinite(l.unit_price)&&l.unit_price>=0))return null;
  if(d.requestId!==null&&typeof d.requestId!=='string')return null;
  if(d.editing && !['id','version','created_at'].every(k=>typeof d.editing[k]==='string'))return null;
  return {text:d.text,preparedText:d.preparedText,lines:d.lines.map((l:any)=>({product_id:l.product_id,quantity:l.quantity,unit_price:l.unit_price,heard:typeof l.heard==='string'?l.heard:undefined})),requestId:d.requestId,editing:d.editing||null};
 }catch{return null;}
}
export function writeDraft(storage:Storage,userId:string,d:SavedDraft){
 if(!d.text&&!d.lines.length){storage.removeItem(key(userId));return;}
 storage.setItem(key(userId),JSON.stringify({userId,day:indiaDay(),text:d.text,preparedText:d.preparedText,requestId:d.requestId,editing:d.editing&&{id:d.editing.id,version:d.editing.version,created_at:d.editing.created_at},lines:d.lines.map(({product_id,quantity,unit_price,heard})=>({product_id,quantity,unit_price,heard}))}));
}
