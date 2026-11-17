"""앱 템플릿(index.template.html)을 판매 패키지의 index.html 로 만든다. (프로 버전은 내장 데이터가 없어 그대로 복사)"""
import sys, shutil
d, out = sys.argv[1], sys.argv[2]
shutil.copyfile(d + '/index.template.html', out); print('index.html 생성')
