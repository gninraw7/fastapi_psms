VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FrmNoticeList 
   Caption         =   "게시판 목록 조회"
   ClientHeight    =   10076
   ClientLeft      =   110
   ClientTop       =   440
   ClientWidth     =   15983
   OleObjectBlob   =   "FrmNoticeList.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "FrmNoticeList"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' 페이징 관련 변수
Private mCurrentPage As Long
Private mTotalRecords As Long
Private mTotalPages As Long
Private mPageSize As Long

'Private m_objImageList As CImageList

Private Sub UserForm_Initialize()
    Call g_image_Init
    ' 1. 모던 디자인 테마 적용 (공통 모듈 함수 호출)
    Call ApplyModernTheme(Me)
    ' 2. 화면 전용 초기화
    Call SetLayout ' 프레임 위치 및 크기 조정
    'Call SetImageList
    Call InitGrid   ' iGrid 7.50 초기화
    Call LoadCombo
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

    ' [추가] 아이콘 위치 (가장 우측)
    With Me.lblAdd: .Left = rightMargin - .Width - 10: End With
    With Me.lblQuery: .Left = Me.lblAdd.Left - .Width - 10: End With
    
    Me.lblQuery.Width = 26
    Me.lblAdd.Width = 26
    
    SetCachedImage Me.lblQuery, "RefreshData", 32
    SetCachedImage Me.lblAdd, "TableRowsInsertBelowExcel", 32
    
'    ' 기존 SetLayout 프로시저 내부에 추가
'    ' 위치 기준: lblFirst < lblPrev < [PageInfo] > lblNext > lblLast
'
'    Dim gap As Single
'    gap = 5 ' 컨트롤 간격 (5 포인트)
'
'    ' 1. 중앙의 페이지 정보 라벨 위치 고정 (디자인 뷰 위치 기준)
'    ' (만약 폼 중앙에 두고 싶다면 아래 코드 주석 해제)
'    ' lblPageInfo.Left = (fraBorder.Width - lblPageInfo.Width) / 2
'
'    ' 2. [이전] 버튼 배치 (PageInfo 왼쪽)
'    lblPrev.Top = lblPageInfo.Top + (lblPageInfo.Height - lblPrev.Height) / 2
'    lblPrev.Left = lblPageInfo.Left - lblPrev.Width - gap
'
'    ' 3. [처음] 버튼 배치 (Prev 왼쪽)
'    lblFirst.Top = lblPrev.Top
'    lblFirst.Left = lblPrev.Left - lblFirst.Width - gap
'
'    ' 4. [다음] 버튼 배치 (PageInfo 오른쪽)
'    lblNext.Top = lblPrev.Top
'    lblNext.Left = lblPageInfo.Left + lblPageInfo.Width + gap
'
'    ' 5. [마지막] 버튼 배치 (Next 오른쪽)
'    lblLast.Top = lblNext.Top
'    lblLast.Left = lblNext.Left + lblNext.Width + gap
End Sub

'Private Sub SetImageList()
'
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
'End Sub

Private Sub LoadCombo()

    ' 검색 조건 콤보박스
    With cmbSearch
        .ColumnCount = 2
        .ColumnWidths = "70pt;0pt"
        .BoundColumn = 2
        .TextColumn = 1
        
        .AddItem "제목"
        .List(0, 1) = "title"
        
        .AddItem "내용"
        .List(1, 1) = "content"
        
        .AddItem "작성자"
        .List(2, 1) = "author_id"
        
        .ListIndex = 0 ' 기본값: 제목
    End With
    
    ' 카테고리 콤보박스 (DB에서 distinct category 가져오는 로직 추가 가능, 여기선 하드코딩 예시)
    With cmbCategory
        .AddItem "전체"
        .AddItem "SYSTEM"
        .AddItem "GENERAL"
        .AddItem "URGENT"
        .ListIndex = 0
    End With
    ''SetCombos igUser, "CATEGORY"
    
    ' 페이지당 조회 수
    With cmbCountPerPage
        .AddItem "15"
        .AddItem "20"
        .AddItem "25"
        .AddItem "50"
        .ListIndex = 0 ' 기본값 15개
    End With
    
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
    gpSetModernLook igNotice
    
    With igNotice
        .BeginUpdate
        .Clear True
        .ShowControlsInAllCells = True
        .FlatCellControls = True
