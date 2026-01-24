Attribute VB_Name = "ModFastAPI"
Option Explicit

' =====================================================
' FastAPI 서버 연동 공통 모듈
' =====================================================

' FastAPI 서버 설정
Public Const API_BASE_URL As String = "http://localhost:8000/api/v1"

' =====================================================
' HTTP GET 요청
' =====================================================
Public Function HttpGet(endpoint As String, Optional params As Object = Nothing) As Object
    '
    ' GET 요청 실행 및 JSON 응답 반환
    '
    ' 파라미터:
    '   endpoint: API 엔드포인트 (/projects/list)
    '   params: 쿼리 파라미터 Dictionary (Optional)
    '
    ' 반환값:
    '   JSON 파싱된 Dictionary 객체
    '
    ' 사용 예:
    '   Dim result As Object
    '   Dim params As Object
    '   Set params = CreateObject("Scripting.Dictionary")
    '   params("page") = 1
    '   params("page_size") = 25
    '   Set result = HttpGet("/projects/list", params)
    '
    
    Dim http As Object
    Dim url As String
    Dim queryString As String
    Dim key As Variant
    
    ' URL 구성
    url = API_BASE_URL & endpoint
    
    ' 쿼리 파라미터 추가
    If Not params Is Nothing Then
        queryString = ""
        For Each key In params.Keys
            If params(key) <> "" Then
                If queryString <> "" Then queryString = queryString & "&"
                queryString = queryString & key & "=" & UrlEncode(CStr(params(key)))
            End If
        Next key
        
        If queryString <> "" Then
            url = url & "?" & queryString
        End If
    End If
    
    ' HTTP 요청 객체 생성
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    ' GET 요청 실행
    On Error GoTo ErrorHandler
    http.Open "GET", url, False
    http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.send
    
    ' 응답 확인
    If http.Status = 200 Then
        ' JSON 파싱
        Set HttpGet = JsonConverter.ParseJson(http.responseText)
    Else
        MsgBox "HTTP 오류: " & http.Status & vbCrLf & http.responseText, vbCritical
        Set HttpGet = Nothing
    End If
    
    Exit Function
    
ErrorHandler:
    MsgBox "HTTP 요청 실패: " & Err.Description & vbCrLf & "URL: " & url, vbCritical
    Set HttpGet = Nothing
End Function

' =====================================================
' HTTP POST 요청
' =====================================================
Public Function HttpPost(endpoint As String, data As Object) As Object
    '
    ' POST 요청 실행 및 JSON 응답 반환
    '
    ' 파라미터:
    '   endpoint: API 엔드포인트
    '   data: 전송할 데이터 Dictionary
    '
    ' 반환값:
    '   JSON 파싱된 Dictionary 객체
    '
    
    Dim http As Object
    Dim url As String
    Dim jsonData As String
    
    url = API_BASE_URL & endpoint
    
    ' Dictionary를 JSON으로 변환
    jsonData = JsonConverter.ConvertToJson(data)
    
    ' HTTP 요청 객체 생성
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    On Error GoTo ErrorHandler
    http.Open "POST", url, False
    http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.send jsonData
    
    ' 응답 확인
    If http.Status = 200 Or http.Status = 201 Then
        Set HttpPost = JsonConverter.ParseJson(http.responseText)
    Else
        MsgBox "HTTP 오류: " & http.Status & vbCrLf & http.responseText, vbCritical
        Set HttpPost = Nothing
    End If
    
    Exit Function
    
ErrorHandler:
    MsgBox "HTTP 요청 실패: " & Err.Description, vbCritical
    Set HttpPost = Nothing
End Function

' =====================================================
' URL 인코딩
' =====================================================
Private Function UrlEncode(str As String) As String
    Dim i As Long
    Dim char As String
    Dim asciiVal As Integer
    Dim result As String
    
    result = ""
    For i = 1 To Len(str)
        char = Mid(str, i, 1)
        asciiVal = Asc(char)
        
        If (asciiVal >= 48 And asciiVal <= 57) Or _
           (asciiVal >= 65 And asciiVal <= 90) Or _
           (asciiVal >= 97 And asciiVal <= 122) Or _
           char = "-" Or char = "_" Or char = "." Or char = "~" Then
            result = result & char
        Else
            result = result & "%" & Right("0" & Hex(asciiVal), 2)
        End If
    Next i
    
    UrlEncode = result
End Function

' =====================================================
' 서버 연결 테스트
' =====================================================
Public Function TestConnection() As Boolean
    '
    ' FastAPI 서버 연결 테스트
    '
    ' 반환값:
    '   True: 연결 성공, False: 연결 실패
    '
    
    Dim http As Object
    Dim url As String
    
    url = Replace(API_BASE_URL, "/api/v1", "") & "/health"
    
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    On Error GoTo ErrorHandler
    http.Open "GET", url, False
    http.send
    
    If http.Status = 200 Then
        Dim response As Object
        Set response = JsonConverter.ParseJson(http.responseText)
        
        If response("status") = "healthy" Then
            MsgBox "FastAPI 서버 연결 성공!" & vbCrLf & _
                   "DB: " & response("database")("database") & vbCrLf & _
                   "버전: " & response("database")("mysql_version"), vbInformation
            TestConnection = True
        Else
            MsgBox "서버는 실행 중이나 DB 연결 실패", vbExclamation
            TestConnection = False
        End If
    Else
        MsgBox "서버 연결 실패: " & http.Status, vbCritical
        TestConnection = False
    End If
    
    Exit Function
    
ErrorHandler:
    MsgBox "서버 연결 테스트 실패: " & Err.Description & vbCrLf & _
           "서버가 실행 중인지 확인하세요. (http://localhost:8000)", vbCritical
    TestConnection = False
End Function
