VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FrmNoticeDetail 
   Caption         =   "게시판 조회"
   ClientHeight    =   10410
   ClientLeft      =   110
   ClientTop       =   440
   ClientWidth     =   14520
   OleObjectBlob   =   "FrmNoticeDetail.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "FrmNoticeDetail"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' 호출자 정보
Private CallerForm As Object
Private CallerControl As Object
Private InitialNotice_id As String
Private HasInitialData As Boolean

'Dim m_objImageList As CImageList

Public Sub SetInitialData(initialValue As String)
    InitialNotice_id = initialValue
    HasInitialData = True
End Sub

Public Sub SetCaller(formObj As Object, Optional ctrlObj As Object = Nothing)
    Set CallerForm = formObj
    If Not ctrlObj Is Nothing Then
        Set CallerControl = ctrlObj
    End If
End Sub

Private Sub UserForm_Initialize()
    Call g_image_Init
    ' 1. 모던 디자인 테마 적용 (공통 모듈 함수 호출)
    Call ApplyModernTheme(Me)
    
    ' 2. 화면 전용 초기화
    Call SetLayout ' 프레임 위치 및 크기 조정
    
 '   Call SetImageList
    Call LoadCombos
    
    ' 3. 데이터 로드
'    Call RefreshList
End Sub

Private Sub UserForm_Activate()
    If HasInitialData Then
        txtNotice_id.value = InitialNotice_id
        RefreshList
        
        If txtNotice_id.Text <> "" And txtAuthor_id.Text <> "" Then
            txtNotice_id.Enabled = False
            
            If txtAuthor_id.Text = CurrentUserID Or CurrentUserID = "admin" Then
                If CurrentUserID = "admin" Then
                    txtAuthor_id.Enabled = True
                Else
                    txtAuthor_id.Enabled = False
                End If
                
                txtTitle.Enabled = True
                txtContent.Enabled = True
                cmbCategory.Enabled = True
                cbIs_fixed.Enabled = True
                txtStart_date.Enabled = True
                txtEnd_date.Enabled = True
                lblDatePickerStart.Enabled = True
                lblDatePickerEnd.Enabled = True
                
                If CurrentUserID = "admin" Then
                    txtCreated_at.Enabled = True
                Else
                    txtCreated_at.Enabled = False
                End If
                
                lblAdd.Visible = True
                lblDelete.Visible = True
                lblApply.Visible = True
                
                Me.caption = "게시판 수정"
                lblHeader.caption = " " & Me.caption
            Else
                txtAuthor_id.Enabled = False
                txtTitle.Enabled = False
                txtContent.Enabled = True
                cmbCategory.Enabled = False
                cbIs_fixed.Enabled = False
                txtStart_date.Enabled = False
                txtEnd_date.Enabled = False
                lblDatePickerStart.Enabled = False
                lblDatePickerEnd.Enabled = False
                
                txtCreated_at.Enabled = False
                
                lblAdd.Visible = False
                lblDelete.Visible = False
                lblApply.Visible = False
                
                Me.caption = "게시판 조회"
                lblHeader.caption = " " & Me.caption
            End If
        End If
    Else
        txtNotice_id.Text = ""
        txtAuthor_id.Text = ""
        txtTitle.Text = ""
        txtContent.Text = ""
        cmbCategory.Text = ""
        cbIs_fixed.value = False
        txtStart_date.Text = ""
        txtEnd_date.Text = ""
        lblDatePickerStart.Enabled = True
        lblDatePickerEnd.Enabled = True
        
        txtCreated_at.Text = ""
        
        lblAdd.Visible = True
        lblDelete.Visible = True
        lblApply.Visible = True
    End If
End Sub

Private Sub UserForm_Terminate()
'    ' 이미지 리스트 메모리 해제
'    If Not m_objImageList Is Nothing Then
'        Set m_objImageList = Nothing
'    End If
End Sub

