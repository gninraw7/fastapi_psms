VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmAuthManagement 
   Caption         =   "시스템 권한 관리"
   ClientHeight    =   11286
   ClientLeft      =   110
   ClientTop       =   440
   ClientWidth     =   15983
   OleObjectBlob   =   "frmAuthManagement.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "frmAuthManagement"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' 변경 상태를 추적하기 위한 상수
Private Const ST_NORMAL As String = ""
Private Const ST_NEW As String = "N"
Private Const ST_UPDATE As String = "U"
Private Const ST_DELETE As String = "D"

'Dim m_objImageList As CImageList
Dim m_currentPageIndex As Long

Private Sub UserForm_Initialize()
    MultiPage1.value = 0
    Call g_image_Init
    ' 1. 모던 디자인 테마 적용 (공통 모듈 함수 호출)
    Call ApplyModernTheme(Me)
    
    ' 2. 화면 전용 초기화
    Call SetLayout ' 프레임 위치 및 크기 조정
    'Call SetImageList
    Call LoadCombo
    Call InitGrid   ' iGrid 7.50 초기화
    
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
        .BackColor = RGB(47, 85, 151) ' Primary Blue
        .ForeColor = vbWhite
        .Font.Name = "맑은 고딕"
        .Font.Bold = True
        .Font.size = 14
    End With
    
    SetToolbarStyle fraToolbar
    
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
    
    '-----------------------------------
    ' Page 2
    '-----------------------------------
    lblRole.BackColor = Me.BackColor
    lblFormP2.BackColor = Me.BackColor
    lblAddRoleForm.BackColor = Me.BackColor
    lblRemoveRolePerm.BackColor = Me.BackColor
    
    With lblRoleCheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2611)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblRoleUncheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2610)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblFormCheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2611)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblFormUncheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2610)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblRoleSetAllPerm
        .ForeColor = vbBlue
        .Font.Bold = True
        .BackColor = Me.BackColor
    End With
    
    With lblRoleSetViewPerm
        .ForeColor = vbBlue
        .Font.Bold = True
        .BackColor = Me.BackColor
    End With
    
    '-----------------------------------
    ' Page 3
    '-----------------------------------
    lblUser.BackColor = Me.BackColor
    lblFormP3.BackColor = Me.BackColor
    lblAddUserForm.BackColor = Me.BackColor
    lblRemoveUserPerm.BackColor = Me.BackColor
    
    With lblUserCheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2611)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblUserUncheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2610)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblFormP3Check
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2611)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblFormP3Uncheck
        .Font.Name = "Segoe UI Symbol"
        .Font.size = 14
        .caption = ChrW(&H2610)
        .TextAlign = fmTextAlignCenter
        .BackColor = Me.BackColor
    End With
    
    With lblUserSetAllPerm
        .ForeColor = vbBlue
        .Font.Bold = True
        .BackColor = Me.BackColor
    End With
    
    With lblUserSetViewPerm
        .ForeColor = vbBlue
        .Font.Bold = True
        .BackColor = Me.BackColor
    End With
    
    
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
'      .AddImage "Local security policy.bmp"
'   End With
End Sub

Private Sub LoadCombo()
    'SetMyComboBox cmbRole, "ROLE"
    'SetCombos igForm, "ROLE"
End Sub

Private Sub SetMyComboBox(ctrl As Object, vCode As String)
    Dim dataList As Collection
    Dim row As Object
    
    ' 1. DB 연결 (Common Sub)
    Call OpenDB
    
'    With ctrl
'        .Clear
'        .ColumnCount = 2
'        .BoundColumn = 1
'        .TextColumn = 2
'        .ColumnWidths = "0pt;100pt"
'    End With
'    ctrl.AddItem ""
'    ctrl.List(ctrl.ListCount - 1, 1) = ""
    
    ' 2. 함수 호출
    Set dataList = GetQueryResult(conn, "SELECT * FROM comm_code where group_code = '" & vCode & "' and is_use = 'Y' order by code ")
    
    ' 3. 데이터 사용
    If Not dataList Is Nothing Then
'        For Each row In dataList
'            ctrl.AddItem row("code")
'            ctrl.List(ctrl.ListCount - 1, 1) = row("code_name")
'        Next row
        
        With igRolePerm.Combos.Add(vCode)
            For Each row In dataList
                .AddItem sItemText:=row("code_name"), vItemValue:=row("code")  ''', iIconIndex:=imlTypes.ItemIndex("Private")
            Next row
        End With
    End If
    
End Sub

Private Sub SetCombos(ByVal pGrid As Object, vCode As String)
    Dim dataList As Collection
    Dim row As Object
    
    ' 1. DB 연결 (Common Sub)
    Call OpenDB
    
    ' 2. 함수 호출
    Set dataList = GetQueryResult(conn, "SELECT * FROM comm_code where group_code = '" & vCode & "' and is_use = 'Y' order by code ")
    
    ' 3. 데이터 사용
    If Not dataList Is Nothing Then
        With pGrid.Combos.Add(vCode)
            For Each row In dataList
                .AddItem sItemText:=row("code_name"), vItemValue:=row("code")  ''', iIconIndex:=imlTypes.ItemIndex("Private")
            Next row
        End With
    End If
    
End Sub


