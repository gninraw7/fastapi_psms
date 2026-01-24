Attribute VB_Name = "FrmProjectList"
Option Explicit

' =====================================================
' VBA + FastAPI + MySQL 방식 프로젝트 목록 폼
' 실제 DB 스키마에 맞춰 수정됨
' =====================================================

' 페이지 관련 변수
Private mCurrentPage As Long
Private mTotalRecords As Long
Private mTotalPages As Long
Private mPageSize As Long

Private mInit_Complete As Boolean

Private Const REG_PROJECT_LIST_PATH As String = "HKEY_CURRENT_USER\Software\PSMS\FrmProjectList\"

Private Sub UserForm_Initialize()
    mInit_Complete = False
    
    Call g_image_Init
    Call ApplyModernTheme(Me)
    Call SetLayout
    Call LoadCombos  ' FastAPI로 콤보박스 데이터 로드
    Call InitGrid
    
    ' 레지스트리에서 이전 설정 복원
    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")
    
    On Error Resume Next
    cmbField.Value = wsh.RegRead(REG_PROJECT_LIST_PATH & "FIELD")
    txtSearch.Text = wsh.RegRead(REG_PROJECT_LIST_PATH & "Search")
    cmbStage.Value = wsh.RegRead(REG_PROJECT_LIST_PATH & "STAGE")
    cmbManager.Value = wsh.RegRead(REG_PROJECT_LIST_PATH & "MANAGER")
    cmbCountPerPage.Value = wsh.RegRead(REG_PROJECT_LIST_PATH & "CountPerPage")
    Set wsh = Nothing
    On Error GoTo 0
    
    mInit_Complete = True
    
    ' 데이터 로드 (FastAPI 호출)
    LoadGridData
End Sub

' =====================================================
' 콤보박스 데이터 로드 (FastAPI 호출)
' =====================================================
Private Sub LoadCombos()
    ' FIELD 콤보박스 (사업분야)
    SetComboFromAPI cmbField, "FIELD"
    
    ' STAGE 콤보박스 (진행단계)
    SetComboFromAPI cmbStage, "STAGE"
    
    ' 담당자 콤보박스
    SetCmbManager
    
    ' 페이지당 조회 수
    With cmbCountPerPage
        .Clear
        .AddItem "25"
        .AddItem "35"
        .AddItem "45"
        .AddItem "50"
        .AddItem "100"
        .AddItem "200"
        .ListIndex = 0
    End With
End Sub

' =====================================================
' FastAPI에서 콤보박스 데이터 가져오기
' =====================================================
Private Sub SetComboFromAPI(ctrl As Object, groupCode As String)
    Dim response As Object
    Dim item As Object
    
    ' FastAPI 호출
    Set response = ModFastAPI.HttpGet("/projects/combo/" & groupCode)
    
    If response Is Nothing Then
        MsgBox "콤보박스 데이터 로드 실패: " & groupCode, vbCritical
        Exit Sub
    End If
    
    ' 콤보박스 설정
    With ctrl
        .Clear
        .ColumnCount = 2
        .BoundColumn = 1
        .TextColumn = 2
        .ColumnWidths = "0pt;70pt"
    End With
    
    ' 빈 항목 추가
    ctrl.AddItem ""
    ctrl.List(ctrl.ListCount - 1, 1) = ""
    ctrl.ListIndex = 0
    
    ' API 응답 데이터 추가
    If Not response Is Nothing Then
        If response.Exists("items") Then
            For Each item In response("items")
                ctrl.AddItem item("code")
                ctrl.List(ctrl.ListCount - 1, 1) = item("code_name")
                
                ' iGrid 콤보에도 추가 (콤보가 있는 경우)
                On Error Resume Next
                igProject.Combos(groupCode).AddItem _
                    sItemText:=item("code_name"), _
                    vItemValue:=item("code")
                On Error GoTo 0
            Next item
        End If
    End If
End Sub

' =====================================================
' 담당자 콤보박스 로드 (FastAPI 호출)
' =====================================================
Private Sub SetCmbManager()
    Dim response As Object
    Dim item As Object
    
    ' FastAPI 호출
    Set response = ModFastAPI.HttpGet("/projects/managers")
    
    If response Is Nothing Then
        MsgBox "담당자 목록 로드 실패", vbCritical
        Exit Sub
    End If
    
    ' 콤보박스 설정
    With cmbManager
        .Clear
        .ColumnCount = 2
        .BoundColumn = 1
        .TextColumn = 2
        .ColumnWidths = "0pt;100pt"
    End With
    
    ' 빈 항목 추가
    cmbManager.AddItem ""
    cmbManager.List(cmbManager.ListCount - 1, 1) = ""
    cmbManager.ListIndex = 0
    
    ' API 응답 데이터 추가
    If response.Exists("items") Then
        For Each item In response("items")
            cmbManager.AddItem item("login_id")
            ' 부서/팀 정보도 표시
            Dim displayName As String
            displayName = item("user_name")
            If Not IsNull(item("department")) And item("department") <> "" Then
                displayName = displayName & " (" & item("department")
                If Not IsNull(item("team")) And item("team") <> "" Then
                    displayName = displayName & "/" & item("team")
                End If
                displayName = displayName & ")"
            End If
            cmbManager.List(cmbManager.ListCount - 1, 1) = displayName
        Next item
    End If