' 프레임 및 헤더 디자인 조정
Private Sub SetLayout()
    With lblHeader
        .Top = 0
        .Left = 0
        .Width = Me.Width
        .Height = 35
        .BackColor = RGB(47, 85, 151) ' Primary Blue
        .ForeColor = vbWhite
        .Font.Name = "맑은 고딕"
        .Font.Bold = True
        .Font.size = 14
    End With
    
    Call SetToolbarStyle(fraToolbar, 130)
    
    fraToolbar.Width = Me.InsideWidth
    With fraBorder
        .Left = 0
        .Top = lblHeader.Height + fraToolbar.Height
        .Height = 1
        .Width = Me.InsideWidth
    End With
    
    ' 3. 우측 액션 아이콘 배치 (폼 너비에 따라 가변적 배치)
    Dim rightMargin As Single: rightMargin = Me.fraToolbar.Width - 30

    ' [적용/저장] 아이콘 위치 (가장 우측)
    With Me.lblApply: .Left = rightMargin - .Width: End With

    ' [삭제] 아이콘 위치 (적용 아이콘 왼쪽)
    With Me.lblDelete: .Left = Me.lblApply.Left - .Width - 10: End With

    ' [추가] 아이콘 위치 (삭제 아이콘 왼쪽)
    With Me.lblAdd: .Left = Me.lblDelete.Left - .Width - 10: End With
    
    With Me.lblQuery: .Left = Me.lblAdd.Left - .Width - 10: End With
    
    Me.lblQuery.Width = 26
    Me.lblAdd.Width = 26
    Me.lblDelete.Width = 26
    Me.lblApply.Width = 26
    
    SetCachedImage Me.lblQuery, "RefreshData", 32
    SetCachedImage Me.lblAdd, "TableRowsInsertBelowExcel", 32
    SetCachedImage Me.lblDelete, "TableRowsDeleteExcel", 32
    SetCachedImage Me.lblApply, "FileUpdate", 32
    
    SetCachedImage Me.lblDatePickerStart, "CalendarsGallery", 32
    SetCachedImage Me.lblDatePickerEnd, "CalendarsGallery", 32
    
    lblDatePickerStart.Enabled = True
    lblDatePickerEnd.Enabled = True
    
End Sub

Private Sub SetImageList()

'   Set m_objImageList = New CImageList
'   With m_objImageList
'      .Create 24, 24, ImageFolder & "\"
'
'      'Debug.Print ImageFolder
'
'      .AddImage "search.bmp"
'      .AddImage "btn_edit_24.bmp"
'      .AddImage "btn_search_24.bmp"
'      .AddImage "btn_add_24.bmp"
'      .AddImage "btn_delete_24.bmp"
'   End With
End Sub

Private Sub LoadCombos()
    SetMyComboBox cmbCategory, "NOTICE_CATEGORY"
End Sub

Private Sub SetMyComboBox(ctrl As Object, vCode As String)
    Dim dataList As Collection
    Dim row As Object
    
    ' 1. DB 연결 (Common Sub)
    Call OpenDB
    
    With ctrl
        .Clear
        .ColumnCount = 2
        .BoundColumn = 1
        .TextColumn = 2
        .ColumnWidths = "0pt;100pt"
    End With
    ctrl.AddItem ""
    ctrl.List(ctrl.ListCount - 1, 1) = ""
    
    ' 2. 함수 호출
    Set dataList = GetQueryResult(conn, "SELECT * FROM comm_code where group_code = '" & vCode & "' and is_use = 'Y' order by code ")
    
    ' 3. 데이터 사용
    If Not dataList Is Nothing Then
        For Each row In dataList
            ctrl.AddItem row("code")
            ctrl.List(ctrl.ListCount - 1, 1) = row("code_name")
        Next row
    End If
End Sub

Private Sub lblQuery_Click()
    Application.Cursor = xlWait
    RefreshList
    Application.Cursor = xlDefault
End Sub

Private Sub RefreshList()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    If txtNotice_id.Text = "" Then Exit Sub
    
    If txtNotice_id.Text <> "" Then
        sql = "select * from board_notices where notice_id = " & txtNotice_id.Text
    End If

    Call OpenDB
    
    Set rs = conn.Execute(sql)
    
    If Not rs.EOF Then
        
        'txtNotice_id.value = NVL(rs!notice_id)
        txtNotice_id.Text = CStr(rs!notice_id)
        txtAuthor_id.Text = NVL(rs!author_id)
        txtTitle.Text = NVL(rs!title)
        txtContent.Text = rs!content
        cmbCategory.value = NVL(rs!Category)
        If NVL(rs!is_fixed) = "Y" Then
            cbIs_fixed.value = True
        Else
            cbIs_fixed.value = False
        End If
        txtStart_date.Text = NVL(rs!start_date)
        txtEnd_date.Text = NVL(rs!end_date)
        If txtEnd_date.Text = "" Then
            txtEnd_date.Text = "2999-12-31"
        End If
        txtCreated_at.Text = NVL(rs!created_at)
    End If
 
