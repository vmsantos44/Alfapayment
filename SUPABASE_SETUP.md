# Supabase Database Setup Guide

This guide will help you set up a free PostgreSQL database on Supabase for your Alfa Payment System.

## Why Supabase?

- ✅ **Free Tier**: 500MB database, 2GB file storage, 50k monthly active users
- ✅ **PostgreSQL**: Full-featured, production-ready database
- ✅ **Auto-backups**: Daily backups included
- ✅ **Dashboard**: Visual interface to view/edit data
- ✅ **Easy deployment**: Works seamlessly with Railway/Render

---

## Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub (recommended) or email

---

## Step 2: Create New Project

1. Click **"New Project"**
2. Fill in project details:
   - **Name**: `alfa-payment-system`
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., US West)
   - **Pricing Plan**: Free

3. Click **"Create new project"**
4. Wait ~2 minutes for setup to complete

---

## Step 3: Get Database Connection String

1. In your Supabase project dashboard, click **"Settings"** (gear icon)
2. Go to **"Database"** section
3. Scroll down to **"Connection string"**
4. Select **"URI"** tab
5. Copy the connection string that looks like:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

**Important:** Replace `[YOUR-PASSWORD]` with the password you created in Step 2

### Connection Pooling (Recommended for Production)

For serverless deployments (Vercel, Railway), use the **pooled connection**:

1. In the same Database settings page
2. Look for **"Connection Pooling"** section
3. Copy the **Pooler** connection string (port 6543):

```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

---

## Step 4: Update Backend Configuration

1. Open `/backend/.env` file
2. Replace the DATABASE_URL:

```bash
# Comment out SQLite
# DATABASE_URL=sqlite:///./alfa_payment.db

# Add Supabase connection (use pooled connection for production)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres
```

---

## Step 5: Install Dependencies & Start

```bash
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start the server (tables will be created automatically)
uvicorn main:app --reload
```

You should see:
```
✅ Default clients initialized
INFO:     Application startup complete.
```

---

## Step 6: Verify Database Setup

### Option A: Using Supabase Dashboard

1. Go to your Supabase project
2. Click **"Table Editor"** in sidebar
3. You should see tables:
   - `clients`
   - `interpreters`
   - `payments`
   - `payment_batches`

### Option B: Using API Documentation

1. Open `http://localhost:8000/docs`
2. Try the endpoints:
   - `GET /api/clients` - Should return 3 default clients
   - `GET /api/interpreters` - Should return empty array
   - `GET /` - Should show `"database": "connected"`

---

## Step 7: Deploy to Production

### For Railway:

1. In Railway dashboard, go to your backend service
2. Click **"Variables"** tab
3. Add new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string (pooled)
4. Redeploy

### For Render:

1. In Render dashboard, go to your web service
2. Click **"Environment"** tab
3. Add environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string (pooled)
4. Save changes (auto-redeploys)

---

## Database Schema Overview

### Tables Created Automatically

**interpreters**
- Stores interpreter information (name, IDs, rates)
- Indexes on client IDs for fast matching

**clients**
- Stores client information (name, ID fields, column templates)
- Pre-populated with 3 default clients

**payments**
- Stores calculated payment records
- Links to interpreters and clients
- Tracks status, adjustments, notes

**payment_batches**
- Tracks import batches for auditing
- Stores summary statistics

---

## Backup & Security

### Automatic Backups
Supabase automatically backs up your database daily.

To download a backup:
1. Go to **Database** → **Backups** in Supabase
2. Click **"Download"** on any backup

### Security Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Use environment variables** - Store DATABASE_URL in deployment platform
3. **Row Level Security (RLS)** - Supabase supports this for multi-tenant apps

---

## Troubleshooting

### Connection Failed

**Error**: `could not connect to server`

**Solutions**:
- Check your internet connection
- Verify the DATABASE_URL is correct
- Make sure you replaced `[YOUR-PASSWORD]`
- Try the direct connection (port 5432) instead of pooled

### Tables Not Created

**Error**: Tables don't appear in Supabase

**Solutions**:
1. Restart backend server
2. Check logs for database connection errors
3. Try running migrations manually:

```python
from models import Base
from database import engine
Base.metadata.create_all(bind=engine)
```

### Too Many Connections

**Error**: `remaining connection slots are reserved`

**Solutions**:
- Use **pooled connection** (port 6543)
- Set connection pooling in SQLAlchemy

---

## Local Development vs Production

### Local (SQLite)
```bash
DATABASE_URL=sqlite:///./alfa_payment.db
```
- Fast for testing
- No internet needed
- Single file database

### Production (Supabase)
```bash
DATABASE_URL=postgresql://postgres:...@db....supabase.co:6543/postgres
```
- Persistent storage
- Multi-user support
- Automatic backups
- Scalable

---

## Next Steps

After Supabase is set up:

1. ✅ Import your interpreters via CSV
2. ✅ Process client payment reports
3. ✅ View data in Supabase dashboard
4. ✅ Export payment reports
5. ✅ Monitor usage in Supabase analytics

---

## Cost & Limits

**Free Tier Limits:**
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth
- Unlimited API requests
- Paused after 1 week of inactivity (easy to resume)

**Paid Tiers Start at $25/month:**
- 8 GB database
- Daily backups
- Point-in-time recovery
- No pausing

For this payment system, free tier should be plenty unless you have thousands of interpreters and millions of payment records.

---

## Support

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord**: Active community support
- **Email**: support@supabase.io

---

## Migration from SQLite to Supabase

If you've been using SQLite and want to migrate data:

```python
# Export from SQLite
import sqlite3
import pandas as pd

# Connect to SQLite
conn = sqlite3.connect('alfa_payment.db')

# Export tables
interpreters = pd.read_sql('SELECT * FROM interpreters', conn)
clients = pd.read_sql('SELECT * FROM clients', conn)
payments = pd.read_sql('SELECT * FROM payments', conn)

# Save as CSV
interpreters.to_csv('interpreters_backup.csv', index=False)
clients.to_csv('clients_backup.csv', index=False)
payments.to_csv('payments_backup.csv', index=False)

conn.close()
```

Then use the bulk import endpoints to load into Supabase.