End Sub

' =====================================================
' 그리드 데이터 로드 (FastAPI 호출)
' 실제 스키마 필드명 사용
' =====================================================
Private Sub LoadGridData()
    Dim params As Object
    Dim response As Object
    Dim item As Object
    Dim rowIndex As Long
    
    ' 페이지 크기 설정
    If IsNumeric(cmbCountPerPage.Value) Then
        mPageSize = CLng(cmbCountPerPage.Value)
    Else
        mPageSize = 25
    End If
    
    ' API 요청 파라미터 구성
    Set params = CreateObject("Scripting.Dictionary")
    params("page") = mCurrentPage
    params("page_size") = mPageSize
    
    ' 검색 조건 추가
    If txtSearch.Text <> "" Then
        params("search_field") = "project_name"  ' 또는 "customer_name"
        params("search_text") = txtSearch.Text
    End If
    
    ' 사업분야 필터
    If cmbField.Value <> "" Then
        params("field_code") = cmbField.Value
    End If
    
    ' 진행단계 필터
    If cmbStage.Value <> "" Then
        params("current_stage") = cmbStage.Value
    End If
    
    ' 담당자 필터
    If cmbManager.Value <> "" Then
        params("manager_id") = cmbManager.Value
    End If
    
    ' FastAPI 호출
    Set response = ModFastAPI.HttpGet("/projects/list", params)
    
    If response Is Nothing Then
        MsgBox "데이터 로드 실패", vbCritical
        Exit Sub
    End If
    
    ' 페이징 정보 업데이트
    mTotalRecords = response("total_records")
    mTotalPages = response("total_pages")
    mCurrentPage = response("current_page")
    
    ' 그리드 초기화
    igProject.Redraw = False
    igProject.Rows.Clear
    
    ' 데이터 채우기 (실제 스키마 필드명)
    If response.Exists("items") Then
        rowIndex = 1
        For Each item In response("items")
            igProject.Rows.Add
            
            With igProject
                .CellValue(rowIndex, "pipeline_id") = GetValue(item, "pipeline_id")
                .CellValue(rowIndex, "project_name") = GetValue(item, "project_name")
                .CellValue(rowIndex, "customer_name") = GetValue(item, "customer_name")
                .CellValue(rowIndex, "ordering_party_name") = GetValue(item, "ordering_party_name")
                .CellValue(rowIndex, "field_code") = GetValue(item, "field_code")
                .CellValue(rowIndex, "field_name") = GetValue(item, "field_name")
                .CellValue(rowIndex, "current_stage") = GetValue(item, "current_stage")
                .CellValue(rowIndex, "stage_name") = GetValue(item, "stage_name")
                .CellValue(rowIndex, "manager_name") = GetValue(item, "manager_name")
                .CellValue(rowIndex, "quoted_amount") = GetValue(item, "quoted_amount")
                .CellValue(rowIndex, "contract_amount") = GetValue(item, "contract_amount")
                .CellValue(rowIndex, "contract_date") = GetValue(item, "contract_date")
                .CellValue(rowIndex, "start_date") = GetValue(item, "start_date")
                .CellValue(rowIndex, "end_date") = GetValue(item, "end_date")
            End With
            
            rowIndex = rowIndex + 1
        Next item
    End If
    
    igProject.Redraw = True
    
    ' 페이지 정보 표시
    UpdatePageInfo
End Sub

' =====================================================
' Dictionary에서 안전하게 값 가져오기
' =====================================================
Private Function GetValue(dict As Object, key As String) As Variant
    If dict.Exists(key) Then
        If IsNull(dict(key)) Then
            GetValue = ""
        Else
            GetValue = dict(key)
        End If
    Else
        GetValue = ""
    End If
End Function

' =====================================================
' 페이지 정보 업데이트
' =====================================================
Private Sub UpdatePageInfo()
    lblPageInfo.Caption = mCurrentPage & " / " & mTotalPages & " 페이지 (총 " & mTotalRecords & "건)"
    
    ' 페이지 버튼 활성화/비활성화
    lblFirst.Enabled = (mCurrentPage > 1)
    lblPrev.Enabled = (mCurrentPage > 1)
    lblNext.Enabled = (mCurrentPage < mTotalPages)
    lblLast.Enabled = (mCurrentPage < mTotalPages)
End Sub

' =====================================================
' 페이징 버튼 이벤트
' =====================================================
Private Sub lblFirst_Click()
    If mCurrentPage > 1 Then
        mCurrentPage = 1
        LoadGridData
    End If
End Sub

Private Sub lblPrev_Click()
    If mCurrentPage > 1 Then
        mCurrentPage = mCurrentPage - 1
        LoadGridData
    End If
