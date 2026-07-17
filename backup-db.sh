#!/bin/bash
# =============================================
# Database Backup Script (mysqldump + gzip + auto-cleanup)
# =============================================
# วิธีตั้ง cron (Linux):
#   crontab -e
#   # ทุกวัน 02:00
#   0 2 * * * /path/to/project/backup-db.sh >> /path/to/project/logs/backup.log 2>&1
#
# วิธีรันด้วยมือ:
#   chmod +x backup-db.sh
#   ./backup-db.sh
# =============================================

# อ่านค่าจาก .env (สมมติว่าอยู่ใน directory เดียวกับ script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

# === CONFIG (override ได้จาก .env หรือแก้ตรงนี้) ===
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-repair_app}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-repair_system}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "========================================================================"
echo "🔄 [$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $DB_NAME"
echo "   Host: $DB_HOST | User: $DB_USER | Dir: $BACKUP_DIR"

# Run mysqldump + gzip
if [ -n "$DB_PASS" ]; then
    MYSQL_PWD="$DB_PASS" mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        --single-transaction \
        --routines \
        --triggers \
        --add-drop-table \
        --default-character-set=utf8mb4 \
        "$DB_NAME" 2>/tmp/backup_err_$$.log | gzip > "$BACKUP_FILE"
    DUMP_EXIT=${PIPESTATUS[0]}
else
    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        --single-transaction \
        --routines \
        --triggers \
        --add-drop-table \
        --default-character-set=utf8mb4 \
        "$DB_NAME" 2>/tmp/backup_err_$$.log | gzip > "$BACKUP_FILE"
    DUMP_EXIT=${PIPESTATUS[0]}
fi

if [ $DUMP_EXIT -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup saved: $(basename "$BACKUP_FILE") ($SIZE)"
else
    echo "❌ mysqldump failed (exit code: $DUMP_EXIT)"
    cat /tmp/backup_err_$$.log 2>/dev/null
    rm -f "$BACKUP_FILE"
    rm -f /tmp/backup_err_$$.log
    exit 1
fi
rm -f /tmp/backup_err_$$.log

# Cleanup: ลบไฟล์ที่เก่ากว่า RETENTION_DAYS
echo "🗑️  Cleaning up backups older than $RETENTION_DAYS days..."
DELETED=0
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete | while read f; do
    echo "   Deleted: $(basename "$f")"
    DELETED=$((DELETED+1))
done

# Summary
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "📊 Total backups: $TOTAL_BACKUPS | Total size: $TOTAL_SIZE"
echo "✅ [$(date '+%Y-%m-%d %H:%M:%S')] Backup complete"
echo "========================================================================"