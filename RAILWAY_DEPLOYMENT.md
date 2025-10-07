# Railway Deployment Guide - Alfa Payment System

**Railway is the recommended production deployment platform** - better than Replit for serious applications.

---

## ✨ Why Railway?

- ✅ **Always On** - No sleep (unlike Replit free tier)
- ✅ **PostgreSQL Included** - Better than SQLite
- ✅ **Auto-Deploy from GitHub** - Push to deploy
- ✅ **$5/month** - Includes database and hosting
- ✅ **Production Ready** - Real infrastructure
- ✅ **Easy as Replit** - Simple setup

---

## 🚀 Deployment Methods

You have 2 options:

### **Option A: Monolith (Easier)** - Both services in one deployment
### **Option B: Split Services (Better)** - Frontend and backend separate

**I recommend Option A for simplicity.**

---

## 📦 Option A: Monolith Deployment (Recommended)

Deploy both frontend and backend together as one service.

### Step 1: Go to Railway

1. Click your link: https://railway.com/new/
2. Sign in with GitHub
3. Click **"Deploy from GitHub repo"**

### Step 2: Select Repository

1. Choose: **vmsantos44/Alfapayment**
2. Branch: **feature/item-sync-improvements**
3. Click **"Add variables"**

### Step 3: Add Environment Variables

Click **"Add Variable"** for each:

| Variable Name | Value | Required |
|--------------|-------|----------|
| `ZOHO_CLIENT_ID` | Your Zoho Client ID | ✅ Yes |
| `ZOHO_CLIENT_SECRET` | Your Zoho Client Secret | ✅ Yes |
| `ZOHO_REFRESH_TOKEN` | Your Zoho Refresh Token | ✅ Yes |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Your Zoho Books Org ID | ✅ Yes |
| `PORT` | `8000` | ✅ Yes |
| `ZOHO_REGION` | `US` | Optional |

### Step 4: Configure Service

1. **Service Name:** `alfa-payment`
2. **Start Command:** Railway auto-detects from nixpacks.toml
3. Click **"Deploy"**

### Step 5: Wait for Deployment

- Watch the build logs
- First build takes 3-5 minutes
- You'll see: "✓ Build successful"
- Then: "✓ Deployment successful"

### Step 6: Get Your URLs

Railway will give you:
- **App URL:** `https://alfa-payment-production.up.railway.app`
- Both frontend (port 3000) and backend (port 8000) will be accessible

### Step 7: Add Frontend API URL

After deployment, you need to add one more variable:

1. Go to your service → **Variables** tab
2. Add:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://your-app.up.railway.app:8000`
3. Click **"Redeploy"** (it will use the new variable)

---

## 📦 Option B: Split Services (Advanced)

Deploy frontend and backend as separate services for better scalability.

### Step 1: Deploy Backend First

1. Go to Railway → **New Project**
2. **Deploy from GitHub repo**
3. Repository: `vmsantos44/Alfapayment`
4. **Root Directory:** `/backend`
5. Add environment variables (same as above)
6. **Start Command:** `python main.py`
7. Deploy

### Step 2: Deploy Frontend

1. In same project → **New Service**
2. **Deploy from GitHub repo**
3. Same repository
4. **Root Directory:** `/frontend`
5. Add variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.railway.app`
6. **Start Command:** `npm run build && npm start`
7. Deploy

### Step 3: Link Services

Frontend will call backend via the backend's Railway URL.

---

## 🗄️ Add PostgreSQL Database (Recommended)

SQLite works, but PostgreSQL is better for production.

### Step 1: Add Database

1. In your Railway project → **New** → **Database** → **PostgreSQL**
2. Railway creates the database instantly
3. Copy the **DATABASE_URL** (shown in variables)

### Step 2: Add to Environment

1. Go to your service → **Variables**
2. Add:
   - **Key:** `DATABASE_URL`
   - **Value:** (paste the PostgreSQL URL from database service)
3. Redeploy

### Step 3: Verify

Your app automatically switches from SQLite to PostgreSQL!
(Check `backend/database.py` - it detects PostgreSQL automatically)

---

## ✅ Environment Variables Checklist

Make sure you have all these in Railway Variables:

### Required:
- [ ] `ZOHO_CLIENT_ID`
- [ ] `ZOHO_CLIENT_SECRET`
- [ ] `ZOHO_REFRESH_TOKEN`
- [ ] `ZOHO_BOOKS_ORGANIZATION_ID`
- [ ] `PORT` (set to 8000)
- [ ] `NEXT_PUBLIC_API_URL` (your Railway backend URL)

### Optional:
- [ ] `ZOHO_REGION` (default: US)
- [ ] `ZOHO_CRM_MODULE` (default: Contacts)
- [ ] `DATABASE_URL` (auto-added if you add PostgreSQL)

---

## 🔧 Troubleshooting

### Build Fails
**Error:** "No module named 'fastapi'"
- **Fix:** Make sure `backend/requirements.txt` is in repo
- **Check:** Railway detected Python correctly

### Frontend Can't Connect to Backend
**Error:** "CORS error" or "Network error"
- **Fix:** Add `NEXT_PUBLIC_API_URL` variable
- **Format:** `https://your-backend.railway.app:8000`
- **Then:** Redeploy

