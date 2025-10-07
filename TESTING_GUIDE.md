# Testing Guide for API Improvements

## Quick Start

### 1. Install Dependencies
```bash
# Backend - no new dependencies needed!
cd backend
pip install -r requirements.txt

# Frontend - already installed
cd frontend
npm install
```

### 2. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Testing CSV Import Improvements

### Test Case 1: Standard CSV Headers
Create a CSV file `test_import.csv`:

```csv
Contact Name,Email,Employee ID,Cloudbreak ID,Languagelink ID,Propio ID,Rate/Min,Rate/Hour,Language,Service Location
John Doe,john@example.com,EMP001,CB123,LL456,PR789,0.50,30.00,Spanish,On-site
Jane Smith,jane@example.com,EMP002,CB124,LL457,PR790,0.55,33.00,Portuguese,Remote
```

**Steps:**
1. Go to "Interpreters" tab
2. Click "Import from CSV"
3. Select `test_import.csv`
4. Verify all fields are imported (check Cloudbreak ID, Languagelink ID, Propio ID, rates)

### Test Case 2: Alternative CSV Headers
Create `test_import_alt.csv`:

```csv
ContactName,Email,EmployeeID,CloudbreakID,LanguagelinkID,PropioID,Rate Per Minute,Rate Per Hour,Language,ServiceLocation
Bob Johnson,bob@example.com,EMP003,CB125,LL458,PR791,0.60,36.00,French,On-site
```

**Expected:** Should import successfully with same results as Test Case 1

### Test Case 3: Mixed Headers (Typos)
Create `test_import_typo.csv`:

```csv
Contact Name,Email,Emplyee ID,Cloudbreak Id,LanguageLink ID,Propio Id,Rate/Hou,Language,Service_Location
Alice Brown,alice@example.com,EMP004,CB126,LL459,PR792,35.00,German,Remote
```

**Expected:** Should handle the typos and import successfully

---

## Testing Zoho CRM Integration

### Test Case 1: Small Import (Synchronous)

**Steps:**
1. Go to "Zoho Import" tab
2. Set filters:
   - Onboarding Status: "Fully Onboarded"
   - Leave others empty
3. Click "Fetch Contacts"
4. Select a few contacts (< 20)
5. Click "Import Selected"

**Expected:**
- Import completes in < 10 seconds
- Success message shows count
- Interpreters appear in "Interpreters" tab

### Test Case 2: Large Import (Asynchronous)

**Using API directly:**

```bash
# Start async import
curl -X POST "http://localhost:8000/api/zoho/import-candidates-async?max_records=100&onboarding_status=Fully%20Onboarded" \
  -H "Content-Type: application/json"

# Response:
# {
#   "success": true,
#   "job_id": "550e8400-e29b-41d4-a716-446655440000",
#   "message": "Import started in background..."
# }

# Check status
JOB_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:8000/api/zoho/import-status/$JOB_ID"

# Response (in progress):
# {
#   "status": "in_progress",
#   "progress": 30,
#   "message": "Processing 100 candidates..."
# }

# Response (completed):
# {
#   "status": "completed",
#   "progress": 100,
#   "message": "Successfully imported 45 and updated 55 interpreters",
#   "results": {
#     "total": 100,
#     "created": 45,
#     "updated": 55,
#     "skipped": 0,
#     "errors": 0
#   }
# }
```

---

## Testing Rate Limiting

### Test Case: Rapid API Calls

**Script:** Create `test_rate_limit.py`:

```python
import requests
import time

BASE_URL = "http://localhost:8000"

print("Testing rate limiting...")
print("Making 15 rapid requests (limit is 10 per 10 seconds)")

start = time.time()
for i in range(15):
    response = requests.get(f"{BASE_URL}/api/zoho/modules")
    elapsed = time.time() - start
    print(f"Request {i+1}: Status {response.status_code} at {elapsed:.2f}s")

print(f"\nTotal time: {time.time() - start:.2f}s")
print("Expected: ~10s (rate limiter kicks in after 10th request)")
```

**Run:**
```bash
python test_rate_limit.py
```

**Expected Output:**
```
Request 1: Status 200 at 0.15s
Request 2: Status 200 at 0.28s
...
Request 10: Status 200 at 1.45s
Request 11: Status 200 at 10.12s  # ← Waited due to rate limit
Request 12: Status 200 at 10.25s
...
Total time: ~10s
```

---

## Testing Input Validation

### Test Case 1: Invalid max_records

```bash
# Test negative number
curl -X POST "http://localhost:8000/api/zoho/import-candidates?max_records=-1"

# Expected:
# {
#   "detail": "max_records must be a positive integer"
# }

# Test exceeding limit
curl -X POST "http://localhost:8000/api/zoho/import-candidates?max_records=5000"

# Expected:
# {
#   "detail": "max_records cannot exceed 1000"
# }
```

### Test Case 2: Too Many Selected IDs

