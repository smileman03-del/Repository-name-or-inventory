const fs=require('fs'), vm=require('vm'), assert=require('assert');
const code=fs.readFileSync(process.argv[2]||'Code.gs','utf8');

// --- 가짜 스프레드시트 ---
class Range{constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
 setValues(v){for(let i=0;i<v.length;i++)for(let j=0;j<v[0].length;j++){(this.sh.d[this.r-1+i]=this.sh.d[this.r-1+i]||[])[this.c-1+j]=v[i][j]}return this}
 setValue(v){return this.setValues([[v]])}
 setFontWeight(){return this}
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(((this.sh.d[this.r-1+i]||[])[this.c-1+j])??'');o.push(row)}return o}}
class Sheet{constructor(){this.d=[]}
 getLastRow(){return this.d.length}
 getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc)}
 appendRow(a){this.d.push(a)} deleteRow(r){this.d.splice(r-1,1)} setFrozenRows(){}}
const sheets={};
const ctx={
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet()})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>require('crypto').randomUUID(),formatDate:(d)=>d.toISOString().slice(0,10)},
 Session:{getScriptTimeZone:()=>'Asia/Seoul'},
 ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:'json'}},
 JSON,Date,Math,String,parseInt,isNaN};
vm.createContext(ctx); vm.runInContext(code,ctx);
const run=s=>vm.runInContext(s,ctx);
const get=a=>JSON.parse(run(`doGet({parameter:{action:'${a}'}})`).s);
const post=p=>JSON.parse(run(`doPost({postData:{contents:${JSON.stringify(JSON.stringify(p))}}})`).s);

run('setupSheets()'); run('loadSampleData()');
let all=get('getAll'); assert(all.success);
assert.strictEqual(all.data.items.length,9); console.log('1 샘플 9건 로드 OK');
assert.throws(()=>run('loadSampleData()')); console.log('2 샘플 중복 로드 차단 OK');

let r=post({action:'itemAdd',dept:'병동',cat:'소모품',name:'테스트품목',spec:'EA',par:10,stock:3,memo:''});
assert(r.success&&r.data.id); const id=r.data.id; console.log('3 itemAdd OK');
assert(post({action:'itemAdd',dept:'',name:'x'}).success===false); console.log('4 빈 부서 거부 OK');

assert(post({action:'itemUpdate',id,par:20,memo:'수정'}).success);
let it=get('getAll').data.items.find(i=>i.id===id); assert.strictEqual(it.par,20); assert.strictEqual(it.memo,'수정'); assert.strictEqual(it.stock,3);
console.log('5 itemUpdate(부분 수정, 재고 보존) OK');

r=post({action:'auditSubmit',dept:'병동',updates:[{id,name:'테스트품목',stock:7},{id:'없는id',stock:1}]});
assert(r.success&&r.data.changed===1&&r.data.date); 
all=get('getAll').data; assert.strictEqual(all.items.find(i=>i.id===id).stock,7); assert(all.audits['병동']);
console.log('6 auditSubmit(변경 1건, 없는 id 무시, 실사일 기록) OK');

r=post({action:'requestCreate',dept:'병동',items:[{id,name:'테스트품목',qty:13}]});
assert(r.success); all=get('getAll').data; assert.strictEqual(all.requests.length,1); assert.strictEqual(all.requests[0].items[0].qty,13);
console.log('7 requestCreate + 목록 복원 OK');
assert(post({action:'requestCreate',dept:'병동',items:[]}).success===false); console.log('8 빈 청구 거부 OK');

assert(post({action:'itemDelete',id}).success); assert.strictEqual(get('getAll').data.items.length,9);
assert(post({action:'itemDelete',id}).success===false); console.log('9 itemDelete + 재삭제 거부 OK');
assert(post({action:'bogus'}).success===false); assert(get('bogus').success===false); console.log('10 잘못된 action 거부 OK');
console.log('\n전체 통과');
