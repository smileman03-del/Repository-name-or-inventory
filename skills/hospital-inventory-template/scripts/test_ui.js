const {chromium}=require('playwright'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8')
  .replace('"SCRIPT_URL_HERE"','"https://mock.local/exec"');
const sample={items:[
 {id:'a1',dept:'수술실',cat:'소모품',name:'멸균장갑 7.0',spec:'Box',par:10,stock:4,memo:''},
 {id:'a2',dept:'처치실',cat:'소모품',name:'일회용 주사기 5cc',spec:'Box',par:8,stock:2,memo:''},
 {id:'a3',dept:'병동',cat:'보조기',name:'무릎 보조기 M',spec:'EA',par:5,stock:5,memo:''}],audits:{'수술실':'2026-10-20'},requests:[]};
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:800}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await p.route('https://mock.local/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({success:true,data:sample})}));
 await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(800);
 const text=await p.innerText('body');
 console.log('연결상태:',await p.innerText('#syncText'));
 for(const n of ['멸균장갑 7.0','일회용 주사기 5cc','무릎 보조기 M']) console.log(n, text.includes(n)?'표시 OK':'표시 안 됨!');
 const banned=process.argv.slice(4); const left=banned.filter(w=>(text+html).includes(w)); console.log('병원명 잔존:', left.length?left:'없음 OK'); if(left.length) process.exitCode=1;
 console.log('콘솔/페이지 오류:', errs.length?errs:'없음 OK'); if(errs.length) process.exitCode=1;
 if(await p.innerText('#syncText')!=='연결됨') process.exitCode=1;
 await p.screenshot({path:process.argv[3]||'ui.png'}); await b.close();
})();