'        .DrawRowText = True ' display row text cells which show message preview

        '.SetImageList m_objImageList.hImageList
        
        .DynamicContentEvents = igDCEventCellDynamicText Or _
            igDCEventCellDynamicFormatting Or igDCEventRowDynamicFormatting
        
        .AddCol sKey:="notice_id", sheader:="번호", lWidth:=60, eHeaderAlignH:=igAlignHCenter
        .AddCol sKey:="title", sheader:="제목", lWidth:=500, eHeaderAlignH:=igAlignHCenter
        .AddCol sKey:="category", sheader:="구분", lWidth:=120, eHeaderAlignH:=igAlignHCenter
        .AddCol sKey:="author_id", sheader:="작성자", lWidth:=100, eHeaderAlignH:=igAlignHCenter
        With .AddCol(sKey:="start_date", sheader:="등록일", lWidth:=110)
            .sFmtString = "yyyy-mm-dd"
            .eAlignH = igAlignHCenter
        End With
        With .AddCol(sKey:="view_count", sheader:="조회수", lWidth:=60)
            .sFmtString = "#,##0"
            .eAlignH = igAlignHRight
        End With
        
        With .ColDefaultCell(.RowTextCol)
           ' specify some parameters of the message preview text:
           .oForeColor = RGB(0, 90, 200)
           .oBackColor = RGB(245, 248, 255)
'           .oFont.Name = "맑은 고딕"
'           .oFont.Size = 9
           ' use word wrapping and display ellipsis for truncated texts
           ' (igTextEditControl should be used together with igTextEndEllipsis in this case):
           .eTextFlags = igTextWordBreak Or igTextEndEllipsis Or igTextEditControl
        End With
        .ColKey(.RowTextCol) = "content" ' will use this synonym for better understanding
        
        .RowMode = True
        .EndUpdate
    End With
End Sub

' 2.2 [조회] 및 ListBox 선택 시 데이터 표시
Private Sub lblQuery_Click()
    Application.Cursor = xlWait
    
    mCurrentPage = 1

    Call LoadGridData
    Application.Cursor = xlDefault
End Sub