End Sub

Private Sub lblNext_Click()
    If mCurrentPage < mTotalPages Then
        mCurrentPage = mCurrentPage + 1
        LoadGridData
    End If
End Sub

Private Sub lblLast_Click()
    If mCurrentPage < mTotalPages Then
        mCurrentPage = mTotalPages
        LoadGridData
    End If
End Sub

' =====================================================
' 검색 조건 변경 이벤트
' =====================================================
Private Sub cmbCountPerPage_Change()
    If Not mInit_Complete Then Exit Sub
    mCurrentPage = 1
    LoadGridData
    SaveRegistry "CountPerPage", Me.cmbCountPerPage.Value
End Sub

Private Sub txtSearch_AfterUpdate()
    If Not mInit_Complete Then Exit Sub
    mCurrentPage = 1
    LoadGridData
    SaveRegistry "Search", Me.txtSearch.Text
End Sub

Private Sub cmbField_Change()
    If Not mInit_Complete Then Exit Sub
    mCurrentPage = 1
    LoadGridData
    SaveRegistry "FIELD", Me.cmbField.Value
End Sub

Private Sub cmbManager_Change()
    If Not mInit_Complete Then Exit Sub
    mCurrentPage = 1
    LoadGridData
    SaveRegistry "MANAGER", Me.cmbManager.Value
End Sub

Private Sub cmbStage_Change()
    If Not mInit_Complete Then Exit Sub
    mCurrentPage = 1
    LoadGridData
    SaveRegistry "STAGE", Me.cmbStage.Value
End Sub

' =====================================================
' 레지스트리 저장
' =====================================================
Private Sub SaveRegistry(keyName As String, Value As String)
    On Error Resume Next
    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")
    wsh.RegWrite REG_PROJECT_LIST_PATH & keyName, Value, "REG_SZ"
    Set wsh = Nothing
End Sub

' =====================================================
' 조회 버튼
' =====================================================
Private Sub lblQuery_Click()
    mCurrentPage = 1
    LoadGridData
End Sub

' =====================================================
' 추가 버튼
' =====================================================
Private Sub lblAdd_Click()
    Dim frm As New FrmProjectHistory
    
    frm.SetInitialData ""
    
    With frm
        .SetCaller Me, Me.igProject
        .Show vbModal
    End With
    
    Unload frm
    LoadGridData
End Sub

' =====================================================
' 수정 버튼
' =====================================================
Private Sub lblUpdate_Click()
    If igProject.CurRow < 1 Then
        MsgBox "선택된 행이 없습니다."
        Exit Sub
    End If
    
    Call_FrmProjectMgmt igProject.CellValue(igProject.CurRow, "pipeline_id")
End Sub

' =====================================================
' 더블클릭으로 상세 보기
' =====================================================
Private Sub igProject_DblClick(ByVal Button As Integer, ByVal Shift As Integer, _
    ByVal x As Single, ByVal y As Single, ByVal lRowIfAny As Long, _
    ByVal lColIfAny As Long, eAction As iGrid750_32x64.EDblClickAction)
    
    Call_FrmProjectMgmt igProject.CellValue(lRowIfAny, "pipeline_id")
End Sub

Private Sub Call_FrmProjectMgmt(pipeline_id As String)
    If pipeline_id = "" Then Exit Sub
    
    Dim frm As New FrmProjectHistory
    
    frm.SetInitialData pipeline_id
    
    With frm
        .SetCaller Me, Me.igProject
        .Show vbModal
    End With
    
    Unload frm
    LoadGridData
End Sub

' =====================================================
' UI 레이아웃 설정
' =====================================================
Private Sub SetLayout()
    With lblHeader
        .BackColor = RGB(47, 85, 151)
        .ForeColor = vbWhite
        .Font.Name = "맑은 고딕"
        .Font.Bold = True
        .Font.Size = 14
    End With
    
    SetToolbarStyle fraToolbar
    
    fraToolbar.Width = Me.InsideWidth
    With fraBorder
        .Left = 0
        .Top = lblHeader.Height + fraToolbar.Height
        .Height = 1
        .Width = Me.InsideWidth
    End With
    
    Dim rightMargin As Single: rightMargin = Me.fraToolbar.Width - 30
    With Me.lblAdd: .Left = rightMargin - .Width - 10: End With
    With Me.lblUpdate: .Left = Me.lblAdd.Left - .Width - 10: End With
    With Me.lblQuery: .Left = Me.lblUpdate.Left - .Width - 10: End With
    
    Me.lblQuery.Width = 26
    Me.lblAdd.Width = 26
    Me.lblUpdate.Caption = ""
    Me.lblUpdate.Width = 26
    
    SetCachedImage Me.lblQuery, "RefreshData", 32
    SetCachedImage Me.lblAdd, "TableRowsInsertBelowExcel", 32
    SetCachedImage Me.lblUpdate, "EditFormGallery", 32
End Sub