ExitProcedure:
    On Error Resume Next ' 정리 중 발생하는 에러는 무시
    GoTo Cleanup

ErrorHandler:
    MsgBox "오류가 발생했습니다." & vbCrLf & _
           "번호: " & Err.Number & vbCrLf & _
           "설명: " & Err.Description, vbCritical, "DB Error"
    Resume ExitProcedure ' 에러가 나도 반드시 ExitProcedure -> Cleanup으로 이동

Cleanup:
    ' Recordset 해제
    If Not rs Is Nothing Then
        If rs.State = 1 Then rs.Close ' 1 = adStateOpen
        Set rs = Nothing
    End If
    
    Call CloseDB
End Sub

' [저장] 버튼 클릭 이벤트
Private Sub lblApply_Click()
    Dim sql As String
    
    On Error GoTo ErrorHandler
    
    ' 유효성 검사 (필수값 체크)
    If txtAuthor_id.value = "" Then
        MsgBox "작성자는 필수 입력 항목입니다.", vbExclamation
        txtAuthor_id.SetFocus
        Exit Sub
    End If
    If txtTitle.value = "" Then
        MsgBox "제목은 필수 입력 항목입니다.", vbExclamation
        txtAuthor_id.SetFocus
        Exit Sub
    End If
    If txtContent.value = "" Then
        MsgBox "내용은 필수 입력 항목입니다.", vbExclamation
        txtAuthor_id.SetFocus
        Exit Sub
    End If

    Call OpenDB
    
    conn.BeginTrans

    ' Upsert (MySQL의 ON DUPLICATE KEY UPDATE 활용)
    sql = "INSERT INTO board_notices (notice_id, title, content, is_fixed, category, author_id, start_date, end_date, created_by) " & _
          "VALUES (" & IIf(txtNotice_id.Text = "", 0, txtNotice_id.Text) & ",'" & ES(txtTitle.Text) & "', '" & ES(txtContent.Text) & "', '" & IIf(cbIs_fixed.value, "Y", "N") & "', '" & cmbCategory.Text & "', " & _
          "'" & txtAuthor_id.Text & "', '" & txtStart_date.Text & "', '" & txtEnd_date.Text & "','" & CurrentUserID & "') " & _
          "ON DUPLICATE KEY UPDATE " & _
          "notice_id = VALUES(notice_id), title = VALUES(title), content = VALUES(content), is_fixed = VALUES(is_fixed), " & _
          "category = VALUES(category), author_id = VALUES(author_id), " & _
          "start_date = VALUES(start_date), end_date = VALUES(end_date), updated_at = NOW(), updated_by = '" & CurrentUserID & "' ;"
          
    Debug.Print sql
    
    conn.Execute sql
    
    conn.CommitTrans

    MsgBox "정상적으로 저장되었습니다.", vbInformation
    Call RefreshList
    
ExitProcedure:
    On Error Resume Next ' 정리 중 발생하는 에러는 무시
    GoTo Cleanup

ErrorHandler:
    MsgBox "오류가 발생했습니다." & vbCrLf & _
           "번호: " & Err.Number & vbCrLf & _
           "설명: " & Err.Description, vbCritical, "DB Error"
    Resume ExitProcedure ' 에러가 나도 반드시 ExitProcedure -> Cleanup으로 이동

Cleanup:
    Call CloseDB
    
End Sub

'' [삭제] 버튼 클릭
Private Sub lblDelete_Click()
   Dim sql As String
    
    On Error GoTo ErrorHandler
    
    If MsgBox("정말 삭제 하시겠습니까 ?", vbYesNo) <> vbYes Then Exit Sub
    
    ' 유효성 검사 (필수값 체크)
    If txtNotice_id.value = "" Then
        MsgBox "삭제 대상 게시물 번호가 없습니다.", vbExclamation
        Exit Sub
    End If

    Call OpenDB

    ' Upsert (MySQL의 ON DUPLICATE KEY UPDATE 활용)
    sql = "DELETE FROM board_notices where notice_id = " & txtNotice_id.Text & " ;"

    conn.Execute sql

    MsgBox "정상적으로 삭제되었습니다.", vbInformation
    
    lblQuery.Enabled = False
    lblApply.Enabled = False
    lblDelete.Enabled = False
    
    lblDatePickerStart.Enabled = False
    lblDatePickerEnd.Enabled = False
    
    'Call RefreshList
    
