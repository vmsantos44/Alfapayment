# Railway Deployment - Separate Services (RECOMMENDED)

## ⚠️ Fix for "externally-managed-environment" Error

If you got the Python environment error, deploy backend and frontend as **separate services** instead. This is actually the **better approach** for Railway!

---

## 🚀 Deploy in 15 Minutes (Separate Services)

### **Step 1: Deploy Backend First** (5 minutes)

1. Go to https://railway.com/new/
2. Click **"Deploy from GitHub repo"**
3. Select: **vmsantos44/nice**
4. Click **"Add variables"**

**Add these environment variables:**

| Variable | Value |
|----------|-------|
| `ZOHO_CLIENT_ID` | Your Zoho Client ID |
| `ZOHO_CLIENT_SECRET` | Your Zoho Client Secret |
| `ZOHO_REFRESH_TOKEN` | Your Zoho Refresh Token |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Your Zoho Books Org ID |
| `PORT` | `8000` |

5. **IMPORTANT:** Click **"Settings"** (before deploying)
6. Find **"Root Directory"**
7. Set to: `/backend` ✅
8. Find **"Start Command"**
9. Set to: `pip install --break-system-packages -r requirements.txt && python main.py`
10. Click **"Deploy"**
11. Wait 2-3 minutes for deployment
12. **Copy your backend URL** (e.g., `https://nice-backend.railway.app`)

---

### **Step 2: Deploy Frontend** (5 minutes)

1. In the same Railway project, click **"New"** → **"GitHub Repo"**
2. Select: **vmsantos44/nice** (same repo)
3. Click **"Add variables"**

**Add this environment variable:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend-url.railway.app` |

(Use the backend URL from Step 1)

4. Click **"Settings"**
5. Find **"Root Directory"**
6. Set to: `/frontend` ✅
7. Find **"Start Command"**
8. Set to: `npm install && npm run build && npm start`
9. Click **"Deploy"**
10. Wait 3-5 minutes for build and deployment
11. **Copy your frontend URL** (e.g., `https://nice-frontend.railway.app`)

---

### **Step 3: Update Backend CORS (if needed)** (2 minutes)

If you get CORS errors:

1. Add this variable to **backend service**:
   - **Key:** `FRONTEND_URL`
   - **Value:** `https://your-frontend-url.railway.app`

2. Backend automatically allows this URL (already configured in code)

---

### **Step 4: Test Your App!** 🎉

1. Visit your **frontend URL**
2. App should load ✅
3. Try **"Fetch from Zoho"** → Should work ✅
4. Try **Items Sync** tab → Should work ✅
5. Try **Bulk Edit Panel** → Should work ✅

---

## 📊 What You'll Have

After deployment:

```
Project: nice
├── Service 1: Backend (FastAPI)
│   URL: https://nice-backend.railway.app
│   Port: 8000
│
└── Service 2: Frontend (Next.js)
    URL: https://nice-frontend.railway.app
    Port: 3000
```

Users visit: **Frontend URL** → App works perfectly!

---

## 💰 Cost

**Both services for $5/month total**
- Backend service: ~$2.50/month
- Frontend service: ~$2.50/month
- PostgreSQL (optional): Included in plan

---

## 🔧 Troubleshooting

### Backend Deployment Fails
**Error:** "externally-managed-environment"
- **Fix:** Make sure Start Command includes `--break-system-packages`:
  ```
  pip install --break-system-packages -r requirements.txt && python main.py
  ```

### Frontend Can't Connect to Backend
**Error:** "Network Error" or "CORS error"
- **Fix 1:** Check `NEXT_PUBLIC_API_URL` is correct
- **Fix 2:** Make sure backend URL ends with port (if needed)
- **Fix 3:** Add `FRONTEND_URL` to backend variables

### Build Takes Forever
- **Frontend:** First build takes 3-5 minutes (Next.js build)
- **Backend:** Should be quick (1-2 minutes)
- **Tip:** Watch deployment logs for progress

---

## 🎯 Quick Checklist

### Backend Service:
- [ ] Root Directory: `/backend`
- [ ] Start Command: `pip install --break-system-packages -r requirements.txt && python main.py`
- [ ] Variables: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_BOOKS_ORGANIZATION_ID, PORT
- [ ] Deployed successfully
- [ ] URL copied

### Frontend Service:
- [ ] Root Directory: `/frontend`
- [ ] Start Command: `npm install && npm run build && npm start`
- [ ] Variable: NEXT_PUBLIC_API_URL (backend URL)
- [ ] Deployed successfully
- [ ] URL copied

### Testing:
- [ ] Frontend loads
- [ ] Fetch from Zoho works
- [ ] Items Sync works
- [ ] Bulk Edit Panel appears

---

## 🚀 Benefits of Separate Services

✅ **No Nix environment conflicts**
✅ **Independent scaling** (scale backend/frontend separately)
✅ **Better logs** (separate logs for each service)
✅ **Easier debugging** (isolate issues)
✅ **Production best practice**

---

## 🔄 Next Steps After Deployment

### 1. Add PostgreSQL Database (Recommended)
```
1. In Railway project → "New" → "Database" → "PostgreSQL"
2. Copy DATABASE_URL
3. Add to backend service variables
4. Backend auto-switches from SQLite to PostgreSQL
```

### 2. Enable Auto-Deploy
```
1. Backend service → Settings → "Auto Deploy" → Enable
2. Frontend service → Settings → "Auto Deploy" → Enable
3. Now: Push to GitHub → Auto-deploys both services
```

### 3. Add Custom Domain
```
1. Frontend service → Settings → "Domains"
2. Add your domain (e.g., payments.yourdomain.com)
3. Add CNAME record in your DNS
4. Railway auto-provisions SSL
```

---

## 📞 Still Having Issues?

Check Railway's logs:
1. Click on service
2. Go to **"Deployments"** tab
3. Click latest deployment
4. View logs for errors

Common fixes:
- Root directory wrong → Check Settings
- Start command wrong → Check Settings
- Missing environment variables → Check Variables tab
- Build fails → Check logs for specific error

---

**Deployment time:** 15 minutes total
**Cost:** $5/month for both services
**Difficulty:** ⭐⭐ Easy

---

**Last Updated:** October 2025