' 2.4 iGrid 초기화
Private Sub InitGrid()

    '-----------------------------------
    ' Page 1
    '-----------------------------------
    gpSetModernLook igForm
    
    With igForm
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="row_stat", sheader:="상태", lWidth:=0
        .AddCol sKey:="form_id", sheader:="화면ID", lWidth:=160
        .AddCol sKey:="form_name", sheader:="화면명", lWidth:=250
        .AddCol(sKey:="created_at", sheader:="최초생성일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="created_by", sheader:="최초생성자", lWidth:=100
        .AddCol(sKey:="updated_at", sheader:="최종변경일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="updated_by", sheader:="최종변경자", lWidth:=100
        .RowMode = False
        .EndUpdate
    End With
    
    '-----------------------------------
    ' Page 2
    '-----------------------------------
    gpSetModernLook igRole
    
    With igRole
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="role_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("role_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        .AddCol sKey:="code", sheader:="Role", lWidth:=100
        .AddCol sKey:="code_name", sheader:="역할명", lWidth:=140
        
        .RowMode = False
        .EndUpdate
    End With
    
    gpSetModernLook igFormP2
    
    With igFormP2
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="form_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("form_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        .AddCol sKey:="form_id", sheader:="화면ID", lWidth:=100
        .AddCol sKey:="form_name", sheader:="화면명", lWidth:=140
        
        .RowMode = False
        .EndUpdate
    End With
    
    gpSetModernLook igRolePerm
    
    With igRolePerm
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="row_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("row_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="row_stat", sheader:="상태", lWidth:=0
        .AddCol sKey:="role", sheader:="역할", lWidth:=100
        .AddCol sKey:="form_id", sheader:="화면ID", lWidth:=100
        .AddCol sKey:="form_name", sheader:="화면명", lWidth:=160
        
        .AddCol sKey:="can_view", sheader:="View", lWidth:=50, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_view")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_create", sheader:="Create", lWidth:=50, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_create")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_update", sheader:="Update", lWidth:=50, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_update")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_delete", sheader:="Delete", lWidth:=50, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_delete")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol(sKey:="created_at", sheader:="최초생성일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="created_by", sheader:="최초생성자", lWidth:=100
        .AddCol(sKey:="updated_at", sheader:="최종변경일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="updated_by", sheader:="최종변경자", lWidth:=100
        
        .RowMode = False
        .EndUpdate
    End With
    
    '-----------------------------------
    ' Page 3
    '-----------------------------------
    gpSetModernLook igUser
    
    With igUser
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="user_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("user_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        .AddCol sKey:="login_id", sheader:="로그인ID", lWidth:=100
        .AddCol sKey:="user_name", sheader:="사용자명", lWidth:=140
        .AddCol sKey:="role", sheader:="role", lWidth:=140
        
        .RowMode = False
        .EndUpdate
    End With
    
    gpSetModernLook igFormP3
    
    With igFormP3
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="form_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("form_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        .AddCol sKey:="form_id", sheader:="화면ID", lWidth:=100
        .AddCol sKey:="form_name", sheader:="화면명", lWidth:=140
        
        .RowMode = False
        .EndUpdate
    End With

    gpSetModernLook igUserPerm
    
    With igUserPerm
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
        
        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
            
        .AddCol sKey:="row_check", sheader:="선택", lWidth:=40, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("row_check")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="row_stat", sheader:="상태", lWidth:=0
        .AddCol sKey:="login_id", sheader:="로그인ID", lWidth:=80
        .AddCol sKey:="user_name", sheader:="사용자명", lWidth:=100
        .AddCol sKey:="form_id", sheader:="화면ID", lWidth:=140
        .AddCol sKey:="form_name", sheader:="화면명", lWidth:=200
        
        .AddCol sKey:="can_view", sheader:="View", lWidth:=80, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_view")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_create", sheader:="Create", lWidth:=80, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_create")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_update", sheader:="Update", lWidth:=80, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_update")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol sKey:="can_delete", sheader:="Delete", lWidth:=80, eHeaderAlignH:=igAlignHCenter
        With .ColDefaultCell("can_delete")
            .bCheckVisible = True
            .eCheckPos = igCheckPosCenter
        End With
        
        .AddCol(sKey:="created_at", sheader:="최초생성일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="created_by", sheader:="최초생성자", lWidth:=100
        .AddCol(sKey:="updated_at", sheader:="최종변경일", lWidth:=150).sFmtString = "yyyy-mm-dd hh:mm:ss"
        .AddCol sKey:="updated_by", sheader:="최종변경자", lWidth:=100
        
        .RowMode = False
        .EndUpdate
    End With

End Sub

' 2.2 [조회] 및 ListBox 선택 시 데이터 표시
Private Sub lblQuery_Click()
    Application.Cursor = xlWait
    Call LoadGridData
    Application.Cursor = xlDefault
End Sub
Private Sub txtSearch_AfterUpdate()
    Application.Cursor = xlWait
    Call LoadGridData
    Application.Cursor = xlDefault
End Sub

Private Sub LoadGridData()
    
    m_currentPageIndex = MultiPage1.value
    
    Select Case m_currentPageIndex
    Case 0
        Load_igForm
    Case 1
        If igRole.RowCount = 0 Then
            Load_igRole
        End If
        If igFormP2.RowCount = 0 Then
            Load_igFormP2
        End If
        Load_igRolePerm
    Case 2
        If igUser.RowCount = 0 Then
            Load_igUser
        End If
        If igFormP3.RowCount = 0 Then
            Load_igFormP3
        End If

        Load_igUserPerm
    End Select
End Sub

'-----------------------------------
' Page 1
'-----------------------------------
Private Sub Load_igForm()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    m_currentPageIndex = MultiPage1.value
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT * FROM auth_forms "
    If strFilter <> "" Then
        sql = sql & " WHERE form_id LIKE '%" & strFilter & "%' " & _
                    " OR form_name LIKE '%" & strFilter & "%' "
    End If
    sql = sql & " ORDER BY form_id"
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igForm
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "row_stat") = ST_NORMAL
            .CellValue(i, "form_id") = NVL(rs!form_id)
            .CellValue(i, "form_name") = NVL(rs!form_name)
            
            .CellValue(i, "created_at") = NVL(rs!created_at)
            .CellSelectable(i, "created_at") = False
            
            .CellValue(i, "created_by") = NVL(rs!created_by)
            .CellSelectable(i, "created_by") = False
            
            .CellValue(i, "updated_at") = NVL(rs!updated_at)
            .CellSelectable(i, "updated_at") = False
            
            .CellValue(i, "updated_by") = NVL(rs!updated_by)
            .CellSelectable(i, "updated_by") = False
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

'-----------------------------------
' Page 2
'-----------------------------------
Private Sub lblRole_Click()
    Load_igRole
End Sub

Private Sub lblFormP2_Click()
    Load_igFormP2
End Sub

Private Sub Load_igRole()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    m_currentPageIndex = MultiPage1.value
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT * FROM comm_code where group_code = 'ROLE' and is_use = 'Y' order by sort_order "
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igRole
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "code") = NVL(rs!code)
            .CellValue(i, "code_name") = NVL(rs!code_name)
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub Load_igFormP2()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    m_currentPageIndex = MultiPage1.value
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT * FROM auth_forms "
    If strFilter <> "" Then
        sql = sql & " WHERE form_id LIKE '%" & strFilter & "%' " & _
                    " OR form_name LIKE '%" & strFilter & "%' "
    End If
    sql = sql & " ORDER BY form_id"
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igFormP2
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "form_id") = NVL(rs!form_id)
            .CellValue(i, "form_name") = NVL(rs!form_name)
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub Load_igRolePerm()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    'strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT r.*, f.form_name FROM auth_role_permissions r " & _
          "LEFT JOIN auth_forms f ON r.form_id = f.form_id "
          
'    If strFilter <> "" Then
'        sql = sql & " WHERE auth_role_permissions LIKE '%" & strFilter & "%' " & _
'                    " OR form_name LIKE '%" & strFilter & "%' "
'    End If
    sql = sql & " ORDER BY r.role, r.form_id"
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igRolePerm
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "row_stat") = ST_NORMAL
            .CellValue(i, "role") = NVL(rs!role)
            .CellSelectable(i, "role") = False
            .CellValue(i, "form_id") = NVL(rs!form_id)
            .CellSelectable(i, "form_id") = False
            .CellValue(i, "form_name") = NVL(rs!form_name)
            .CellSelectable(i, "form_name") = False

            .CellCheckState(i, "can_view") = IIf(NVL(rs!can_view) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_create") = IIf(NVL(rs!can_create) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_update") = IIf(NVL(rs!can_update) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_delete") = IIf(NVL(rs!can_delete) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            
            .CellValue(i, "created_at") = NVL(rs!created_at)
            .CellSelectable(i, "created_at") = False
            
            .CellValue(i, "created_by") = NVL(rs!created_by)
            .CellSelectable(i, "created_by") = False
            
            .CellValue(i, "updated_at") = NVL(rs!updated_at)
            .CellSelectable(i, "updated_at") = False
            
            .CellValue(i, "updated_by") = NVL(rs!updated_by)
            .CellSelectable(i, "updated_by") = False
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub lblRoleCheck_Click()
    Dim i As Long
    For i = 1 To igRole.RowCount
        igRole.CellCheckState(i, "role_check") = igCheckStateChecked
    Next i
End Sub

Private Sub lblRoleUncheck_Click()
    Dim i As Long
    For i = 1 To igRole.RowCount
        igRole.CellCheckState(i, "role_check") = igCheckStateUnchecked
    Next i
End Sub

Private Sub lblFormCheck_Click()
    Dim i As Long
    For i = 1 To igFormP2.RowCount
        igFormP2.CellCheckState(i, "form_check") = igCheckStateChecked
    Next i
End Sub

Private Sub lblFormUncheck_Click()
    Dim i As Long
    For i = 1 To igFormP2.RowCount
        igFormP2.CellCheckState(i, "form_check") = igCheckStateUnchecked
    Next i
End Sub

Private Sub lblRoleSetAllPerm_Click()
    Dim i As Long
    With igRolePerm
        For i = 1 To .RowCount
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                .CellCheckState(i, "can_view") = igCheckStateChecked
                .CellCheckState(i, "can_create") = igCheckStateChecked
                .CellCheckState(i, "can_update") = igCheckStateChecked
                .CellCheckState(i, "can_delete") = igCheckStateChecked
                
                If .CellValue(i, "row_stat") = ST_NORMAL Then
                    .CellValue(i, "row_stat") = ST_UPDATE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub

Private Sub lblRoleSetViewPerm_Click()
    Dim i As Long
    With igRolePerm
        For i = 1 To .RowCount
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                .CellCheckState(i, "can_view") = igCheckStateChecked
                .CellCheckState(i, "can_create") = igCheckStateUnchecked
                .CellCheckState(i, "can_update") = igCheckStateUnchecked
                .CellCheckState(i, "can_delete") = igCheckStateUnchecked
                
                If .CellValue(i, "row_stat") = ST_NORMAL Then
                    .CellValue(i, "row_stat") = ST_UPDATE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub

Private Sub lblAddRoleForm_Click()
    Dim i As Long, j As Long, k As Long
    Dim roleID As String, formID As String, formName As String
    Dim isExist As Boolean
    Dim newRow As Long
    
    ' 성능 향상을 위해 Redraw 일시 중지
    igRolePerm.BeginUpdate

    ' Role 루프
    For i = 1 To igRole.RowCount
        If igRole.CellCheckState(i, "role_check") = igCheckStateChecked Then
            roleID = igRole.CellValue(i, "code")
            
            ' Form 루프
            For j = 1 To igFormP2.RowCount
                If igFormP2.CellCheckState(j, "form_check") = igCheckStateChecked Then
                    formID = igFormP2.CellValue(j, "form_id")
                    formName = igFormP2.CellValue(j, "form_name")
                    
                    ' 중복 체크
                    isExist = False
                    For k = 1 To igRolePerm.RowCount
                        If igRolePerm.CellValue(k, "role") = roleID And _
                           igRolePerm.CellValue(k, "form_id") = formID Then
                           
                           igRolePerm.CellForeColor(k, "role") = vbBlue
                           igRolePerm.CellForeColor(k, "form_id") = vbBlue
                           
                            isExist = True
                            Exit For
                        End If
                    Next k
                    
                    ' 존재하지 않을 때만 추가
                    If Not isExist Then
                        With igRolePerm
                            .RowCount = .RowCount + 1
                            newRow = .RowCount
                            .CellCheckState(newRow, "row_check") = igCheckStateChecked
                            .CellValue(newRow, "row_stat") = ST_NEW
                        
                            .CellValue(newRow, "role") = roleID
                            .CellSelectable(newRow, "role") = False
                            
                            .CellValue(newRow, "form_id") = formID
                            .CellSelectable(newRow, "form_id") = False
                            
                            .CellValue(newRow, "form_name") = formName
                            .CellSelectable(newRow, "form_name") = False
                            
                            .CellCheckState(newRow, "can_view") = igCheckStateChecked
                            .CellCheckState(newRow, "can_create") = igCheckStateUnchecked
                            .CellCheckState(newRow, "can_update") = igCheckStateUnchecked
                            .CellCheckState(newRow, "can_delete") = igCheckStateUnchecked
                        End With
                    End If
                End If
            Next j
        End If
    Next i
    
    igRolePerm.EndUpdate
    
    igRolePerm.Refresh

    MsgBox "선택된 조합이 추가되었습니다.", vbInformation
End Sub

Private Sub lblRemoveRolePerm_Click()
    Dim i As Long
    With igRolePerm
        For i = .RowCount To 1 Step -1
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                If .CellValue(i, "row_stat") = ST_NEW Then
                    .RemoveRow i
                Else
                    .CellValue(i, "row_stat") = ST_DELETE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub

'-----------------------------------
' Page 3
'-----------------------------------
Private Sub lbluser_Click()
    Load_igUser
End Sub

Private Sub lblFormP3_Click()
    Load_igFormP3
End Sub

Private Sub Load_igUser()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    m_currentPageIndex = MultiPage1.value
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT * FROM users order by user_name "
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igUser
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "login_id") = NVL(rs!login_id)
            .CellValue(i, "user_name") = NVL(rs!user_name)
            .CellValue(i, "role") = NVL(rs!role)
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub Load_igFormP3()
    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    m_currentPageIndex = MultiPage1.value
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT * FROM auth_forms "
    If strFilter <> "" Then
        sql = sql & " WHERE form_id LIKE '%" & strFilter & "%' " & _
                    " OR form_name LIKE '%" & strFilter & "%' "
    End If
    sql = sql & " ORDER BY form_id"
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igFormP3
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "form_id") = NVL(rs!form_id)
            .CellValue(i, "form_name") = NVL(rs!form_name)
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub Load_igUserPerm()

    Dim rs As ADODB.Recordset
    Dim strFilter As String
    Dim sql As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    strFilter = Trim(txtSearch.Text)
    
    sql = "SELECT a.*, f.form_name, u.user_name  FROM auth_user_permissions a " & _
          "LEFT JOIN auth_forms f ON a.form_id = f.form_id " & _
          "LEFT JOIN users u ON a.login_id = u.login_id "
    
