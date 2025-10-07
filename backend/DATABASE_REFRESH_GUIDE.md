# Database Refresh Workflow Guide

This guide explains how to safely refresh the payment application database with filtered data from Zoho CRM.

## Overview

The new workflow automatically:
1. ✅ **Backs up** existing data before any operations
2. ✅ **Clears** old/unfiltered data from the database
3. ✅ **Fetches** fresh data from Zoho CRM with `Fully_Onboarded=true` filter
4. ✅ **Syncs** only records marked as "Pending Sync"
5. ✅ **Updates** CRM status to "Synced"
6. ✅ **Reports** comprehensive statistics

## API Endpoints

### 1. Full Database Refresh (Recommended)

**POST** `/api/database/refresh`

**Description:** Complete automated workflow with all safety measures.

**Query Parameters:**
- `create_backup_first` (boolean, default: `true`) - Create backup before operations
- `clear_before_sync` (boolean, default: `true`) - Clear existing data for clean slate
- `use_fully_onboarded` (boolean, default: `true`) - Only sync fully onboarded records

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/database/refresh?create_backup_first=true&clear_before_sync=true&use_fully_onboarded=true"
```

**Example Response:**
```json
{
  "workflow_started_at": "2025-10-06T14:30:00.123456",
  "steps": [
    {
      "step": "backup",
      "status": "success",
      "data": {
        "success": true,
        "filepath": "backups/interpreter_backup_20251006_143000.json",
        "filename": "interpreter_backup_20251006_143000.json",
        "timestamp": "20251006_143000",
        "total_records": 150,
        "file_size_bytes": 245678
      }
    },
    {
      "step": "clear",
      "status": "success",
      "data": {
        "success": true,
        "deleted_count": 150,
        "remaining_count": 0
      }
    },
    {
      "step": "sync",
      "status": "success",
      "data": {
        "id": "sync_1759750638429",
        "status": "completed",
        "total_fetched": 120,
        "total_created": 120,
        "total_updated": 0,
        "total_skipped": 0,
        "total_errors": 0,
        "total_synced_to_zoho": 120,
        "duration_seconds": 45.3
      }
    }
  ],
  "summary": {
    "total_duration_seconds": 48.7,
    "final_interpreter_count": 120,
    "workflow_status": "completed",
    "backup_created": true,
    "data_cleared": true,
    "fully_onboarded_filter_used": true
  },
  "workflow_completed_at": "2025-10-06T14:30:48.823456"
}
```

---

### 2. Manual Backup

**POST** `/api/backup/create`

**Description:** Create a backup of all current interpreter records.

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/backup/create"
```

**Example Response:**
```json
{
  "success": true,
  "filepath": "backups/interpreter_backup_20251006_143000.json",
  "filename": "interpreter_backup_20251006_143000.json",
  "timestamp": "20251006_143000",
  "total_records": 150,
  "file_size_bytes": 245678
}
```

---

### 3. List Backups

**GET** `/api/backup/list`

**Description:** List all available backups.

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/backup/list"
```

**Example Response:**
```json
{
  "backups": [
    {
      "filename": "interpreter_backup_20251006_143000.json",
      "filepath": "backups/interpreter_backup_20251006_143000.json",
      "created_at": "2025-10-06T14:30:00.123456",
      "size_bytes": 245678,
      "total_records": 150
    },
    {
      "filename": "interpreter_backup_20251005_120000.json",
      "filepath": "backups/interpreter_backup_20251005_120000.json",
      "created_at": "2025-10-05T12:00:00.123456",
      "size_bytes": 242134,
      "total_records": 148
    }
  ],
  "total": 2
}
```

---

### 4. Restore from Backup

**POST** `/api/backup/restore/{filename}`

**Description:** Restore interpreters from a backup file.

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/backup/restore/interpreter_backup_20251006_143000.json"
```

**Example Response:**
```json
{
  "success": true,
  "backup_file": "interpreter_backup_20251006_143000.json",
  "total_in_backup": 150,
  "restored": 150,
  "skipped": 0,
  "errors": 0,
  "error_details": []
}
```

---

### 5. Clear Database (⚠️ DANGEROUS)

**DELETE** `/api/interpreters/clear?confirm=true`

