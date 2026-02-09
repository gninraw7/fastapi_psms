#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-/tmp/board_notice_files_export.csv}"
FILTER_COMPANY_CD="${FILTER_COMPANY_CD:-}"
FILTER_NOTICE_ID="${FILTER_NOTICE_ID:-}"
FILTER_REPLY_ID="${FILTER_REPLY_ID:-}"
FILTER_FILE_ID="${FILTER_FILE_ID:-}"

DOTENV_PATH="${DOTENV_PATH:-.env}"
if [[ -f "$DOTENV_PATH" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_DATABASE)
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        case "$key" in
          DB_HOST) DB_HOST="$value" ;;
          DB_PORT) DB_PORT="$value" ;;
          DB_USER) DB_USER="$value" ;;
          DB_PASSWORD) DB_PASSWORD="$value" ;;
          DB_DATABASE) DB_DATABASE="$value" ;;
        esac
        ;;
    esac
  done < <(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_DATABASE)=' "$DOTENV_PATH" || true)
fi

if [[ -z "${MYSQL_HOST:-}" && -n "${DB_HOST:-}" ]]; then MYSQL_HOST="$DB_HOST"; fi
if [[ -z "${MYSQL_PORT:-}" && -n "${DB_PORT:-}" ]]; then MYSQL_PORT="$DB_PORT"; fi
if [[ -z "${MYSQL_USER:-}" && -n "${DB_USER:-}" ]]; then MYSQL_USER="$DB_USER"; fi
if [[ -z "${MYSQL_PASSWORD:-}" && -n "${DB_PASSWORD:-}" ]]; then MYSQL_PASSWORD="$DB_PASSWORD"; fi
if [[ -z "${MYSQL_DATABASE:-}" && -n "${DB_DATABASE:-}" ]]; then MYSQL_DATABASE="$DB_DATABASE"; fi

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"

export MYSQL_PWD="$MYSQL_PASSWORD"

HEADER="company_cd,map_id,notice_id,reply_id,file_id,link_created_at,link_created_by,original_name,stored_name,file_path,file_url,mime_type,file_size,file_created_at,file_created_by"

if [[ -n "$FILTER_COMPANY_CD" && ! "$FILTER_COMPANY_CD" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "ERROR: FILTER_COMPANY_CD must be alnum/underscore/hyphen." >&2
  exit 1
fi
if [[ -n "$FILTER_NOTICE_ID" && ! "$FILTER_NOTICE_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: FILTER_NOTICE_ID must be numeric." >&2
  exit 1
fi
if [[ -n "$FILTER_REPLY_ID" && ! "$FILTER_REPLY_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: FILTER_REPLY_ID must be numeric." >&2
  exit 1
fi
if [[ -n "$FILTER_FILE_ID" && ! "$FILTER_FILE_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: FILTER_FILE_ID must be numeric." >&2
  exit 1
fi

where_clause="1=1"
if [[ -n "$FILTER_COMPANY_CD" ]]; then
  where_clause+=" AND bf.company_cd = '${FILTER_COMPANY_CD}'"
fi
if [[ -n "$FILTER_NOTICE_ID" ]]; then
  where_clause+=" AND bf.notice_id = ${FILTER_NOTICE_ID}"
fi
if [[ -n "$FILTER_REPLY_ID" ]]; then
  where_clause+=" AND bf.reply_id = ${FILTER_REPLY_ID}"
fi
if [[ -n "$FILTER_FILE_ID" ]]; then
  where_clause+=" AND bf.file_id = ${FILTER_FILE_ID}"
fi

QUERY=$(cat <<SQL
SELECT
  CONCAT(
    '"', REPLACE(IFNULL(bf.company_cd,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(CAST(bf.map_id AS CHAR),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(CAST(bf.notice_id AS CHAR),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(CAST(bf.reply_id AS CHAR),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(CAST(bf.file_id AS CHAR),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(DATE_FORMAT(bf.created_at, '%Y-%m-%d %H:%i:%s'),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(bf.created_by,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.original_name,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.stored_name,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.file_path,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.file_url,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.mime_type,''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(CAST(uf.file_size AS CHAR),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(DATE_FORMAT(uf.created_at, '%Y-%m-%d %H:%i:%s'),''), '"', '""'), '"', ',',
    '"', REPLACE(IFNULL(uf.created_by,''), '"', '""'), '"'
  ) AS csv_row
FROM board_notice_files bf
JOIN uploaded_files uf
  ON uf.company_cd = bf.company_cd
 AND uf.file_id = bf.file_id
WHERE ${where_clause}
ORDER BY bf.company_cd, bf.notice_id, bf.reply_id, bf.file_id, bf.map_id;
SQL
)

{
  printf '%s\n' "$HEADER"
  mysql \
    --host="$MYSQL_HOST" \
    --port="$MYSQL_PORT" \
    --user="$MYSQL_USER" \
    --database="$MYSQL_DATABASE" \
    --default-character-set=utf8mb4 \
    --batch --raw --silent --skip-column-names \
    -e "$QUERY"
} > "$OUT_PATH"

echo "CSV exported: $OUT_PATH"
