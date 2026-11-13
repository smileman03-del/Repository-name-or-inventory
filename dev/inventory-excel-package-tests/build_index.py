import json,sys
d=sys.argv[1]  # dev 폴더
out=sys.argv[2]
data=json.dumps(json.load(open(d+'/sample.json',encoding='utf-8')),ensure_ascii=False).replace('</','<\\/')
t=open(d+'/index.template.html',encoding='utf-8').read(); assert t.count('__DATA__')==1
open(out,'w',encoding='utf-8').write(t.replace('__DATA__',data)); print('index.html 생성')