```bash
# Try to import 250 candidates (limit is 200)
curl -X POST "http://localhost:8000/api/zoho/import-selected" \
  -H "Content-Type: application/json" \
  -d "{\"candidate_ids\": $(python -c 'print(list(range(250)))')}"

# Expected:
# {
#   "detail": "Cannot import more than 200 candidates at once..."
# }
```

---

## Testing Error Handling

### Test Case 1: Database Rollback

**Setup:** Import a duplicate email

```bash
# First import (succeeds)
curl -X POST "http://localhost:8000/api/interpreters" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "Test User",
    "email": "test@example.com"
  }'

# Second import (should handle gracefully)
curl -X POST "http://localhost:8000/api/interpreters/bulk" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "contact_name": "Test User Updated",
      "email": "test@example.com"
    }
  ]'
```

**Expected:**
- Should update existing record (not create duplicate)
- Response shows `"updated": 1, "created": 0`

### Test Case 2: Zoho API Error

```bash
# Use invalid Zoho credentials
# Edit backend/.env temporarily:
ZOHO_REFRESH_TOKEN=invalid_token

# Restart backend and try import
curl "http://localhost:8000/api/zoho/candidates"

# Expected:
# {
#   "detail": "Zoho API error: Token refresh failed..."
# }
```

---

## Load Testing (Optional)

### Test Background Import Performance

```python
import requests
import time
import threading

BASE_URL = "http://localhost:8000"

def start_import(thread_id):
    response = requests.post(
        f"{BASE_URL}/api/zoho/import-candidates-async",
        params={"max_records": 50}
    )
    job_id = response.json()["job_id"]
    print(f"Thread {thread_id}: Started job {job_id}")

    # Poll until complete
    while True:
        status = requests.get(f"{BASE_URL}/api/zoho/import-status/{job_id}").json()
        if status["status"] in ["completed", "failed"]:
            print(f"Thread {thread_id}: {status['status']} - {status['message']}")
            break
        time.sleep(2)

# Start 3 concurrent imports
threads = []
for i in range(3):
    t = threading.Thread(target=start_import, args=(i,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

print("All imports completed!")
```

**Expected:**
- All 3 imports complete successfully
- Rate limiter prevents API quota issues
- No database conflicts

---

## Verification Checklist

After running tests, verify:

### CSV Import
- [ ] Standard headers work
- [ ] Alternative headers work (CloudbreakID vs Cloudbreak ID)
- [ ] Typos are handled (Rate/Hou)
- [ ] All ID fields are populated
- [ ] Rates are correctly imported

### Zoho Import
- [ ] Small imports (< 50) complete quickly
- [ ] Large imports (> 100) run in background
- [ ] Job status updates correctly
- [ ] Duplicate emails are updated (not duplicated)
- [ ] All Zoho fields are mapped

### Rate Limiting
- [ ] 10 requests/10s limit enforced
- [ ] No 429 errors from Zoho
- [ ] Automatic waiting works

### Validation
- [ ] Invalid max_records rejected
- [ ] Too many IDs rejected
- [ ] Clear error messages shown

### Error Handling
- [ ] Database rollback works
- [ ] Partial imports don't occur
- [ ] Error details are logged

---

## API Documentation

View interactive API docs:
```
http://localhost:8000/docs
```

Look for new endpoints:
- `/api/zoho/import-candidates-async`
- `/api/zoho/import-status/{job_id}`

---

## Troubleshooting

### Issue: CSV import shows all blank IDs

**Solution:** Check CSV file encoding
```bash
file -I your_file.csv
# Should show: text/csv; charset=utf-8

# If not UTF-8, convert:
iconv -f ISO-8859-1 -t UTF-8 your_file.csv > fixed.csv
```

### Issue: Zoho import fails with "Token refresh failed"

**Solution:** Check Zoho credentials
```bash
# Test token refresh manually
cd backend
python -c "from zoho_client import zoho_client; print(zoho_client._get_access_token())"
```

### Issue: Background import stuck at 0%

**Solution:** Check logs
```bash
# Backend logs will show detailed progress
# Look for lines like:
# INFO:root:Job xxx: Fetching candidates...
# INFO:root:Job xxx: Processing 100 candidates
```

### Issue: Rate limiting too aggressive

**Solution:** Adjust rate limiter settings
```python
# In backend/rate_limiter.py, increase limits:
zoho_rate_limiter = RateLimiter(max_calls=20, time_window=10)
```

---

## Next Steps

After verifying all tests pass:

1. **Production Deployment**
   - Deploy updated backend
   - No frontend changes needed (backward compatible)

2. **Monitor Usage**
   - Check Zoho API quota usage
   - Monitor background job completion rates

3. **User Training**
   - Show async import for large datasets
   - Demonstrate new CSV flexibility

4. **Optional Enhancements**
   - Add WebSocket for real-time progress
   - Create import history dashboard
   - Build field mapping UI

---

## Support

If you encounter issues:

1. Check API docs: `http://localhost:8000/docs`
2. Review logs in terminal
3. Verify `.env` configuration
4. Test with sample data first

Happy testing! 🚀
