import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import VoiceSales from '../app/components/VoiceSales';
import {supabase} from '../supabase_client';
import {isNativeAndroid,nativeSpeechAvailable,captureNativeSpeech} from '../lib/native-speech';
jest.mock('../app/context/AuthContext',()=>({useAuth:()=>({role:'salesperson',signOut:jest.fn()})}));
jest.mock('../supabase_client',()=>({supabase:{rpc:jest.fn()}}));
jest.mock('../lib/native-speech',()=>({isNativeAndroid:jest.fn(()=>false),nativeSpeechAvailable:jest.fn(),captureNativeSpeech:jest.fn(),stopNativeSpeech:jest.fn()}));
it('choosing the unclear first product preserves its count and the second row',async()=>{
 const products=[{id:'clay',name:'BELAN CLAY',voice_aliases:[],selling_price:100},{id:'pen',name:'PENS',voice_aliases:[],selling_price:20}];
 (supabase.rpc as jest.Mock).mockImplementation(async(name:string)=>({data:name==='staff_catalogue'?products:{receipts:[],total:0,date:'2026-11-11'},error:null}));
 render(<VoiceSales/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Add item'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Spoken or typed order'),{target:{value:'बेलन के लिए एक पीस पेन दो पीस'}});
 await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
 expect(screen.getAllByRole('combobox')).toHaveLength(2);
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(1);
 expect(screen.getByLabelText('Quantity 2')).toHaveValue(2);
 expect(screen.getByLabelText('Product 2')).toHaveValue('pen');
 fireEvent.click(screen.getByRole('button',{name:/बेलन क्ले · BELAN CLAY/}));
 expect(screen.getByLabelText('Product 1')).toHaveValue('clay');
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(1);
 expect(screen.getByLabelText('Product 2')).toHaveValue('pen');
 expect(screen.getByLabelText('Quantity 2')).toHaveValue(2);
 expect(screen.getByRole('button',{name:'Confirm & save'})).toBeEnabled();
 expect((supabase.rpc as jest.Mock).mock.calls.some(([name])=>name==='staff_save_sale')).toBe(false);
});

it('automatically rebuilds changed text and preserves manual quantity edits until then',async()=>{
 (supabase.rpc as jest.Mock).mockClear();
 (supabase.rpc as jest.Mock).mockImplementation(async(name:string)=>({data:name==='staff_catalogue'?[{id:'pen',name:'PENS',voice_aliases:[],selling_price:20}]:{receipts:[],total:0,date:'2026-11-12'},error:null}));

 render(<VoiceSales/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Add item'})).toBeEnabled());
 const text=screen.getByLabelText('Spoken or typed order');
 fireEvent.change(text,{target:{value:'दो पेन'}});
 await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
 fireEvent.change(screen.getByLabelText('Quantity 1'),{target:{value:'4'}});
 expect(screen.getByRole('button',{name:'Confirm & save'})).toBeEnabled();
 fireEvent.change(text,{target:{value:'तीन पेन'}});
 expect(screen.getByRole('alert')).toHaveTextContent('Updating review items');
 expect(screen.getByRole('button',{name:'Confirm & save'})).toBeDisabled();
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(4);
 await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(3);
 expect(screen.getByRole('button',{name:'Confirm & save'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Quantity 1'),{target:{value:''}});
 expect(screen.getByText('Quantity unclear — enter the number of pieces.')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Confirm & save'})).toBeDisabled();
 expect((supabase.rpc as jest.Mock).mock.calls.some(([name])=>name==='staff_save_sale')).toBe(false);

});

it('shows browsable product buttons when speech has no matching name',async()=>{
 (supabase.rpc as jest.Mock).mockImplementation(async(name:string)=>({data:name==='staff_catalogue'?[{id:'clay',name:'BELAN CLAY',voice_aliases:[],selling_price:100},{id:'pen',name:'PENS',voice_aliases:[],selling_price:20}]:{receipts:[],total:0,date:'2026-11-12'},error:null}));
 render(<VoiceSales/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Add item'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Spoken or typed order'),{target:{value:'अज्ञातवस्तु तीन'}});
 await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
 expect(screen.getByText(/No close match. Browse products/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/बेलन क्ले · BELAN CLAY/}));
 expect(screen.getByLabelText('Product 1')).toHaveValue('clay');
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(3);
});

it('moves finished speech directly to review and adds later speech without restoring removed rows',async()=>{
 (isNativeAndroid as jest.Mock).mockReturnValue(true);
 (nativeSpeechAvailable as jest.Mock).mockResolvedValue(true);
 (captureNativeSpeech as jest.Mock).mockResolvedValueOnce('दो पेन').mockResolvedValueOnce('एक बेलन क्ले').mockResolvedValueOnce('तीन पेन');
 (supabase.rpc as jest.Mock).mockClear();
 (supabase.rpc as jest.Mock).mockImplementation(async(name:string)=>({data:name==='staff_catalogue'?[{id:'clay',name:'BELAN CLAY',voice_aliases:[],selling_price:100},{id:'pen',name:'PENS',voice_aliases:[],selling_price:20}]:{receipts:[],total:0,date:'2026-11-12'},error:null}));
 render(<VoiceSales/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Start voice recording'})).toBeEnabled());
 expect(screen.queryByRole('button',{name:'Prepare draft'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Start voice recording'}));
 await waitFor(()=>expect(screen.getByLabelText('Quantity 1')).toHaveValue(2));
 fireEvent.change(screen.getByLabelText('Quantity 1'),{target:{value:'4'}});
 fireEvent.click(screen.getByRole('button',{name:'Start voice recording'}));
 await waitFor(()=>expect(screen.getAllByRole('combobox')).toHaveLength(2));
 expect(screen.getByLabelText('Quantity 1')).toHaveValue(4);
 expect(screen.getByLabelText('Quantity 2')).toHaveValue(1);
 fireEvent.click(screen.getByRole('button',{name:'Remove item 1'}));
 fireEvent.click(screen.getByRole('button',{name:'Start voice recording'}));
 await waitFor(()=>expect(screen.getAllByRole('combobox')).toHaveLength(2));
 expect(screen.getByLabelText('Product 1')).toHaveValue('clay');
 expect(screen.getByLabelText('Quantity 2')).toHaveValue(3);
 expect((supabase.rpc as jest.Mock).mock.calls.some(([name])=>name==='staff_save_sale')).toBe(false);
 (isNativeAndroid as jest.Mock).mockReturnValue(false);
});
