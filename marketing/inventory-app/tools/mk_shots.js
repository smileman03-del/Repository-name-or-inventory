// 판매 페이지용 원본 화면 촬영 (가상 예제 데이터만 사용, DPR 3)
const fs=require('fs');const {chromium}=require('playwright');const createEnv=require(process.argv[2]+'/gs_mock');
const PK=process.argv[3],OUT=process.argv[4];
const ymdKR=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);
const add=(s,k)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+k);return d.toISOString().slice(0,10)};
(async()=>{
 const env=createEnv(PK+'/Code.gs');env.run('loadSampleData()');const today=ymdKR(new Date());
 env.sheet('실사 기록').d=[env.sheet('실사 기록').d[0],[add(today,-20),'수술실',3,''],[add(today,-12),'처치실',2,''],[today,'병동',1,'']];
 const it=n=>env.get('getAll').data.items.find(i=>i.name===n);
 const mk=(dept,names)=>env.post({action:'requestCreate',dept,items:names.map(n=>{const i=it(n);return{id:i.id,name:i.name,spec:i.spec,dept:i.dept,cat:i.cat,stock:i.stock,par:i.par,qty:i.par-i.stock}})}).data.id;
 const r1=mk('전체',['멸균 수술장갑 7.0','일회용 주사기 5cc','봉합사 Vicryl 2-0','초음파 젤','탄력붕대 4인치']);
 env.post({action:'receiveSubmit',requestId:r1,items:[{id:it('멸균 수술장갑 7.0').id,qty:6},{id:it('초음파 젤').id,qty:4}],memo:'예시상사 납품'});
 mk('병동',['탄력붕대 4인치']);
 // 인쇄용: 부족 품목 전체를 한 장에
 const low=env.get('getAll').data.items.filter(i=>i.stock<i.par).map(i=>i.name);
 const html=fs.readFileSync(PK+'/index.html','utf8').replace('"SCRIPT_URL_HERE"','"https://mock.local/exec"');
 const b=await chromium.launch();
 async function page(scheme,orgHtml){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,timezoneId:'Asia/Seoul',colorScheme:scheme});
  await ctx.route('https://mock.local/**',async r=>{const q=r.request();r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:q.method()==='POST'?env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s:env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s})});
  const p=await ctx.newPage();p.on('dialog',d=>d.accept());await p.addInitScript(()=>{window.print=()=>{}});await p.setContent(orgHtml||html,{waitUntil:'load'});await p.waitForTimeout(1200);return p};
 const shot=async(p,n)=>{await p.waitForTimeout(800);await p.screenshot({path:`${OUT}/${n}.png`})};
 let p=await page('light');
 await shot(p,'01_dashboard');
 await p.click('#lowOnlyBtn');await p.evaluate(()=>window.scrollTo(0,455));await shot(p,'01b_dashboard_list');await p.evaluate(()=>window.scrollTo(0,0));await p.click('#lowOnlyBtn');
 await p.click('.nav-btn[data-screen=request]');await shot(p,'02_request');
 await p.click('.history-item');await shot(p,'03_request_modal');await p.click('#closeModal');
 await p.click('.nav-btn[data-screen=receive]');await shot(p,'04a_receive_list');
 await p.click('.pending-card >> nth=0');await shot(p,'04_receive_detail');
 await p.click('.seg-btn[data-mode=request]');await p.evaluate(()=>window.scrollTo(0,9999));await p.waitForTimeout(300);
 await p.click('.nav-btn[data-screen=audit]');await shot(p,'05_audit_select');
 await p.click('[data-d=처치실]');await p.locator('.stp-plus >> nth=0').click();await p.locator('.stp-plus >> nth=0').click();await p.locator('.stp-minus >> nth=3').click();await shot(p,'05b_audit_detail');
 await p.click('.nav-btn[data-screen=manage]');await shot(p,'06_manage');
 await p.close();
 p=await page('dark');await shot(p,'07_dark_dashboard');
 await p.click('.nav-btn[data-screen=request]');await shot(p,'07b_dark_request');await p.close();
 // 입고 취소 화면
 p=await page('light');await p.click('.nav-btn[data-screen=receive]');await p.waitForTimeout(300);
 await p.locator('.history-item[data-rcid]').first().click();await shot(p,'08_receipt_modal');await p.close();
 // A4 인쇄 미리보기(병원 이름은 가상)
 const org=html.replace('const ORG_NAME = "";','const ORG_NAME = "예시병원";');
 const e2=createEnv(PK+'/Code.gs');e2.run('loadSampleData()');
 const items=e2.get('getAll').data.items.filter(i=>i.stock<i.par);
 e2.post({action:'requestCreate',dept:'전체',items:items.map(i=>({id:i.id,name:i.name,spec:i.spec,dept:i.dept,cat:i.cat,stock:i.stock,par:i.par,qty:i.par-i.stock}))});
 const ctx2=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
 await ctx2.route('https://mock.local/**',async r=>{const q=r.request();r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:q.method()==='POST'?e2.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s:e2.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s})});
 const p2=await ctx2.newPage();await p2.addInitScript(()=>{window.print=()=>{}});await p2.setContent(org,{waitUntil:'load'});await p2.waitForTimeout(800);
 await p2.click('.nav-btn[data-screen=request]');await p2.waitForTimeout(300);await p2.click('.history-item');await p2.waitForTimeout(500);
 await p2.emulateMedia({media:'print'});await p2.pdf({path:OUT+'/print_a4.pdf',format:'A4',printBackground:true});
 await b.close();console.log('원본 촬영 완료');
})();