Private Sub LoadGridData()
    Dim rs As ADODB.Recordset
    Dim rsFixed As ADODB.Recordset
    Dim strSQL As String
    Dim strWhere As String
    Dim i As Long
    Dim iRow As Long
    
    ' 1. 검색 조건 빌드 (SQL Injection 방지 처리 필요하나 여기선 기본 문자열 조합)
    strWhere = " WHERE 1=1 "
    
    ' 카테고리 필터
    If cmbCategory.Text <> "전체" Then
        strWhere = strWhere & " AND category = '" & cmbCategory.Text & "'"
    End If
    
    ' 검색어 필터
    If Trim(txtSearch.Text) <> "" Then
        Dim searchField As String
        ' 콤보박스의 2번째 컬럼(필드명)을 가져온다고 가정. 안되면 Select Case 사용
        If cmbSearch.ListIndex > -1 Then
             ' cmbSearch에 ColumnCount=2 설정 필요
             ' 만약 설정 안했다면 Select Case로 매핑
             Select Case cmbSearch.Text
                Case "제목": searchField = "title"
                Case "내용": searchField = "content"
                Case "작성자": searchField = "author_id"
             End Select
        End If
        strWhere = strWhere & " AND " & searchField & " LIKE '%" & Trim(txtSearch.Text) & "%'"
    End If
    
    ' 2. DB 연결
    Call OpenDB
   
    mPageSize = CLng(cmbCountPerPage.Text)
    
    ' 3. [일반 게시물] 전체 레코드 수 조회 (페이징 계산용, is_fixed = 'N')
    strSQL = "SELECT COUNT(*) FROM board_notices " & strWhere & " AND is_fixed = 'N'"
    
    Set rs = conn.Execute(strSQL)
    
    mTotalRecords = rs(0)
    rs.Close
    
    ' 총 페이지 계산
    If mTotalRecords = 0 Then
        mTotalPages = 1
    Else
        mTotalPages = Int((mTotalRecords - 1) / mPageSize) + 1
    End If
    
    ' 현재 페이지 보정
    If mCurrentPage > mTotalPages Then mCurrentPage = mTotalPages
    If mCurrentPage < 1 Then mCurrentPage = 1
    
    ' ----------------------------------------------------------------------------
    ' iGrid 렌더링 시작
    ' ----------------------------------------------------------------------------
    With igNotice
        .BeginUpdate
        .Clear
        
        ' A. [상단 고정 게시물] 조회 (is_fixed = 'Y', 최대 5개)
        ' 검색 조건은 무시하고 항상 표시하거나, 검색조건을 포함할지는 기획 의도에 따름.
        ' 여기서는 "모든 페이지 상단에 우선 배치"이므로 검색 조건과 무관하게 전체 공지로 가정.
        ' 만약 검색 조건에 맞는 공지만 띄우려면 strWhere 사용.
        strSQL = "SELECT notice_id, title, content, category, author_id, start_date, view_count " & _
                 "FROM board_notices " & _
                 "WHERE is_fixed = 'Y' " & _
                 "ORDER BY notice_id DESC LIMIT 5"
        Call OpenDB
        Set rsFixed = conn.Execute(strSQL)
        
        Do Until rsFixed.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "notice_id") = NVL(rsFixed!notice_id)
            .CellAlignH(i, "notice_id") = igAlignHCenter
            .CellBackColor(i, "notice_id") = RGB(255, 250, 230) ' 연한 노란색

            .CellValue(i, "title") = "[공지] " & NVL(rsFixed!title)
            .CellBackColor(i, "title") = RGB(255, 250, 230) ' 연한 노란색
            .CellFont(i, "title").Bold = True

            .CellValue(i, "category") = NVL(rsFixed!Category)
            .CellAlignH(i, "category") = igAlignHCenter
            .CellBackColor(i, "category") = RGB(255, 250, 230) ' 연한 노란색
            
            
            .CellValue(i, "author_id") = NVL(rsFixed!author_id)
            .CellAlignH(i, "author_id") = igAlignHCenter
            .CellBackColor(i, "author_id") = RGB(255, 250, 230) ' 연한 노란색
            
            .CellValue(i, "start_date") = NVL(rsFixed!start_date)
            .CellAlignH(i, "start_date") = igAlignHCenter
            .CellBackColor(i, "start_date") = RGB(255, 250, 230) ' 연한 노란색
            
            .CellValue(i, "view_count") = NVL(rsFixed!view_count)
            .CellBackColor(i, "view_count") = RGB(255, 250, 230) ' 연한 노란색
            
            .CellValue(i, .RowTextCol) = rsFixed!content
            
            .AutoHeightRow i
            
            .RowTag(i) = "FIXED"

            rsFixed.MoveNext
        Loop
        rsFixed.Close
    
        ' B. [일반 게시물] 조회 (is_fixed = 'N', 페이징 적용)
        ' MySQL LIMIT offset, count
        Dim offset As Long
        offset = (mCurrentPage - 1) * mPageSize
        
        strSQL = "SELECT notice_id, title, content, category, author_id, start_date, view_count " & _
                 "FROM board_notices " & _
                 strWhere & " AND is_fixed = 'N' " & _
                 "ORDER BY notice_id DESC " & _
                 "LIMIT " & offset & ", " & mPageSize
                 
        Set rs = conn.Execute(strSQL)
        
        Do Until rs.EOF
            .AddRow
            i = .RowCount
            .CellValue(i, "notice_id") = NVL(rs!notice_id)
            .CellAlignH(i, "notice_id") = igAlignHCenter

            .CellValue(i, "title") = NVL(rs!title)

            .CellValue(i, "category") = NVL(rs!Category)
            .CellAlignH(i, "category") = igAlignHCenter
            
            .CellValue(i, "author_id") = NVL(rs!author_id)
            .CellAlignH(i, "author_id") = igAlignHCenter

            .CellValue(i, "start_date") = NVL(rs!start_date)
            .CellAlignH(i, "start_date") = igAlignHCenter
            
            .CellValue(i, "view_count") = NVL(rs!view_count)
            .CellValue(i, .RowTextCol) = rs!content
            
            .AutoHeightRow i

            rs.MoveNext
        Loop
        rs.Close
        
        .AutoHeightRows
        .DefaultRowHeight = .GetOptimalCellHeight()
    
        .EndUpdate
    End With
    
    ' 페이징 컨트롤 업데이트
    UpdatePaginationControls
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
    If Not rsFixed Is Nothing Then
        If rsFixed.State = 1 Then rsFixed.Close ' 1 = adStateOpen
        Set rsFixed = Nothing
    End If

    If Not rs Is Nothing Then
        If rs.State = 1 Then rs.Close ' 1 = adStateOpen
        Set rs = Nothing
    End If
    
    Call CloseDB
