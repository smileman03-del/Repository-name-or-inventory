const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(process.argv[2],'utf8');
class Range{constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
 setValues(v){for(let i=0;i<v.length;i++)for(let j=0;j<v[0].length;j++){(this.sh.d[this.r-1+i]=this.sh.d[this.r-1+i]||[])[this.c-1+j]=v[i][j]}return this}
 setValue(v){return this.setValues([[v]])} setFormula(f){return this.setValues([[f]])} setFontWeight(){return this}
 clearContent(){for(let i=0;i<this.nr;i++)for(let j=0;j<this.nc;j++){const row=this.sh.d[this.r-1+i];if(row)row[this.c-1+j]=''}return this}
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(((this.sh.d[this.r-1+i]||[])[this.c-1+j])??'');o.push(row)}return o}}
class Sheet{constructor(){this.d=[]}
 getLastRow(){for(let i=this.d.length;i>0;i--){if((this.d[i-1]||[]).some(x=>x!==''&&x!==undefined))return i}return 0}
 getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc)}
 appendRow(a){this.d[this.getLastRow()]=a} deleteRow(r){this.d.splice(r-1,1)} setFrozenRows(){}}
const sheets={}, alerts=[]; const ui={alert:m=>alerts.push(m),prompt:()=>({getSelectedButton:()=>1,getResponseText:()=>'테스트품목, 병동, EA, 10, 3'}),Button:{OK:1},ButtonSet:{OK_CANCEL:0},createMenu(t){this.t=t;return this},addItem(){this.n=(this.n||0)+1;return this},addSeparator(){return this},addToUi(){}};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet()}),getUi:()=>ui},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>require('crypto').randomUUID(),formatDate:(d,tz,f)=>{const s=d.toISOString();if(f==='yyyy-MM-dd')return s.slice(0,10);return pad(d.getUTCFullYear()%100)+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())}},
 Session:{getScriptTimeZone:()=>'Asia/Seoul'},ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:'json'}},JSON,Date,Math,String,parseInt,isNaN};
vm.createContext(ctx);vm.runInContext(code,ctx);
const run=s=>vm.runInContext(s,ctx);
const get=a=>JSON.parse(run(`doGet({parameter:{action:'${a}'}})`).s);
const post=p=>JSON.parse(run(`doPost({postData:{contents:${JSON.stringify(JSON.stringify(p))}}})`).s);
let n=0;const ok=m=>console.log(++n+' '+m+' OK');

run('onOpen()'); assert.strictEqual(ui.t,'🏥 재고관리'); assert.strictEqual(ui.n,6); ok('시트 메뉴 6개 항목 생성');
assert(get('getMaster').success===false); ok('탭이 없으면 친절한 오류(setupSheets 전)');
run('setupSheets()'); assert.deepStrictEqual(Object.keys(sheets),['품목 마스터','주간 재고 파악','실시간 재고 대장','물품 청구서']); ok('탭 4개 이름 정확');
run('loadSampleData()'); let m=get('getMaster').data; assert.strictEqual(m.length,8); assert(m.every(x=>typeof x.par==='number')); ok('샘플 8건, 숫자 변환');
assert.strictEqual(sheets['품목 마스터'].d[1][5].replace(/2/g,'#'),'=IF(E#="","",IF(E#<D#,"❌ 재고부족","✅ 안정"))'); ok('상태 수식이 행 번호에 맞게 입력됨');
let rt=get('getRealtime').data; assert.deepStrictEqual(rt.map(x=>x.name).sort(),['거즈 4x4','멸균장갑 7.0','수술용 드레이프','일회용 주사기 5cc','초음파 젤'].sort()); assert(rt.every(x=>x.lack===x.par-x.stock)); ok('실시간 대장 = 재고부족 5건, 부족수량 정확');
assert(post({action:'addItem',name:'멸균장갑 7.0',loc:'수술실'}).success===false); ok('중복 품목 거부');
assert(post({action:'addItem',name:'',loc:'x'}).success===false); ok('빈 품목명 거부');
assert(post({action:'addItem',name:'신규',loc:'병동',spec:'EA',par:10,stock:1}).success); assert.strictEqual(get('getRealtime').data.length,6); ok('품목 추가 → 실시간 대장 자동 갱신');
assert(post({action:'deleteItem',name:'신규'}).success); assert.strictEqual(get('getRealtime').data.length,5); assert(post({action:'deleteItem',name:'신규'}).success===false); ok('삭제 + 재삭제 거부 + 대장 갱신');
let r=post({action:'saveWeekly',date:'2026-11-02',rows:[{name:'거즈 4x4',qty:30},{name:'없는품목',qty:1}]});
assert(r.success&&r.data.saved===1); assert.strictEqual(get('getMaster').data.find(x=>x.name==='거즈 4x4').stock,30); assert.strictEqual(get('getWeekly').data.length,1); assert.strictEqual(get('getRealtime').data.length,4); ok('주간실사 저장: 마스터 갱신·기록 1건·없는 품목 무시·대장 갱신');
assert(post({action:'saveWeekly',rows:[]}).success===false); ok('빈 실사 거부');
r=post({action:'submitRequest',items:[{name:'멸균장갑 7.0',loc:'수술실',spec:'Box',qty:6},{name:'초음파 젤',loc:'물리치료실',spec:'병',qty:0}]});
assert(r.success&&r.data.count===2&&/^R\d{12}-[0-9a-f]{3}$/.test(r.data.id)); let rq=get('getRequests').data; assert.strictEqual(rq.length,1); assert.strictEqual(rq[0].items.length,2); assert.strictEqual(rq[0].items[1].qty,1); ok('청구 제출: 한 청구번호로 묶임, 수량 0은 1로 보정');
assert(post({action:'submitRequest',items:[]}).success===false); ok('빈 청구 거부');
run('weeklyInputFromMenu()'); assert(/품목을 입력/.test(alerts.at(-1))); assert.strictEqual(get('getWeekly').data.length,1+8); ok('메뉴: 주간실사 자동입력(전 품목 8건 추가)');
const before=get('getRequests').data.length; run('createRequestFromMenu()'); let rq2=get('getRequests').data; assert.strictEqual(rq2.length,before+1); assert(rq2.at(-1).items.every(i=>i.qty>0)); ok('메뉴: 부족 품목 자동 청구서');
run('showDashboard()'); assert(/전체 품목: 8개/.test(alerts.at(-1))); ok('메뉴: 현황 대시보드');
run('addItemFromMenu()'); assert(get('getMaster').data.some(x=>x.name==='테스트품목'&&x.stock===3)); ok('메뉴: 품목 추가 입력 파싱');
assert(post({action:'x'}).success===false&&get('x').success===false); ok('잘못된 action 거부');
assert(post({action:'submitRequest',items:[{name:'a',qty:1}]}).success&&post({action:'submitRequest',items:[{name:'b',qty:1}]}).success); const ids=get('getRequests').data.map(x=>x.id); assert.strictEqual(new Set(ids).size,ids.length); ok('같은 초에 청구해도 번호 중복 없음');
console.log('\n전체 '+n+'개 통과');
