#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import os
import re
import subprocess
import sys
import uuid
import zipfile
import xml.etree.ElementTree as ET

try:
    import pymysql
    HAVE_PYMYSQL = True
except Exception:
    HAVE_PYMYSQL = False

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def normalize_header(value: str) -> str:
    if value is None:
        return ""
    value = str(value).replace("\ufeff", "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_value(value: str) -> str:
    if value is None:
        return ""
    return str(value).strip()


def col_to_index(col: str) -> int:
    idx = 0
    for ch in col:
        if not ch.isalpha():
            continue
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx


def read_shared_strings(zf: zipfile.ZipFile):
    shared = []
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return shared
    for si in root.findall("main:si", NS):
        texts = [t.text or "" for t in si.findall(".//main:t", NS)]
        shared.append("".join(texts))
    return shared


def get_sheet_path(zf: zipfile.ZipFile, sheet_name: str) -> str:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    sheets = wb.find("main:sheets", NS).findall("main:sheet", NS)
    rid = None
    for sh in sheets:
        if sh.attrib.get("name") == sheet_name:
            rid = sh.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            break
    if not rid:
        raise ValueError(f"Sheet not found: {sheet_name}")

    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    for rel in rels.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        if rel.attrib.get("Id") == rid:
            return "xl/" + rel.attrib["Target"]
    raise ValueError(f"Sheet target not found for: {sheet_name}")


def read_xlsx_rows(path: str, sheet_name: str):
    with zipfile.ZipFile(path) as zf:
        shared = read_shared_strings(zf)
        sheet_path = get_sheet_path(zf, sheet_name)
        sheet = ET.fromstring(zf.read(sheet_path))
        rows = []
        for row in sheet.findall("main:sheetData/main:row", NS):
            r_index = int(row.attrib["r"])
            row_vals = {}
            for c in row.findall("main:c", NS):
                cell_ref = c.attrib["r"]
                col = "".join([ch for ch in cell_ref if ch.isalpha()])
                v = c.find("main:v", NS)
                if v is None:
                    val = ""
                else:
                    val = v.text or ""
                if c.attrib.get("t") == "s":
                    try:
                        val = shared[int(val)]
                    except Exception:
                        pass
                row_vals[col] = val
            rows.append((r_index, row_vals))
        return rows


def rows_from_xlsx(path: str, sheet_name: str, header_row_index: int):
    rows = read_xlsx_rows(path, sheet_name)
    row_map = {r: vals for r, vals in rows}
    header_row = row_map.get(header_row_index)
    if not header_row:
        raise ValueError(f"Header row {header_row_index} not found in {sheet_name}")

    all_cols = set()
    for _, vals in rows:
        all_cols.update(vals.keys())
    ordered_cols = sorted(all_cols, key=col_to_index)

    header_map = {}
    for col in ordered_cols:
        header_text = normalize_header(header_row.get(col, ""))
        if not header_text:
            continue
        # Avoid overwriting duplicate headers
        if header_text in header_map:
            continue
        header_map[header_text] = col

    data = []
    for r_index, vals in rows:
        if r_index <= header_row_index:
            continue
        row = {}
        for header_text, col in header_map.items():
            row[header_text] = normalize_value(vals.get(col, ""))
        if all(not v for v in row.values()):
            continue
        data.append(row)
    return data


def rows_from_csv(path: str, header_row_index: int):
    with open(path, newline="", encoding="utf-8") as f:
        reader = list(csv.reader(f))
    if header_row_index > len(reader):
        raise ValueError(f"Header row {header_row_index} not found in {path}")
    header = [normalize_header(h) for h in reader[header_row_index - 1]]
    data = []
    for row in reader[header_row_index:]:
        row_map = {header[i]: normalize_value(row[i]) if i < len(row) else "" for i in range(len(header))}
        if all(not v for v in row_map.values()):
            continue
        data.append(row_map)
    return data


def load_env_db_config(env_path: str):
    config = {}
    if not os.path.exists(env_path):
        return config
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip().strip('"').strip("'")
    return config


def mysql_query(db_conf, query: str):
    if HAVE_PYMYSQL:
        try:
            conn = pymysql.connect(
                host=db_conf["host"],
                port=int(db_conf["port"]),
                user=db_conf["user"],
                password=db_conf["password"],
                database=db_conf["database"],
                charset="utf8mb4",
                autocommit=True,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute(query)
                    rows = cur.fetchall()
                return [[str(col) if col is not None else "" for col in row] for row in rows]
            finally:
                conn.close()
        except Exception:
            pass

    temp_path = f"/tmp/mig_mysql_{uuid.uuid4().hex}.tsv"
    safe_query = query.strip().rstrip(";")
    cmd = [
        "mysql",
        "-h",
        db_conf["host"],
        "-P",
        str(db_conf["port"]),
        "-u",
        db_conf["user"],
        f"-p{db_conf['password']}",
        "-D",
        db_conf["database"],
        "-N",
        "-B",
        "-e",
        f"tee {temp_path}; {safe_query}; notee;",
    ]
    result = subprocess.run(cmd, text=True, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    rows = []
    with open(temp_path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            rows.append(line.split("\t"))
    try:
        os.remove(temp_path)
    except OSError:
        pass
    return rows


def parse_amount(value: str) -> str:
    if not value:
        return ""
    value = re.sub(r"[^0-9.\-]", "", value)
    return value if value else ""


def map_service_code(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if value.upper() == "AICC":
        return "AI서비스-IPCC"
    return "AI수어-구축형"


def _contains_any(text: str, tokens: list) -> bool:
    lower = text.lower()
    for token in tokens:
        if token.isascii():
            if token.lower() in lower:
                return True
        else:
            if token in text:
                return True
    return False


def map_field_code_from_customer(name: str) -> str:
    name = (name or "").strip()
    if not name:
        return ""

    if "시청" in name or name.endswith("시"):
        return "공공"

    public_keywords = ["공사", "공단", "처", "정보원", "진흥원", "국어원", "경찰청", "센터"]
    if _contains_any(name, public_keywords):
        return "공공"

    finance_keywords = ["은행", "보험", "증권", "카드", "뱅크", "생명", "금융", "화재"]
    if _contains_any(name, finance_keywords):
        return "공공"

    medical_keywords = ["병원", "의료"]
    if _contains_any(name, medical_keywords):
        return "의료"

    manufacturing_keywords = ["KT", "LG"]
    if _contains_any(name, manufacturing_keywords):
        return "제조"

    education_keywords = ["대학교", "교육청"]
    if _contains_any(name, education_keywords):
        return "교육"

    if "백화점" in name:
        return "교육"

    return ""


def excel_serial_to_date(serial: int) -> dt.date:
    return dt.date(1899, 12, 30) + dt.timedelta(days=serial)


def parse_date(value: str, default_year: int = None) -> str:
    if value is None:
        return ""
    value = str(value).strip()
    if not value:
        return ""

    # Excel serial
    if re.fullmatch(r"\d+", value):
        num = int(value)
        if 30000 <= num <= 60000:
            return excel_serial_to_date(num).isoformat()

    normalized = value
    normalized = re.sub(r"\([^)]*\)", "", normalized)  # drop weekday notes like (월)
    normalized = normalized.replace("년", "-").replace("월", "-").replace("일", "")
    normalized = normalized.replace("/", "-").replace(".", "-")
    normalized = re.sub(r"\s+", "", normalized)
    normalized = re.sub(r"[^0-9\-]", "", normalized)

    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", normalized)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    m = re.match(r"^(\d{2})-(\d{1,2})-(\d{1,2})", normalized)
    if m:
        year = 2000 + int(m.group(1))
        return f"{year:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    m = re.match(r"^(\d{1,2})-(\d{1,2})", normalized)
    if m and default_year:
        return f"{default_year:04d}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    return ""


def _valid_date(year: int, month: int, day: int) -> str:
    try:
        return dt.date(year, month, day).isoformat()
    except ValueError:
        return ""


def _iter_date_tokens(text: str, default_year: int):
    patterns = [
        r"(?<!\d)(?P<y>\d{4})[./-](?P<m>\d{1,2})[./-](?P<d>\d{1,2})(?!\d)",
        r"(?P<y>\d{4})\s*년\s*(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일?",
        r"(?<!\d)(?P<y>\d{2})[./-](?P<m>\d{1,2})[./-](?P<d>\d{1,2})(?!\d)",
        r"(?P<y>\d{2})\s*년\s*(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일?",
        r"(?<!\d)(?P<y>\d{4})(?P<m>\d{2})(?P<d>\d{2})(?!\d)",
        r"(?<!\d)(?P<m>\d{1,2})[./-](?P<d>\d{1,2})(?!\d)",
        r"(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일?",
    ]

    spans = []
    results = []
    for pat in patterns:
        for m in re.finditer(pat, text):
            start, end = m.span()
            if any(not (end <= s or start >= e) for s, e in spans):
                continue
            year = m.groupdict().get("y")
            month = m.groupdict().get("m")
            day = m.groupdict().get("d")
            if not month or not day:
                continue
            if year:
                year = int(year)
                if year < 100:
                    year = 2000 + year
            else:
                if not default_year:
                    continue
                year = default_year
            month = int(month)
            day = int(day)
            iso = _valid_date(year, month, day)
            if not iso:
                continue
            spans.append((start, end))
            results.append({"start": start, "end": end, "date": iso, "token": text[start:end]})
    results.sort(key=lambda x: x["start"])
    return results


def _split_line_by_dates(line: str, default_year: int):
    work = line.strip()
    if not work:
        return []
    work = work.lstrip(" \t-•*·●")
    matches = _iter_date_tokens(work, default_year)

    prefix_len = 0
    prefix_match = re.match(r"^\(?\d{1,2}\)?[.)]?\s*", work)
    if prefix_match and re.search(r"\d", prefix_match.group(0) or ""):
        prefix_len = len(prefix_match.group(0))

    filtered = []
    for m in matches:
        if (m["start"] - prefix_len) > 3:
            continue
        prefix = work[:m["start"]]
        prefix_trimmed = prefix.rstrip(" \t.-•*·●()[]{}<>")
        if prefix_trimmed.endswith("L") or prefix_trimmed.endswith("-"):
            continue
        filtered.append(m)
    matches = filtered
    if not matches:
        return [("", work)]

    segments = []
    first_start = matches[0]["start"]
    if first_start > 0:
        prefix = work[:first_start].strip()
        # Ignore prefix if it's only brackets/punctuation
        if prefix and not re.fullmatch(r"[\s\(\)\[\]\{\}<>•\-\.\*·]+", prefix):
            segments.append(("", prefix))

    for idx, match in enumerate(matches):
        seg_start = match["start"]
        seg_end = matches[idx + 1]["start"] if idx + 1 < len(matches) else len(work)
        seg = work[seg_start:seg_end]
        content = seg[len(match["token"]):].lstrip(" .:/)-]}>\\t")
        content = re.sub(r"^\s*\)?\s*(기준일자|기준일|기준)\s*\)?\s*[:：\-–]?\s*", "", content)
        content = content.lstrip(" .:/)-]}>\\t")
        segments.append((match["date"], content.strip()))
    return segments


def split_strategy(text: str, default_year: int = None, fallback_base_date: str = ""):
    if not text or not str(text).strip():
        return []
    raw = str(text).replace("\r\n", "\n").replace("\r", "\n")

    lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
    entries = []
    current = None

    for line in lines:
        for base_date, rest in _split_line_by_dates(line, default_year):
            if rest.strip() == "※":
                continue
            if base_date:
                if current:
                    entries.append(current)
                current = {"base_date": base_date, "content": rest.strip()}
            else:
                if current:
                    current["content"] = (current["content"] + "\n" + rest).strip()
                else:
                    # No date detected yet; keep as a pending blob
                    current = {"base_date": "", "content": rest}

    if current:
        entries.append(current)

    has_dates = any(e["base_date"] for e in entries)
    if not has_dates:
        base_date = parse_date(fallback_base_date, default_year) if fallback_base_date else ""
        return [{"base_date": base_date, "content": raw.strip()}]

    # Fill missing base_date with fallback if available
    fallback = parse_date(fallback_base_date, default_year) if fallback_base_date else ""
    for e in entries:
        if not e["base_date"] and fallback:
            e["base_date"] = fallback
    return entries


def write_csv(path: str, rows: list, columns: list):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main():
    parser = argparse.ArgumentParser(description="Generate migration CSVs for 20260209")
    parser.add_argument("--source-xlsx", help="Google Sheet exported as XLSX")
    parser.add_argument("--source-2026-csv", help="2026 sheet exported as CSV")
    parser.add_argument("--source-2025-csv", help="2025 sheet exported as CSV")
    parser.add_argument("--out-dir", default="mig/20260209")
    parser.add_argument("--company-cd", default="TESTCOMP")
    parser.add_argument("--lookup-company-cd", help="Company code for user/stage lookup")
    parser.add_argument("--skip-db", action="store_true", help="Skip DB lookups")
    parser.add_argument("--client-id-start", type=int, help="Starting client_id for new rows")
    parser.add_argument("--db-host")
    parser.add_argument("--db-port", type=int)
    parser.add_argument("--db-user")
    parser.add_argument("--db-password")
    parser.add_argument("--db-name")
    args = parser.parse_args()

    if not args.source_xlsx and not (args.source_2026_csv and args.source_2025_csv):
        print("ERROR: Provide --source-xlsx or both --source-2026-csv and --source-2025-csv", file=sys.stderr)
        sys.exit(1)

    company_cd = args.company_cd
    lookup_company_cd = args.lookup_company_cd or company_cd

    # Load source data
    if args.source_xlsx:
        sheet_2026 = rows_from_xlsx(args.source_xlsx, "2026년 주요추진사업", 3)
        sheet_2025 = rows_from_xlsx(args.source_xlsx, "2025년 주요추진사업(NEW)", 3)
    else:
        sheet_2026 = rows_from_csv(args.source_2026_csv, 3)
        sheet_2025 = rows_from_csv(args.source_2025_csv, 3)

    # DB lookups
    db_conf = None
    if not args.skip_db:
        env = load_env_db_config(".env")
        db_conf = {
            "host": args.db_host or env.get("DB_HOST", "localhost"),
            "port": args.db_port or int(env.get("DB_PORT", "3306")),
            "user": args.db_user or env.get("DB_USER", "root"),
            "password": args.db_password or env.get("DB_PASSWORD", ""),
            "database": args.db_name or env.get("DB_DATABASE", env.get("DB_NAME", "psms")),
        }

    user_name_to_login = {}
    stage_name_to_code = {}
    client_name_to_id = {}
    next_client_id = 1

    if db_conf:
        try:
            rows = mysql_query(db_conf, f"SELECT user_name, login_id FROM users WHERE company_cd='{lookup_company_cd}'")
            user_name_to_login = {r[0]: r[1] for r in rows}

            rows = mysql_query(
                db_conf,
                f"SELECT code_name, code FROM comm_code WHERE company_cd='{lookup_company_cd}' AND group_code='STAGE'",
            )
            stage_name_to_code = {r[0]: r[1] for r in rows}

            rows = mysql_query(
                db_conf,
                f"SELECT client_name, client_id FROM clients WHERE company_cd='{company_cd}'",
            )
            client_name_to_id = {r[0]: int(r[1]) for r in rows}
            rows = mysql_query(db_conf, "SELECT IFNULL(MAX(client_id), 0) FROM clients")
            if rows:
                next_client_id = int(rows[0][0]) + 1
        except Exception as e:
            print(f"WARN: DB lookup failed, proceeding without DB mappings: {e}")
            db_conf = None

    if not user_name_to_login:
        user_name_to_login.update(
            {
                "관리자": "admin",
                "테스트사용자": "user1",
                "테스트사용자2": "user2",
                "테스트사용자3": "user3",
            }
        )

    if not stage_name_to_code:
        stage_name_to_code.update(
            {
                "1 영업중": "S01",
                "2 견적제출": "S02",
                "3 제안중": "S03",
                "4 입찰중": "S04",
                "5 DROP": "S05",
                "6 실주": "S06",
                "7 수주완료": "S07",
                "8 계약완료": "S08",
                "9 유지보수": "S09",
            }
        )

    if args.client_id_start:
        next_client_id = args.client_id_start

    new_clients = []
    projects = {}
    project_attributes = {}
    project_contracts = {}
    project_history = []

    def get_client_id(name: str):
        nonlocal next_client_id
        if not name:
            return ""
        name = name.strip()
        if name == "-":
            return ""
        if name in client_name_to_id:
            return client_name_to_id[name]
        client_id = next_client_id
        next_client_id += 1
        client_name_to_id[name] = client_id
        new_clients.append({"company_cd": company_cd, "client_id": client_id, "client_name": name})
        return client_id

    def map_manager(value: str):
        if not value:
            return ""
        value = value.strip()
        if value == "박현후":
            value = "박현우"
        if value in user_name_to_login:
            return user_name_to_login[value]
        return value

    def map_stage(value: str):
        if not value:
            return ""
        value = value.strip()
        if value in stage_name_to_code:
            return stage_name_to_code[value]
        return value

    def add_project(row: dict, sheet_year: int):
        pipeline_id = row.get("파이프라인 ID", "").strip()
        if not pipeline_id:
            return
        project_name = row.get("사업명", "").strip()
        if not project_name:
            return
        service_code = ""
        field_code = ""
        if sheet_year == 2026:
            service_code = map_service_code(row.get("분야", ""))
            field_code = map_field_code_from_customer(row.get("고객사", ""))
        manager_id = map_manager(row.get("담당자", ""))
        current_stage = map_stage(row.get("진행단계", ""))
        quoted_amount = row.get("견적금액 단위 원. VAT제외", "") or row.get("견적가(vat제외)", "")
        notes = row.get("비고", "")

        customer_id = get_client_id(row.get("고객사", ""))
        ordering_party_id = get_client_id(row.get("발주처", ""))

        project = {
            "company_cd": company_cd,
            "pipeline_id": pipeline_id,
            "project_name": project_name,
            "field_code": field_code,
            "service_code": service_code,
            "manager_id": manager_id,
            "customer_id": customer_id,
            "ordering_party_id": ordering_party_id,
            "current_stage": current_stage,
            "quoted_amount": parse_amount(quoted_amount),
            "notes": notes,
        }
        projects[pipeline_id] = project

    def add_contract(row: dict, sheet_year: int):
        pipeline_id = row.get("파이프라인 ID", "").strip()
        if not pipeline_id or pipeline_id not in projects:
            return
        contract_date = parse_date(row.get("계약일자", ""), sheet_year)
        start_date = parse_date(row.get("프로젝트기간(시작)", ""), sheet_year)
        end_date = parse_date(row.get("프로젝트기간(종료)", ""), sheet_year)
        order_amount = parse_amount(row.get("계약(수주금액) 단위 원. VAT제외", ""))
        contract_amount = parse_amount(row.get("계약(계약금액) 단위 원. VAT제외", ""))

        if not any([contract_date, start_date, end_date, order_amount, contract_amount]):
            return
        project_contracts[pipeline_id] = {
            "company_cd": company_cd,
            "pipeline_id": pipeline_id,
            "contract_date": contract_date,
            "start_date": start_date,
            "end_date": end_date,
            "order_amount": order_amount,
            "contract_amount": contract_amount,
        }

    def add_attribute(pipeline_id: str, code: str, value: str):
        if not pipeline_id or not code or pipeline_id not in projects:
            return
        if not value:
            return
        key = (pipeline_id, code)
        project_attributes[key] = {
            "company_cd": company_cd,
            "pipeline_id": pipeline_id,
            "attr_code": code,
            "attr_value": value,
        }

    def add_history_entries(pipeline_id: str, text: str, base_date_value: str, sheet_year: int):
        if pipeline_id not in projects:
            return
        entries = split_strategy(text, default_year=sheet_year, fallback_base_date=base_date_value)
        for entry in entries:
            content = entry["content"].strip()
            if not content:
                continue
            project_history.append(
                {
                    "company_cd": company_cd,
                    "pipeline_id": pipeline_id,
                    "base_date": entry["base_date"],
                    "strategy_content": content,
                    "_sheet_year": sheet_year,
                }
            )

    # Process 2026 sheet
    for row in sheet_2026:
        add_project(row, 2026)
        add_contract(row, 2026)
        pipeline_id = row.get("파이프라인 ID", "").strip()
        if not pipeline_id:
            continue

        add_attribute(pipeline_id, "ATTR_ORD_TIME", row.get("발주시기(예상)", ""))
        add_attribute(pipeline_id, "ATTR_CON_TIME", row.get("계약시기(예상)", ""))
        add_attribute(pipeline_id, "ATTR_BIZ_STR", row.get("사업구도 ex) 마도 : OOO", ""))

        base_date_value = row.get("업무 기준일", "")
        add_history_entries(pipeline_id, row.get("진행상황 및 영업전략", ""), base_date_value, 2026)

    # Process 2025 sheet
    for row in sheet_2025:
        add_project(row, 2025)
        pipeline_id = row.get("파이프라인 ID", "").strip()
        if not pipeline_id:
            continue

        add_attribute(pipeline_id, "ATTR_ORD_TIME", row.get("발주시기", ""))
        add_attribute(pipeline_id, "ATTR_CON_TIME", row.get("계약시기", ""))
        add_attribute(pipeline_id, "ATTR_BIZ_STR", row.get("사업구도 ex) 마도 : OOO", ""))
        add_attribute(pipeline_id, "ATTR_CHANGE", row.get("변동여부", ""))

        history_cols = [
            "진행상황 및 영업전략(1)",
            "진행상황 및 영업전략(2)",
            "진행상황 및 영업전략(3)",
            "진행상황 및 영업전략(4)",
            "-",
        ]
        for col in history_cols:
            if col in row and row.get(col, ""):
                add_history_entries(pipeline_id, row.get(col, ""), "", 2025)

    history_by_pipeline = {}
    for entry in project_history:
        history_by_pipeline.setdefault(entry["pipeline_id"], []).append(entry)

    for pipeline_id, entries in history_by_pipeline.items():
        dated = [e["base_date"] for e in entries if e["base_date"]]
        latest_date = max(dated) if dated else ""
        for entry in entries:
            if entry["base_date"]:
                continue
            if latest_date:
                entry["base_date"] = latest_date
                entry["strategy_content"] = (
                    f"{entry['strategy_content']}\n[마이그 강제일자: {latest_date}]"
                )
            else:
                sheet_year = entry.get("_sheet_year") or 2026
                entry["base_date"] = f"{sheet_year}-01-01"

    for entry in project_history:
        entry.pop("_sheet_year", None)

    # Write CSVs
    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)

    write_csv(
        os.path.join(out_dir, "clients.csv"),
        new_clients,
        ["company_cd", "client_id", "client_name"],
    )

    write_csv(
        os.path.join(out_dir, "projects.csv"),
        list(projects.values()),
        [
            "company_cd",
            "pipeline_id",
            "project_name",
            "field_code",
            "service_code",
            "manager_id",
            "customer_id",
            "ordering_party_id",
            "current_stage",
            "quoted_amount",
            "notes",
        ],
    )

    write_csv(
        os.path.join(out_dir, "project_attributes.csv"),
        list(project_attributes.values()),
        ["company_cd", "pipeline_id", "attr_code", "attr_value"],
    )

    write_csv(
        os.path.join(out_dir, "project_contracts.csv"),
        list(project_contracts.values()),
        [
            "company_cd",
            "pipeline_id",
            "contract_date",
            "start_date",
            "end_date",
            "order_amount",
            "contract_amount",
        ],
    )

    write_csv(
        os.path.join(out_dir, "project_history.csv"),
        project_history,
        ["company_cd", "pipeline_id", "base_date", "strategy_content"],
    )

    print(f"Done. Wrote CSVs to {out_dir}")


if __name__ == "__main__":
    main()