**Description:** Delete ALL interpreter records. Requires confirmation.

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/interpreters/clear?confirm=true"
```

**Example Response:**
```json
{
  "success": true,
  "deleted_count": 150,
  "remaining_count": 0
}
```

---

## Workflow Details

### Zoho CRM Criteria Used

When `use_fully_onboarded=true` (recommended), the sync fetches records matching:

```
(Sync_to_Payment_App:equals:Pending Sync) and (Fully_Onboarded:equals:true)
```

This ensures you only import interpreters who have completed the onboarding process.

### Fields Synced from Zoho CRM

The following fields are synchronized:
- Record ID
- Last Name
- Employee ID
- Cloudbreak ID
- LanguageLink ID
- Propio ID
- Contact Name
- Email
- Language
- Payment Frequency
- Service Location
- Onboarding Status
- Rate Per Minute
- Rate Per Hour

### Post-Sync CRM Updates

After successful import, each record's `Sync_to_Payment_App` field in Zoho CRM is updated from `"Pending Sync"` → `"Synced"`.

---

## Backup Files

### Location
All backups are stored in: `backend/backups/`

### File Format
- **Filename Pattern:** `interpreter_backup_YYYYMMDD_HHMMSS.json`
- **Format:** JSON
- **Structure:**
```json
{
  "backup_timestamp": "20251006_143000",
  "backup_datetime": "2025-10-06T14:30:00.123456",
  "total_records": 150,
  "records": [
    {
      "id": "int_1234567890",
      "record_id": "zoho_abc123",
      "contact_name": "John Doe",
      "email": "john@example.com",
      ...
    }
  ]
}
```

---

## Safety Recommendations

### ✅ Before Running Full Refresh

1. **Verify Zoho CRM Setup:**
   - Ensure `Fully_Onboarded` field is properly set for all interpreters
   - Ensure `Sync_to_Payment_App` is set to "Pending Sync" for new records

2. **Test with a Single Record:**
   ```bash
   curl -X POST "http://localhost:8000/api/sync/test" \
     -H "Content-Type: application/json" \
     -d '{"module": "Contacts", "email": "test@example.com"}'
   ```

3. **Review Current Data:**
   ```bash
   curl -X GET "http://localhost:8000/api/interpreters"
   ```

### ✅ After Running Full Refresh

1. **Verify Record Count:**
   ```bash
   curl -X GET "http://localhost:8000/api/interpreters" | jq 'length'
   ```

2. **Check Sync Logs:**
   ```bash
   curl -X GET "http://localhost:8000/api/sync/history?limit=1"
   ```

3. **Keep Backup Safe:**
   - Backups are stored in `backend/backups/`
   - Consider backing up to cloud storage for long-term retention

---

## Example Workflows

### Scenario 1: Initial Clean Import

```bash
# Step 1: Backup current data (if any)
curl -X POST "http://localhost:8000/api/backup/create"

# Step 2: Run full refresh
curl -X POST "http://localhost:8000/api/database/refresh?create_backup_first=true&clear_before_sync=true&use_fully_onboarded=true"

# Step 3: Verify results
curl -X GET "http://localhost:8000/api/sync/history?limit=1"
```

### Scenario 2: Incremental Update (Don't Clear)

```bash
# Run refresh without clearing existing data
curl -X POST "http://localhost:8000/api/database/refresh?create_backup_first=true&clear_before_sync=false&use_fully_onboarded=true"
```

### Scenario 3: Rollback to Previous State

```bash
# Step 1: List available backups
curl -X GET "http://localhost:8000/api/backup/list"

# Step 2: Clear current data
curl -X DELETE "http://localhost:8000/api/interpreters/clear?confirm=true"

# Step 3: Restore from backup
curl -X POST "http://localhost:8000/api/backup/restore/interpreter_backup_20251006_143000.json"
```

---

## Troubleshooting

### Issue: No Records Fetched

**Possible Causes:**
1. No records in Zoho CRM have `Sync_to_Payment_App = "Pending Sync"`
2. `Fully_Onboarded` filter is excluding all records

**Solution:**
- In Zoho CRM, set records to `Sync_to_Payment_App = "Pending Sync"`
- Or run with `use_fully_onboarded=false` to skip onboarding filter

### Issue: Partial Sync Status

**Possible Causes:**
- Some records failed to update in Zoho CRM
- Network issues during sync

**Solution:**
- Check sync logs for error details
- Re-run sync for failed records

### Issue: Backup Failed

**Possible Causes:**
- Insufficient disk space
- Permission issues on `backups/` directory

**Solution:**
```bash
# Check disk space
df -h

# Verify directory permissions
ls -la backend/backups/

# Create directory if needed
mkdir -p backend/backups
chmod 755 backend/backups
```

---

## Monitoring & Logs

### View Sync History
```bash
curl -X GET "http://localhost:8000/api/sync/history?limit=10"
```

### View Sync Logs for Specific Operation
```bash
curl -X GET "http://localhost:8000/api/sync/{sync_id}/logs?limit=200"
```

### Check Current Sync Status
```bash
curl -X GET "http://localhost:8000/api/sync/status"
```

---

## Production Considerations

1. **Schedule Regular Backups:**
   - Consider daily automated backups before overnight syncs
   - Retain backups for at least 30 days

2. **Monitor Sync Operations:**
   - Set up alerts for failed syncs
   - Review sync logs weekly

3. **Database Optimization:**
   - Run periodic cleanups of old sync logs
   - Monitor database size growth

4. **Cloud Backup:**
   - Upload backups to S3/Azure Blob Storage
   - Implement backup retention policies

---

## Questions?

For issues or questions:
1. Check the sync logs: `/api/sync/history`
2. Review Zoho CRM field mappings
3. Verify network connectivity to Zoho API
4. Check backend logs for detailed error messages
