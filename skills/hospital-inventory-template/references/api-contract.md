# 화면 ↔ Code.gs API 계약

화면(`index.html`)과 `Code.gs`는 아래 형식으로만 통신한다. 한쪽을 바꾸면 반드시 다른 쪽과 `scripts/test_backend.js`를 함께 고친다.

모든 응답: `{ "success": true, "data": ... }` 또는 `{ "success": false, "error": "문구" }`

## GET `?action=getAll`
```json
{ "items":    [{"id","dept","cat","name","spec","par","stock","memo"}],
  "audits":   {"수술실": "2026-10-20"},          // 부서별 가장 최근 실사일
  "requests": [{"id","date","dept","items":[...]}] }
```

## POST (Content-Type: text/plain;charset=utf-8, 본문은 JSON 문자열)
> `text/plain`을 쓰는 이유: `application/json`이면 브라우저가 사전 요청(preflight)을 보내는데 Apps Script는 이를 처리하지 못한다.

| action | 요청 필드 | 응답 data |
|---|---|---|
| `itemAdd` | dept, cat, name, spec, par, stock, memo | `{id}` |
| `itemUpdate` | id + (dept, cat, name, spec, par, stock, memo 중 바꿀 것만) | `{id}` |
| `itemDelete` | id | `{id}` |
| `auditSubmit` | dept, updates: `[{id, name, stock}]` | `{date, changed}` |
| `requestCreate` | dept, items: `[{id,name,spec,dept,cat,stock,par,qty}]` | `{id, date}` |

## 시트 구조 (`setupSheets()`가 생성)
- `품목`: id, dept, cat, name, spec, par, stock, memo
- `실사기록`: dept, date, changed
- `청구기록`: id, date, dept, itemsJson

## 화면 쪽 정규화
`DEPT_MERGE_MAP`은 예전 부서명을 합쳐진 부서명으로 바꾸는 호환 장치다. 새 병원에는 필요 없으니 비워도 되지만, 지우면 기존 데이터를 가진 곳에서 부서가 갈라져 보일 수 있다.