End Sub

'Private Sub UpdatePaginationControls()
'    lblPageInfo.caption = mCurrentPage & " / " & mTotalPages
'
'    ' 이전/다음 버튼 활성화 상태 처리 (Label이라 Enabled 속성이 시각적으로 안보일 수 있어 색상 등으로 처리 권장)
'    lblPrev.Enabled = (mCurrentPage > 1)
'    lblNext.Enabled = (mCurrentPage < mTotalPages)
'End Sub

Private Sub UpdatePaginationControls()
    lblPageInfo.caption = mCurrentPage & " / " & mTotalPages
    
    ' 1. [처음/이전] 버튼 상태 처리
    ' 현재 페이지가 1보다 클 때만 활성화
    Dim bCanGoPrev As Boolean
    bCanGoPrev = (mCurrentPage > 1)
    
    lblFirst.Enabled = bCanGoPrev
    lblPrev.Enabled = bCanGoPrev
    
    ' (선택사항) 비활성화 시 시각적 처리 (회색조 등)
    lblFirst.ForeColor = IIf(bCanGoPrev, vbBlack, RGB(200, 200, 200))
    
    ' 2. [다음/마지막] 버튼 상태 처리
    ' 현재 페이지가 총 페이지보다 작을 때만 활성화
    Dim bCanGoNext As Boolean
    bCanGoNext = (mCurrentPage < mTotalPages)
    
    lblNext.Enabled = bCanGoNext
    lblLast.Enabled = bCanGoNext
    
    ' (선택사항) 비활성화 시 시각적 처리
    lblLast.ForeColor = IIf(bCanGoNext, vbBlack, RGB(200, 200, 200))
End Sub

' 2.5.2 [+] 버튼: 행 추가
Private Sub lblAdd_Click()
' FrmNoticeReg 폼을 모달로 열기
    ' FrmNoticeReg.Show vbModal
    ' 등록 후 목록 갱신 필요시:
    ' LoadGridData
    MsgBox "등록 화면 연결 필요", vbInformation
End Sub

' [이전 페이지] Image Label Click
Private Sub lblPrev_Click()
    If mCurrentPage > 1 Then
        mCurrentPage = mCurrentPage - 1
        LoadGridData
    End If
End Sub

