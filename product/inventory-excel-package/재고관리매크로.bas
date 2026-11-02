Option Explicit

' ============================================================
' 병원 소모품 재고관리 매크로
'  - Weekly_Input     : 품목 마스터의 전체 품목을 [주간 재고 파악]에 오늘 날짜로 입력
'  - Request_Generate : 재고부족 품목을 [물품 청구서]에 자동 기록
' 주의: 함수 이름은 반드시 영문이어야 합니다 (한글 함수명은 인코딩 오류의 원인).
' 시트 이름은 띄어쓰기까지 정확해야 합니다.
' ============================================================

Private Const SH_MASTER As String = "품목 마스터"
Private Const SH_WEEKLY As String = "주간 재고 파악"
Private Const SH_REQUEST As String = "물품 청구서"

' 지정한 열에서 데이터가 있는 마지막 행 번호 (없으면 1 = 머리글 행)
' 사용 범위의 맨 아래 행부터 위로 올라가며 값이 있는 첫 행을 찾는다.
Private Function LastRowOf(ws As Worksheet, ByVal col As Long) As Long
    Dim r As Long
    r = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    Do While r > 1
        If Trim(CStr(ws.Cells(r, col).Value)) <> "" Then Exit Do
        r = r - 1
    Loop
    LastRowOf = r
End Function

' 청구번호: R + 연월일시분초 12자리 + "-" + 무작위 3자리 (예: R261102143025-482)
' 같은 초에 두 번 만들어도 번호가 겹치지 않도록 접미사를 붙인다. (앱의 청구번호 모양과 동일)
' 서식 문자열(Format) 대신 숫자를 직접 조립해 어떤 환경에서도 같은 결과가 나온다.
Private Function NewRequestId() As String
    Dim t As Date
    Dim rndSuffix As String
    t = Now
    rndSuffix = Right("000" & CStr(CLng(Timer * 1000) Mod 1000), 3)
    NewRequestId = "R" & Two(Year(t) Mod 100) & Two(Month(t)) & Two(Day(t)) & _
                   Two(Hour(t)) & Two(Minute(t)) & Two(Second(t)) & "-" & rndSuffix
End Function

Private Function Two(ByVal n As Long) As String
    Two = Right("0" & CStr(n), 2)
End Function

' 상태 수식 (현재재고 < 적정재고 이면 재고부족)
Private Function StatusFormula(ByVal r As Long) As String
    Dim bad As String, good As String
    bad = ChrW(&H274C) & " 재고부족"
    good = ChrW(&H2705) & " 안정"
    StatusFormula = "=IF(E" & r & "="""","""",IF(E" & r & "<D" & r & ",""" & bad & """,""" & good & """))"
End Function

Private Function SheetByName(ByVal nm As String) As Worksheet
    ' 주의: VBA에서는 함수 안에서 함수 이름을 값처럼 읽으면 재호출로 해석되어 오류가 난다.
    ' 그래서 지역 변수(ws)에 담아 검사한 뒤 결과를 돌려준다.
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
    If ws Is Nothing Then
        MsgBox """" & nm & """ 시트를 찾을 수 없습니다." & vbCrLf & "시트 이름(띄어쓰기 포함)을 확인하세요.", vbExclamation
    End If
    Set SheetByName = ws
End Function

' ---------- 주간 실사 자동 입력 ----------
Sub Weekly_Input()
    Dim wsM As Worksheet, wsW As Worksheet
    Dim lastM As Long, r As Long, nextW As Long, n As Long

    Set wsM = SheetByName(SH_MASTER)
    If wsM Is Nothing Then Exit Sub
    Set wsW = SheetByName(SH_WEEKLY)
    If wsW Is Nothing Then Exit Sub

    lastM = LastRowOf(wsM, 1)
    If lastM < 2 Then
        MsgBox "품목 마스터에 품목이 없습니다.", vbExclamation
        Exit Sub
    End If

    If MsgBox("오늘(" & Format(Date, "yyyy-mm-dd") & ") 날짜로 전체 품목을 주간 재고 파악에 입력할까요?" & vbCrLf & _
              "입력 후 실사수량(E열)을 확인·수정하세요.", vbYesNo + vbQuestion, "주간 실사") <> vbYes Then Exit Sub

    nextW = LastRowOf(wsW, 2) + 1
    If nextW < 2 Then nextW = 2

    For r = 2 To lastM
        If Trim(CStr(wsM.Cells(r, 1).Value)) <> "" Then
            wsW.Cells(nextW, 1).Value = Date
            wsW.Cells(nextW, 1).NumberFormat = "yyyy-mm-dd"
            wsW.Cells(nextW, 2).Value = wsM.Cells(r, 1).Value
            wsW.Cells(nextW, 3).Value = wsM.Cells(r, 2).Value
            wsW.Cells(nextW, 4).Value = wsM.Cells(r, 4).Value
            wsW.Cells(nextW, 5).Value = wsM.Cells(r, 5).Value
            wsW.Cells(nextW, 6).Formula = StatusFormula(nextW)
            nextW = nextW + 1
            n = n + 1
        End If
    Next r

    MsgBox n & "개 품목을 입력했습니다.", vbInformation, "주간 실사"
End Sub

' ---------- 물품 청구서 자동 생성 ----------
Sub Request_Generate()
    Dim wsM As Worksheet, wsQ As Worksheet
    Dim lastM As Long, r As Long, nextQ As Long, n As Long
    Dim reqId As String
    Dim cur As Variant, par As Variant

    Set wsM = SheetByName(SH_MASTER)
    If wsM Is Nothing Then Exit Sub
    Set wsQ = SheetByName(SH_REQUEST)
    If wsQ Is Nothing Then Exit Sub

    lastM = LastRowOf(wsM, 1)
    nextQ = LastRowOf(wsQ, 3) + 1
    If nextQ < 2 Then nextQ = 2
    reqId = NewRequestId()

    For r = 2 To lastM
        cur = wsM.Cells(r, 5).Value
        par = wsM.Cells(r, 4).Value
        If Trim(CStr(wsM.Cells(r, 1).Value)) <> "" And Not IsEmpty(cur) And IsNumeric(cur) And IsNumeric(par) Then
            If CDbl(cur) < CDbl(par) Then
                wsQ.Cells(nextQ, 1).Value = reqId
                wsQ.Cells(nextQ, 2).Value = Date
                wsQ.Cells(nextQ, 2).NumberFormat = "yyyy-mm-dd"
                wsQ.Cells(nextQ, 3).Value = wsM.Cells(r, 1).Value
                wsQ.Cells(nextQ, 4).Value = wsM.Cells(r, 2).Value
                wsQ.Cells(nextQ, 5).Value = wsM.Cells(r, 3).Value
                wsQ.Cells(nextQ, 6).Value = CLng(par) - CLng(cur)
                nextQ = nextQ + 1
                n = n + 1
            End If
        End If
    Next r

    If n = 0 Then
        MsgBox "재고부족 품목이 없습니다.", vbInformation, "물품 청구서"
    Else
        MsgBox "청구서 " & reqId & " 를 만들었습니다. (" & n & "개 품목)", vbInformation, "물품 청구서"
    End If
End Sub