ExitProcedure:
    On Error Resume Next ' 정리 중 발생하는 에러는 무시
    GoTo Cleanup

ErrorHandler:
    MsgBox "오류가 발생했습니다." & vbCrLf & _
           "번호: " & Err.Number & vbCrLf & _
           "설명: " & Err.Description, vbCritical, "DB Error"
    Resume ExitProcedure ' 에러가 나도 반드시 ExitProcedure -> Cleanup으로 이동

Cleanup:
    Call CloseDB
    
End Sub
'
'' [신규] 버튼 클릭 (입력창 비우기)
Private Sub lblAdd_Click()
    txtNotice_id.Text = ""
    txtAuthor_id.Text = CurrentUserID
    txtTitle.Text = ""
    txtContent.Text = ""
    cmbCategory.Text = ""
    cbIs_fixed.value = False
    txtStart_date.Text = Format(Now(), "yyyy-mm-dd")
    txtEnd_date.Text = "2999-12-01"
    txtCreated_at.Text = ""
    
    
    lblDelete.Visible = True
    lblApply.Visible = True
    
    lblApply.Enabled = True
    lblDelete.Enabled = True
    lblDatePickerStart.Enabled = True
    lblDatePickerEnd.Enabled = True
End Sub

Private Sub lblQuery_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblQuery.BackColor = RGB(225, 235, 245)
    Me.lblQuery.BackStyle = fmBackStyleOpaque
End Sub
Private Sub lblAdd_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblAdd.BackColor = RGB(225, 235, 245)
    Me.lblAdd.BackStyle = fmBackStyleOpaque
End Sub
Private Sub lblDelete_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblDelete.BackColor = RGB(225, 235, 245)
    Me.lblDelete.BackStyle = fmBackStyleOpaque
End Sub
Private Sub lblApply_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblApply.BackColor = RGB(225, 235, 245)
    Me.lblApply.BackStyle = fmBackStyleOpaque
End Sub

' 폼의 여백으로 마우스가 나갔을 때 복원
Private Sub fraToolbar_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblQuery.BackStyle = fmBackStyleTransparent
    Me.lblAdd.BackStyle = fmBackStyleTransparent
    Me.lblDelete.BackStyle = fmBackStyleTransparent
    Me.lblApply.BackStyle = fmBackStyleTransparent
End Sub

'Private Sub btnClose_Click()
'    Unload Me
'End Sub

Private Sub txtEnd_date_DblClick(ByVal Cancel As MSForms.ReturnBoolean)
    lblDatePickerEnd_Click
End Sub

Private Sub lblDatePickerEnd_Click()
    Dim picker As New DatePicker
    
    If IsDate(Me.txtEnd_date.value) Then
        picker.SetInitialDate CDate(Me.txtEnd_date.value)
    End If
    
    With picker
        .StartUpPosition = 0
        .Left = Me.Left + Me.lblDatePickerEnd.Left + 20  '+ ActiveWindow.Left
        .Top = Me.Top + Me.lblDatePickerEnd.Top + 30
        .SetCaller Me, Me.txtEnd_date
        .Show vbModal
    End With
    
    On Error Resume Next
    If picker.IsDateSelected Then
        Me.txtEnd_date.value = Format(picker.GetSelectedDate, "yyyy-mm-dd")
    End If
    
    Unload picker
End Sub

Private Sub txtStart_date_DblClick(ByVal Cancel As MSForms.ReturnBoolean)
    lblDatePickerStart_Click
End Sub

Private Sub lblDatePickerStart_Click()
    Dim picker As New DatePicker
    
    If IsDate(Me.txtStart_date.value) Then
        picker.SetInitialDate CDate(Me.txtStart_date.value)
    End If
    
    With picker
        .StartUpPosition = 0
        .Left = Me.Left + Me.lblDatePickerStart.Left + 20  '+ ActiveWindow.Left
        .Top = Me.Top + Me.lblDatePickerStart.Top + 30
        .SetCaller Me, Me.txtStart_date
        .Show vbModal
    End With
    
    On Error Resume Next
    If picker.IsDateSelected Then
        Me.txtStart_date.value = Format(picker.GetSelectedDate, "yyyy-mm-dd")
    End If
    
    Unload picker
End Sub