' [다음 페이지] Image Label Click
Private Sub lblNext_Click()
    If mCurrentPage < mTotalPages Then
        mCurrentPage = mCurrentPage + 1
        LoadGridData
    End If
End Sub

' [처음 페이지로 이동]
Private Sub lblFirst_Click()
    ' 이미 첫 페이지면 동작 안 함
    If mCurrentPage > 1 Then
        mCurrentPage = 1
        Call LoadGridData
    End If
End Sub

' [마지막 페이지로 이동]
Private Sub lblLast_Click()
    ' 이미 마지막 페이지면 동작 안 함
    If mCurrentPage < mTotalPages Then
        mCurrentPage = mTotalPages
        Call LoadGridData
    End If
End Sub


' [처음] 버튼 마우스 효과
Private Sub lblFirst_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    If lblFirst.Enabled Then
        lblFirst.BackColor = RGB(225, 235, 245) ' 연한 파랑 (Hover)
        lblFirst.BackStyle = fmBackStyleOpaque
    End If
End Sub

' [Prev] 버튼 마우스 효과
Private Sub lblPrev_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    If lblPrev.Enabled Then
        lblPrev.BackColor = RGB(225, 235, 245) ' 연한 파랑 (Hover)
        lblPrev.BackStyle = fmBackStyleOpaque
    End If
End Sub

' [Next] 버튼 마우스 효과
Private Sub lblNext_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    If lblNext.Enabled Then
        lblNext.BackColor = RGB(225, 235, 245) ' 연한 파랑 (Hover)
        lblNext.BackStyle = fmBackStyleOpaque
    End If
End Sub

' [마지막] 버튼 마우스 효과
Private Sub lblLast_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    If lblLast.Enabled Then
        lblLast.BackColor = RGB(225, 235, 245)
        lblLast.BackStyle = fmBackStyleOpaque
    End If
End Sub

' [공통] 프레임이나 폼 배경으로 마우스가 나갔을 때 초기화
' 기존 fraToolbar_MouseMove 혹은 UserForm_MouseMove 등에 추가
Private Sub UserForm_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    ' 기존 초기화 코드에 더해 아래 두 줄 추가
    lblFirst.BackStyle = fmBackStyleTransparent
    lblPrev.BackStyle = fmBackStyleTransparent
    lblNext.BackStyle = fmBackStyleTransparent
    lblLast.BackStyle = fmBackStyleTransparent
End Sub


' [페이지 수 변경]
Private Sub cmbCountPerPage_Change()
    mCurrentPage = 1
    LoadGridData
End Sub

Private Sub lblQuery_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblQuery.BackColor = RGB(225, 235, 245)
    Me.lblQuery.BackStyle = fmBackStyleOpaque
End Sub
Private Sub lblAdd_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblAdd.BackColor = RGB(225, 235, 245)
    Me.lblAdd.BackStyle = fmBackStyleOpaque
End Sub

' 폼의 여백으로 마우스가 나갔을 때 복원
Private Sub fraToolbar_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal x As Single, ByVal y As Single)
    Me.lblQuery.BackStyle = fmBackStyleTransparent
    Me.lblAdd.BackStyle = fmBackStyleTransparent
End Sub

' iGrid 행 클릭 시 상세조회 (예시)

Private Sub igNotice_CurRowChange(ByVal lNewRowIfAny As Long, ByVal lOldRowIfAny As Long)
    Dim frm As New FrmNoticeDetail
    
    If lNewRowIfAny < 1 Then Exit Sub

    Dim selectedID As String
    selectedID = igNotice.CellValue(lNewRowIfAny, "notice_id")
    
    frm.SetInitialData selectedID
    
    With frm
        .SetCaller Me, Me.igNotice
        .Show vbModal
    End With
    
    On Error Resume Next
''    If picker.IsDateSelected Then
''        Me.txtBaseDate.value = Format(picker.GetSelectedDate, "yyyy-mm-dd")
''    End If
    
    Unload frm
    
    Call LoadGridData
End Sub