'    If strFilter <> "" Then
'        sql = sql & " WHERE auth_role_permissions LIKE '%" & strFilter & "%' " & _
'                    " OR form_name LIKE '%" & strFilter & "%' "
'    End If
    sql = sql & " ORDER BY login_id, form_id"
    
    Call OpenDB
    Set rs = conn.Execute(sql)
    
    With igUserPerm
        .BeginUpdate
        '.FrozenCols = 3
        .RowCount = 0
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "row_stat") = ST_NORMAL
            .CellValue(i, "login_id") = NVL(rs!login_id)
            .CellValue(i, "user_name") = NVL(rs!user_name)
            .CellValue(i, "form_id") = NVL(rs!form_id)
            .CellValue(i, "form_name") = NVL(rs!form_name)
            
            .CellCheckState(i, "can_view") = IIf(NVL(rs!can_view) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_create") = IIf(NVL(rs!can_create) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_update") = IIf(NVL(rs!can_update) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            .CellCheckState(i, "can_delete") = IIf(NVL(rs!can_delete) = "Y", igCheckStateChecked, igCheckStateUnchecked)
            
            .CellValue(i, "created_at") = NVL(rs!created_at)
            .CellSelectable(i, "created_at") = False
            
            .CellValue(i, "created_by") = NVL(rs!created_by)
            .CellSelectable(i, "created_by") = False
            
            .CellValue(i, "updated_at") = NVL(rs!updated_at)
            .CellSelectable(i, "updated_at") = False
            
            .CellValue(i, "updated_by") = NVL(rs!updated_by)
            .CellSelectable(i, "updated_by") = False
            rs.MoveNext
        Loop
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
        
        .EndUpdate
    End With
    
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

Private Sub lblUserCheck_Click()
    Dim i As Long
    For i = 1 To igUser.RowCount
        igUser.CellCheckState(i, "user_check") = igCheckStateChecked
    Next i
End Sub

Private Sub lblUserUncheck_Click()
    Dim i As Long
    For i = 1 To igUser.RowCount
        igUser.CellCheckState(i, "user_check") = igCheckStateUnchecked
    Next i
End Sub

Private Sub lblFormP3Check_Click()
    Dim i As Long
    For i = 1 To igFormP3.RowCount
        igFormP3.CellCheckState(i, "form_check") = igCheckStateChecked
    Next i
End Sub

Private Sub lblFormP3Uncheck_Click()
    Dim i As Long
    For i = 1 To igFormP3.RowCount
        igFormP3.CellCheckState(i, "form_check") = igCheckStateUnchecked
    Next i
End Sub

Private Sub lblUserSetAllPerm_Click()
    Dim i As Long
    With igUserPerm
        For i = 1 To .RowCount
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                .CellCheckState(i, "can_view") = igCheckStateChecked
                .CellCheckState(i, "can_create") = igCheckStateChecked
                .CellCheckState(i, "can_update") = igCheckStateChecked
                .CellCheckState(i, "can_delete") = igCheckStateChecked
                
                If .CellValue(i, "row_stat") = ST_NORMAL Then
                    .CellValue(i, "row_stat") = ST_UPDATE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub

Private Sub lblUserSetViewPerm_Click()
    Dim i As Long
    With igUserPerm
        For i = 1 To .RowCount
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                .CellCheckState(i, "can_view") = igCheckStateChecked
                .CellCheckState(i, "can_create") = igCheckStateUnchecked
                .CellCheckState(i, "can_update") = igCheckStateUnchecked
                .CellCheckState(i, "can_delete") = igCheckStateUnchecked
                
                If .CellValue(i, "row_stat") = ST_NORMAL Then
                    .CellValue(i, "row_stat") = ST_UPDATE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub

Private Sub lblAddUserForm_Click()
    Dim i As Long, j As Long, k As Long
    Dim loginID As String, userName As String, formID As String, formName As String
    Dim isExist As Boolean
    Dim newRow As Long
    
    ' 성능 향상을 위해 Redraw 일시 중지
    igUserPerm.BeginUpdate

    ' Role 루프
    For i = 1 To igUser.RowCount
        If igUser.CellCheckState(i, "user_check") = igCheckStateChecked Then
            loginID = igUser.CellValue(i, "login_id")
            userName = igUser.CellValue(i, "user_name")
            
            ' Form 루프
            For j = 1 To igFormP3.RowCount
                If igFormP3.CellCheckState(j, "form_check") = igCheckStateChecked Then
                    formID = igFormP3.CellValue(j, "form_id")
                    formName = igFormP3.CellValue(j, "form_name")
                    
                    ' 중복 체크
                    isExist = False
                    For k = 1 To igUserPerm.RowCount
                        If igUserPerm.CellValue(k, "login_id") = loginID And _
                           igUserPerm.CellValue(k, "form_id") = formID Then
                           
                           igUserPerm.CellForeColor(k, "login_id") = vbBlue
                           igUserPerm.CellForeColor(k, "form_id") = vbBlue
                           
                            isExist = True
                            Exit For
                        End If
                    Next k
                    
                    ' 존재하지 않을 때만 추가
                    If Not isExist Then
                        With igUserPerm
                            .RowCount = .RowCount + 1
                            newRow = .RowCount
                            .CellCheckState(newRow, "row_check") = igCheckStateChecked
                            .CellValue(newRow, "row_stat") = ST_NEW
                        
                            .CellValue(newRow, "login_id") = loginID
                            .CellSelectable(newRow, "login_id") = False
                            
                            .CellValue(newRow, "user_name") = userName
                            .CellSelectable(newRow, "user_name") = False
                            
                            .CellValue(newRow, "form_id") = formID
                            .CellSelectable(newRow, "form_id") = False
                            
                            .CellValue(newRow, "form_name") = formName
                            .CellSelectable(newRow, "form_name") = False
                            
                            .CellCheckState(newRow, "can_view") = igCheckStateChecked
                            .CellCheckState(newRow, "can_create") = igCheckStateUnchecked
                            .CellCheckState(newRow, "can_update") = igCheckStateUnchecked
                            .CellCheckState(newRow, "can_delete") = igCheckStateUnchecked
                        End With
                    End If
                End If
            Next j
        End If
    Next i
    
    igUserPerm.EndUpdate
    
    igUserPerm.Refresh

    MsgBox "선택된 조합이 추가되었습니다.", vbInformation
End Sub

Private Sub lblRemoveUserPerm_Click()
    Dim i As Long
    With igUserPerm
        For i = .RowCount To 1 Step -1
            If .CellCheckState(i, "row_check") = igCheckStateChecked Then
                If .CellValue(i, "row_stat") = ST_NEW Then
                    .RemoveRow i
                Else
                    .CellValue(i, "row_stat") = ST_DELETE
                End If
            End If
        Next i
        .Refresh
    End With
End Sub


' 2.5.2 [+] 버튼: 행 추가
Private Sub lblAdd_Click()
    Dim newRow As Long
    Dim gName As String
    Dim igVar As Object
    
    m_currentPageIndex = MultiPage1.value
    
    Select Case m_currentPageIndex
    Case 0
        Set igVar = igForm
    Case 1
        Set igVar = igRolePerm
    Case 2
        Set igVar = igUserPerm
    End Select
        
    With igVar
        .RowCount = .RowCount + 1
        newRow = .RowCount
        .CellValue(newRow, "row_stat") = ST_NEW
'        .CellValue(newRow, "role") = "User"
'        .CellIcon(newRow, "pass_encrypt") = 6 'Local security policy.bmp
'        .CellValue(newRow, "start_date") = Format(Now, "yyyy-mm-dd")
'        .CellValue(newRow, "end_date") = "9999-12-31"
        .EnsureVisibleRow newRow
        .Refresh
    End With
End Sub

' 2.5.3 [-] 버튼: 삭제 플래그
Private Sub lblDelete_Click()
    Dim igVar As Object
    
    m_currentPageIndex = MultiPage1.value
    
    Select Case m_currentPageIndex
    Case 0
        Set igVar = igForm
    Case 1
        Set igVar = igRolePerm
    Case 2
        Set igVar = igUserPerm
    End Select
    
    With igVar
        If .CurRow > 0 Then
            If .CellValue(.CurRow, "row_stat") = ST_NEW Then
                .RemoveRow .CurRow
            Else
                .CellValue(.CurRow, "row_stat") = ST_DELETE
            End If
        End If
    End With
End Sub

' 2.5.4 Cell값 변경 시 상태 보관
Private Sub igForm_AfterCommitEdit(ByVal lRow As Long, ByVal lCol As Long, ByVal vOldValue As Variant)
    igForm.Refresh
End Sub

Private Sub igRolePerm_AfterCommitEdit(ByVal lRow As Long, ByVal lCol As Long, ByVal vOldValue As Variant)
    igRolePerm.Refresh
End Sub

Private Sub igUserPerm_AfterCommitEdit(ByVal lRow As Long, ByVal lCol As Long, ByVal vOldValue As Variant)
    igUserPerm.Refresh
End Sub

Private Sub igForm_BeforeCommitEdit(ByVal lRow As Long, ByVal lCol As Long, eResult As iGrid750_32x64.EEditResults, ByVal sNewText As String, vNewValue As Variant, ByVal lConvErr As Long, ByVal bCanProceedEditing As Boolean, ByVal lComboListIndex As Long)
    If vNewValue = igForm.CellValue(lRow, lCol) Then Exit Sub
    
    If igForm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igForm.CellValue(lRow, "row_stat") = ST_UPDATE
    End If
    igForm.Refresh
End Sub

Private Sub igRolePerm_BeforeCommitEdit(ByVal lRow As Long, ByVal lCol As Long, eResult As iGrid750_32x64.EEditResults, ByVal sNewText As String, vNewValue As Variant, ByVal lConvErr As Long, ByVal bCanProceedEditing As Boolean, ByVal lComboListIndex As Long)
    If vNewValue = igRolePerm.CellValue(lRow, lCol) Then Exit Sub
    
    If igRolePerm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igRolePerm.CellValue(lRow, "row_stat") = ST_UPDATE
    End If
    igRolePerm.Refresh
End Sub

Private Sub igUserPerm_BeforeCommitEdit(ByVal lRow As Long, ByVal lCol As Long, eResult As iGrid750_32x64.EEditResults, ByVal sNewText As String, vNewValue As Variant, ByVal lConvErr As Long, ByVal bCanProceedEditing As Boolean, ByVal lComboListIndex As Long)
    If vNewValue = igUserPerm.CellValue(lRow, lCol) Then Exit Sub
    
    If igUserPerm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igUserPerm.CellValue(lRow, "row_stat") = ST_UPDATE
    End If
    igUserPerm.Refresh
End Sub

' We need the AfterCellCheckChange event handler only if we have Boolean fields displayed as check boxes in the grid
Private Sub igForm_AfterCellCheckChange(ByVal lRow As Long, ByVal lCol As Long, ByVal eOldCheckState As iGrid750_32x64.ECellCheckState)
    If igForm.CellCheckState(lRow, lCol) = eOldCheckState Then Exit Sub
    
    If igForm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igForm.CellValue(lRow, "row_stat") = ST_UPDATE
        igForm.Refresh
    End If
End Sub

Private Sub igRolePerm_AfterCellCheckChange(ByVal lRow As Long, ByVal lCol As Long, ByVal eOldCheckState As iGrid750_32x64.ECellCheckState)
    If igRolePerm.ColKey(lCol) = "row_check" Then Exit Sub
    If igRolePerm.CellCheckState(lRow, lCol) = eOldCheckState Then Exit Sub

    If igRolePerm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igRolePerm.CellValue(lRow, "row_stat") = ST_UPDATE
        igRolePerm.Refresh
    End If
End Sub

Private Sub igUserPerm_AfterCellCheckChange(ByVal lRow As Long, ByVal lCol As Long, ByVal eOldCheckState As iGrid750_32x64.ECellCheckState)
    If igUserPerm.ColKey(lCol) = "row_check" Then Exit Sub
    If igUserPerm.CellCheckState(lRow, lCol) = eOldCheckState Then Exit Sub

    If igUserPerm.CellValue(lRow, "row_stat") = ST_NORMAL Then
        igUserPerm.CellValue(lRow, "row_stat") = ST_UPDATE
        igUserPerm.Refresh
    End If
End Sub

Private Sub igForm_RowDynamicFormatting(ByVal lRow As Long, oForeColor As Long, oBackColor As Long, oFont As stdole.StdFont)
    If lRow > igForm.RowCount Then Exit Sub
    Select Case igForm.CellValue(lRow, "row_stat")
    Case ST_UPDATE
       oBackColor = RGB(255, 153, 204)
    Case ST_DELETE
        oBackColor = RGB(191, 191, 191)
    Case ST_NEW
        oBackColor = RGB(153, 255, 203)
    End Select
End Sub

Private Sub igRolePerm_RowDynamicFormatting(ByVal lRow As Long, oForeColor As Long, oBackColor As Long, oFont As stdole.StdFont)
    If lRow > igRolePerm.RowCount Then Exit Sub
    Select Case igRolePerm.CellValue(lRow, "row_stat")
    Case ST_UPDATE
       oBackColor = RGB(255, 153, 204)
    Case ST_DELETE
        oBackColor = RGB(191, 191, 191)
    Case ST_NEW
        oBackColor = RGB(153, 255, 203)
    End Select
End Sub

Private Sub igUserPerm_RowDynamicFormatting(ByVal lRow As Long, oForeColor As Long, oBackColor As Long, oFont As stdole.StdFont)
    If lRow > igUserPerm.RowCount Then Exit Sub
    Select Case igUserPerm.CellValue(lRow, "row_stat")
    Case ST_UPDATE
       oBackColor = RGB(255, 153, 204)
    Case ST_DELETE
        oBackColor = RGB(191, 191, 191)
    Case ST_NEW
        oBackColor = RGB(153, 255, 203)
    End Select
End Sub

' 2.5.5 [Apply] 버튼: 일괄 저장 (Insert, Update, Delete)
Private Sub lblApply_Click()

    m_currentPageIndex = MultiPage1.value
    
    Select Case m_currentPageIndex
    Case 0
        Apply_auth_forms
    Case 1
        Apply_auth_role_permissions
    Case 2
        Apply_auth_user_permissions
    End Select
End Sub

Private Sub Apply_auth_forms()
    Dim i As Long
    Dim sql As String
    Dim row_stat As String
    
    Application.Cursor = xlWait
    
    Call OpenDB
    On Error GoTo ErrRollback
    conn.BeginTrans
    
    With igForm
        For i = 1 To .RowCount
            row_stat = .CellValue(i, "row_stat")
            
            Select Case row_stat
                Case ST_NEW
                    sql = "INSERT INTO auth_forms (form_id, form_name, created_by) VALUES (" & _
                          "'" & .CellValue(i, "form_id") & "', '" & .CellValue(i, "form_name") & "', '" & CurrentUserID & "')"
                    conn.Execute sql

                Case ST_UPDATE
                    sql = "UPDATE auth_forms SET form_name='" & .CellValue(i, "form_name") & "', " & _
                          "updated_by='" & CurrentUserID & "' " & _
                          "WHERE form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql

                Case ST_DELETE
                    sql = "DELETE auth_forms WHERE form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql
            End Select
        Next i
    End With
    
    conn.CommitTrans
    MsgBox "변경사항이 성공적으로 반영되었습니다.", vbInformation
    Call LoadGridData
    Application.Cursor = xlDefault
    Exit Sub

ErrRollback:
    conn.RollbackTrans
    MsgBox "저장 중 오류 발생: " & Err.Description, vbCritical
    Call CloseDB
    Application.Cursor = xlDefault
End Sub

Private Sub Apply_auth_role_permissions()
    Dim i As Long
    Dim sql As String
    Dim row_stat As String
    
    Application.Cursor = xlWait
    
    Call OpenDB
    On Error GoTo ErrRollback
    conn.BeginTrans
    
    With igRolePerm
        For i = 1 To .RowCount
            row_stat = .CellValue(i, "row_stat")
            
            Select Case row_stat
                Case ST_NEW
                    sql = "INSERT INTO auth_role_permissions (role, form_id, can_view, can_create, can_update, can_delete, created_by) VALUES (" & _
                          "'" & .CellValue(i, "role") & "', " & _
                          "'" & .CellValue(i, "form_id") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_view") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_create") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_update") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_delete") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & CurrentUserID & "')"
                    conn.Execute sql

                Case ST_UPDATE
                    sql = "UPDATE auth_role_permissions SET " & _
                          " can_view='" & IIf(.CellCheckState(i, "can_view") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_create='" & IIf(.CellCheckState(i, "can_create") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_update='" & IIf(.CellCheckState(i, "can_update") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_delete='" & IIf(.CellCheckState(i, "can_delete") = igCheckStateChecked, "Y", "N") & "' " & _
                          " updated_by='" & CurrentUserID & "' " & _
                          "WHERE role='" & .CellValue(i, "role") & "' " & _
                          "  AND form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql

                Case ST_DELETE
                    sql = "DELETE auth_role_permissions WHERE role='" & .CellValue(i, "role") & "' and form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql
            End Select
        Next i
    End With
    
    conn.CommitTrans
    MsgBox "변경사항이 성공적으로 반영되었습니다.", vbInformation
    Call LoadGridData
    Application.Cursor = xlDefault
    Exit Sub

ErrRollback:
    conn.RollbackTrans
    MsgBox "저장 중 오류 발생: " & Err.Description, vbCritical
    Call CloseDB
    Application.Cursor = xlDefault
End Sub

Private Sub Apply_auth_user_permissions()
    Dim i As Long
    Dim sql As String
    Dim row_stat As String
    
    Application.Cursor = xlWait
    
    Call OpenDB
    On Error GoTo ErrRollback
    conn.BeginTrans
    
    With igUserPerm
        For i = 1 To .RowCount
            row_stat = .CellValue(i, "row_stat")
            
            Select Case row_stat
                Case ST_NEW
                    sql = "INSERT INTO auth_user_permissions (login_id, form_id, can_view, can_create, can_update, can_delete, created_by) VALUES (" & _
                          "'" & .CellValue(i, "login_id") & "', " & _
                          "'" & .CellValue(i, "form_id") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_view") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_create") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_update") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & IIf(.CellCheckState(i, "can_delete") = igCheckStateChecked, "Y", "N") & "', " & _
                          "'" & CurrentUserID & "')"
                    conn.Execute sql

                Case ST_UPDATE
                    sql = "UPDATE auth_user_permissions SET " & _
                          " can_view='" & IIf(.CellCheckState(i, "can_view") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_create='" & IIf(.CellCheckState(i, "can_create") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_update='" & IIf(.CellCheckState(i, "can_update") = igCheckStateChecked, "Y", "N") & "' " & _
                          " can_delete='" & IIf(.CellCheckState(i, "can_delete") = igCheckStateChecked, "Y", "N") & "' " & _
                          " updated_by='" & CurrentUserID & "' " & _
                          "WHERE login_id='" & .CellValue(i, "login_id") & "' " & _
                          "  AND form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql

                Case ST_DELETE
                    sql = "DELETE auth_user_permissions WHERE login_id='" & .CellValue(i, "login_id") & "' and form_id='" & .CellValue(i, "form_id") & "'"
                    conn.Execute sql
            End Select
        Next i
    End With
    
    conn.CommitTrans
    MsgBox "변경사항이 성공적으로 반영되었습니다.", vbInformation
    Call LoadGridData
    Application.Cursor = xlDefault
    Exit Sub

ErrRollback:
    conn.RollbackTrans
    MsgBox "저장 중 오류 발생: " & Err.Description, vbCritical
    Call CloseDB
    Application.Cursor = xlDefault
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

'
'2. 탭별 상세 설계안
'Tab 1: 화면 마스터 관리 (Form Master)
'시스템에 존재하는 모든 UserForm 객체를 등록하는 기초 단계입니다.
'
'그리드 구성 (iGrid): form_id (VBA 객체명), form_name (한글 명칭), is_use (사용여부)
'
'특징: 신규 화면 개발 시 이곳에 등록해야 권한 제어 대상에 포함됩니다.
'
'Tab 2: 역할별 권한 설정 (Role Permissions)
'특정 역할(ADMIN, USER, VIEWER 등)에 대해 모든 화면의 기본 권한을 설정합니다.
'
'상단 필터: 대상 역할(Role) 선택 콤보박스 (예: '영업팀')
'
'그리드 구성: form_name을 행으로 나열하고, 조회, 신규, 수정, 삭제 컬럼을 체크박스 형태로 구성합니다.
'
'시니어 Tip: '모든 권한 부여' 버튼을 추가하여 편의성을 높입니다.
'
'Tab 3: 사용자별 예외 권한 (User Overrides)
'특정 사용자에게 역할 권한과 다른 '예외적 권한'을 부여합니다.
'
'상단 필터: 사용자 검색(로그인 ID 또는 성명)
'
'그리드 특징 (중요): * 각 권한(V/C/U/D)을 **3가지 상태(Tri-state)**로 관리합니다.
'
'[상태 1: 상속] 역할 권한을 그대로 따름 (DB 값: NULL)
'
'[상태 2: 허용] 역할 권한과 무관하게 허용 (DB 값: 'Y')
'
'[상태 3: 차단] 역할 권한과 무관하게 차단 (DB 값: 'N')
'
'시각적 효과: '상속' 상태일 때는 현재 역할로부터 내려받는 권한이 무엇인지 회색 글씨로 보여주면 직관적입니다.
'
'3. 데이터 처리 및 저장 로직 (VBA & SQL)
'권한 설정은 항목이 많으므로 하나씩 저장하기보다 JSON 일괄 저장 방식을 사용하는 것이 네트워크 환경에서 가장 빠릅니다.
'
'① 일괄 저장 로직 (Apply 버튼 클릭 시)
'현재 선택된 탭이 무엇인지 확인합니다.
'
'iGrid에서 변경된 행(row_status가 'U' 또는 'I'인 행)만 추출하여 JSON 문자열을 생성합니다.
'
'앞서 만든 sp_save_auth_json과 같은 프로시저를 호출하여 한 번에 DB를 업데이트합니다.
'
'② 권한 복사 기능 (Admin 전용)
'신규 사용자나 신규 역할을 만들 때, 기존 유사한 권한을 가진 사용자/역할로부터 '권한 복사(Copy Permissions)' 기능을 추가하면 운영 공수가 획기적으로 줄어듭니다.
'
'4. 권한 관리 UI 구현 시 주의사항
'동적 리로드: 관리자가 권한을 수정하고 저장하면, 해당 정보가 DB에 즉시 반영되지만 현재 로그인 중인 사용자의 세션에는 즉시 반영되지 않을 수 있습니다. (재로그인 필요 메시지 또는 실시간 권한 갱신 로직 검토)
'
'보안: 이 화면(frmAuthManagement) 자체에 대한 접근 권한은 오직 ADMIN 역할 중에서도 극소수에게만 부여되도록 하드코딩 또는 별도 보안 처리가 되어야 합니다.
'
'데이터 무결성: auth_forms에서 특정 화면을 삭제할 때, 해당 화면에 연결된 모든 역할/사용자 권한 데이터도 삭제되도록 ON DELETE CASCADE 설정을 DB 수준에서 처리해야 합니다.