### Database Issues
**Error:** "No such table"
- **Fix:** Tables auto-create on first run
- **Check:** Look at deployment logs for "✅ Default clients initialized"

### App Crashes
**Check logs:**
1. Go to service → **Deployments** tab
2. Click latest deployment → **View Logs**
3. Look for error messages

---

## 📊 Post-Deployment Testing

Once deployed, test these:

1. **Frontend Access**
   - Visit: `https://your-app.railway.app`
   - Should see Alfa Payment System

2. **Backend API**
   - Visit: `https://your-app.railway.app:8000/docs`
   - Should see FastAPI documentation

3. **Database**
   - Check: Clients tab shows Cloudbreak, Languagelink, Propio
   - If empty, database didn't initialize

4. **Zoho Integration**
   - Click: "Fetch from Zoho" button
   - Should import interpreters

5. **Item Sync**
   - Go to: Items Sync tab
   - Select organization
   - Fetch items from Zoho Books

---

## 💰 Railway Pricing

### Trial:
- **$5 credit** when you sign up
- Enough for 1 month of testing

### Production:
- **$5/month** minimum
- Includes:
  - Web service (always on)
  - PostgreSQL database
  - Automatic deployments

### Comparison:
- Replit Always-On: $7/month
- Railway: $5/month (includes DB)
- **Railway is cheaper and better!**

---

## 🚀 Auto-Deploy Setup

After initial deployment:

1. Go to service → **Settings**
2. Enable **"Auto Deploy"**
3. Now: Push to GitHub → Railway auto-deploys ✨

**Workflow:**
```
git push origin feature/item-sync-improvements
→ Railway detects push
→ Auto builds and deploys
→ Live in 2-3 minutes
```

---

## 🔄 Database Migration (SQLite → PostgreSQL)

If you have data in SQLite locally:

### Option 1: Fresh Start
- Just add PostgreSQL to Railway
- Database auto-creates with default clients
- Re-import interpreters from Zoho

### Option 2: Migrate Data
```bash
# Export from SQLite
sqlite3 backend/alfa_payment.db .dump > backup.sql

# Convert to PostgreSQL format (fix syntax)
sed 's/AUTOINCREMENT//' backup.sql > postgres.sql

# Import to Railway PostgreSQL
# (Use Railway's psql shell or database client)
psql $DATABASE_URL < postgres.sql
```

---

## 📝 Custom Domain (Optional)

Railway supports custom domains:

1. Go to service → **Settings** → **Domains**
2. Click **"Add Custom Domain"**
3. Enter: `payments.yourdomain.com`
4. Add CNAME record to your DNS
5. Railway auto-provisions SSL

**Result:** `https://payments.yourdomain.com` 🎉

---

## 🔐 Security Best Practices

### Environment Variables:
- ✅ All secrets in Railway Variables (not in code)
- ✅ Never commit `.env` files
- ✅ Rotate Zoho tokens regularly

### Database:
- ✅ Use PostgreSQL (not SQLite) in production
- ✅ Enable automatic backups in Railway
- ✅ Restrict database access

### CORS:
- ✅ Already configured for HTTPS
- ✅ Allow only your domain in production (optional)

---

## 📈 Monitoring

Railway provides:

1. **Deployment Logs** - Build and runtime logs
2. **Metrics** - CPU, Memory, Network usage
3. **Health Checks** - Auto-restart if crashed
4. **Alerts** - Email when service is down

Access: Service → **Observability** tab

---

## 🎯 Quick Start Checklist

Follow this exact order:

1. [ ] Go to https://railway.com/new/
2. [ ] Sign in with GitHub
3. [ ] Deploy from GitHub repo
4. [ ] Select: `vmsantos44/Alfapayment`
5. [ ] Branch: `feature/item-sync-improvements`
6. [ ] Add 4 Zoho environment variables
7. [ ] Add `PORT=8000`
8. [ ] Click "Deploy"
9. [ ] Wait 3-5 minutes for build
10. [ ] Copy your Railway URL
11. [ ] Add `NEXT_PUBLIC_API_URL` variable (your URL + `:8000`)
12. [ ] Click "Redeploy"
13. [ ] Test your app!
14. [ ] (Optional) Add PostgreSQL database
15. [ ] (Optional) Set up auto-deploy

---

## 🆚 Railway vs Replit

| Feature | Railway | Replit |
|---------|---------|--------|
| **Always On** | ✅ Yes | ❌ No (free tier sleeps) |
| **PostgreSQL** | ✅ Included | ❌ No |
| **Price** | $5/month | $7/month (always-on) |
| **Performance** | ⚡ Fast | 🐢 Slower |
| **Auto-Deploy** | ✅ Yes | ⚠️ Manual |
| **Custom Domain** | ✅ Yes | ✅ Yes (paid) |
| **Production Ready** | ✅ Yes | ⚠️ Limited |

**Winner: Railway** 🏆

---

## 🎉 Success!

Once deployed, you should see:
- ✅ Frontend at `https://your-app.railway.app`
- ✅ Backend API at `https://your-app.railway.app:8000/docs`
- ✅ Default clients created
- ✅ Zoho integration working
- ✅ Item Sync functional
- ✅ Bulk Edit Panel working

---

**Questions? Check Railway's docs: https://docs.railway.app**

**Last Updated:** October 2025
**Deployment Time:** ~10 minutes
**Cost:** $5/month
