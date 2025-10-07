# Replit Deployment Guide - Alfa Payment System

This guide will help you deploy the Alfa Payment System to Replit from your GitHub repository.

---

## 📋 Prerequisites

Before deploying to Replit, make sure you have:

1. **GitHub Repository**: Your code is pushed to GitHub (https://github.com/vmsantos44/Alfapayment)
2. **Zoho API Credentials**:
   - Zoho Client ID
   - Zoho Client Secret
   - Zoho Refresh Token
   - Zoho Books Organization ID

---

## 🚀 Step-by-Step Deployment

### Step 1: Import from GitHub to Replit

1. Go to [Replit](https://replit.com)
2. Click **"Create Repl"**
3. Select **"Import from GitHub"**
4. Enter your repository URL: `https://github.com/vmsantos44/Alfapayment`
5. Click **"Import from GitHub"**
6. Replit will automatically detect the configuration files

---

### Step 2: Configure Environment Variables (CRITICAL!)

After import, you **MUST** set up environment variables:

1. Click the **"Secrets"** tab (🔒 lock icon) in the left sidebar
2. Add the following secrets:

**Required Secrets:**

| Key | Example Value | Where to Get |
|-----|---------------|--------------|
| `ZOHO_CLIENT_ID` | `1000.XXXXXXXXX` | https://api-console.zoho.com |
| `ZOHO_CLIENT_SECRET` | `xxxxxxxxxxxxx` | https://api-console.zoho.com |
| `ZOHO_REFRESH_TOKEN` | `1000.xxxxxx.xxxxx` | Generate from Zoho OAuth flow |
| `ZOHO_BOOKS_ORGANIZATION_ID` | `123456789` | https://books.zoho.com/app#/settings/organization |

**Optional Secrets:**

| Key | Default Value | Description |
|-----|---------------|-------------|
| `ZOHO_REGION` | `US` | Your Zoho data center (US, EU, IN, AU, JP, CN) |
| `ZOHO_CRM_MODULE` | `Contacts` | Which CRM module to sync from |
| `PORT` | `8000` | Backend port (usually auto-configured) |

---

### Step 3: Install Dependencies

Replit should automatically install dependencies, but if not:

1. Open the **Shell** tab
2. Run these commands:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && pip install -r requirements.txt && cd ..
```

---

### Step 4: Start the Application

Click the **"Run"** button at the top of Replit.

The application will:
1. Start the FastAPI backend on port 8000
2. Start the Next.js frontend on port 3000
3. Automatically open the frontend in a webview

---

### Step 5: Access Your Application

- **Frontend (Main App)**: `https://<your-repl-name>.<your-username>.repl.co`
- **Backend API**: `https://<your-repl-name>.<your-username>.repl.co:8000`
- **API Docs**: `https://<your-repl-name>.<your-username>.repl.co:8000/docs`

---

## 🗄️ Database Setup

The application uses **SQLite** (`backend/alfa_payment.db`), which is included in the repository.

**Important Notes:**

1. **Database Persistence**: Replit preserves files, so your database will persist between runs
2. **Backup Database**: Download `backend/alfa_payment.db` regularly for backups
3. **Fresh Start**: Delete `backend/alfa_payment.db` to reset the database (will auto-create with default clients)

---

## 🔧 How It Works on Replit

### File Structure
```
/
├── .replit              # Replit run configuration
├── replit.nix          # Nix packages (Node.js, Python, SQLite)
├── package.json        # Root scripts to run both servers
├── frontend/           # Next.js app
│   ├── package.json
│   └── ...
└── backend/            # FastAPI app
    ├── requirements.txt
    ├── main.py
    ├── alfa_payment.db  # SQLite database
    └── ...
```

### Running Services

When you click "Run", Replit executes:
```bash
npm run start:all
```

Which runs concurrently:
- **Backend**: `python backend/main.py` (port 8000)
- **Frontend**: `npm start` in frontend directory (port 3000)

---

## ⚠️ Important Considerations

### 1. **Always-On Replit (Paid Feature)**
- Free Repls sleep after inactivity
- For production, consider Replit's "Always-On" feature ($7/month)
- Alternative: Use a service like UptimeRobot to ping your app every 5 minutes

### 2. **Environment Variables**
- **Never commit `.env` files** to GitHub
- Always use Replit Secrets for sensitive data
- Backend reads from environment variables automatically

### 3. **API Rate Limits**
- Zoho CRM has API rate limits
- The app includes rate limiting (`backend/rate_limiter.py`)
- Default: 10 calls per 10 seconds (adjust in Secrets if needed)

### 4. **Database Backups**
Since SQLite is file-based:
- Download `backend/alfa_payment.db` regularly
- Or upgrade to PostgreSQL (see below)

---

## 🔄 Upgrading to PostgreSQL (Optional)

For production with heavy usage:

1. Create a PostgreSQL database (e.g., on Replit, Railway, or Supabase)
2. Add to Replit Secrets:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```
3. Update `backend/database.py` to use PostgreSQL URL instead of SQLite
4. Run migrations to create tables

---

## 🐛 Troubleshooting

### Frontend Can't Connect to Backend
- Check that `FRONTEND_URL` environment variable is set correctly
- Verify CORS settings in `backend/main.py`
- Ensure both services are running (check Shell for errors)

### Backend Database Errors
- Delete `backend/alfa_payment.db` to recreate
- Check SQLite is installed: `which sqlite3` in Shell
- Verify `backend/database.py` configuration

### Zoho API Errors
- Verify all Zoho secrets are set correctly
- Check token hasn't expired (refresh tokens are long-lived but can expire)
- Confirm API scopes include required permissions

### Import Errors
- Run `pip install -r backend/requirements.txt` manually
- Check Python version: `python --version` (should be 3.11)

---

## 📚 Useful Replit Commands

Run these in the Shell tab:

```bash
# Check running processes
ps aux

# Restart backend only
pkill -f "python main.py" && cd backend && python main.py &

# Restart frontend only
pkill -f "next" && cd frontend && npm start &

# View backend logs
tail -f backend/logs/*.log

# Check database
sqlite3 backend/alfa_payment.db ".tables"

# Backup database
cp backend/alfa_payment.db backend/alfa_payment.db.backup_$(date +%Y%m%d_%H%M%S)
```

---

## 🎯 Next Steps After Deployment

1. ✅ Verify the frontend loads at your Repl URL
2. ✅ Test API at `/docs` endpoint
3. ✅ Import interpreters from Zoho using the "Fetch from Zoho" button
4. ✅ Sync items from Zoho Books using the "Items Sync" tab
5. ✅ Create a test payment to verify full workflow

---

## 🔐 Security Checklist

- [ ] All Zoho credentials in Replit Secrets (not in code)
- [ ] `.env` file is in `.gitignore` (already done)
- [ ] Database backups scheduled
- [ ] API endpoints have proper authentication (if needed)
- [ ] CORS configured for your domain only

---

## 📞 Support

If you encounter issues:
1. Check the Shell tab for error messages
2. Review `backend/logs/` for detailed logs
3. Verify all environment variables are set
4. Restart the Repl (Stop → Run)

---

**Last Updated**: October 2025
**Replit Requirements**: Node.js 20+, Python 3.11+, SQLite
**Estimated Setup Time**: 10-15 minutes
