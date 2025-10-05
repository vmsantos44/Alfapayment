# Alfa Payment System

Interpreter Payment Management System with Next.js frontend, FastAPI backend, and PostgreSQL/SQLite database.

## 🚀 Features

- **Interpreter Management**: Import from CSV or add manually
- **Client Management**: Manage multiple clients with custom ID fields
- **Payment Calculation**: Automatically match interpreters and calculate payments
- **Analytics Dashboard**: View revenue, payments, profit margins
- **CSV Export**: Export calculated payments for processing
- **Database Persistence**: SQLite for local dev, PostgreSQL (Supabase) for production
- **Payment History**: Track all payments with audit trail
- **Bulk Operations**: Import/export interpreters and payments in bulk

## 📋 Prerequisites

- Node.js 20+ (for frontend)
- Python 3.11+ (for backend)
- npm or yarn

## 🛠️ Local Development

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will run on `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

**Database**: By default, uses SQLite (`alfa_payment.db`). For production with Supabase, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

## 🗄️ Database

### Local Development (SQLite)
- Automatically created as `backend/alfa_payment.db`
- No setup required
- Good for testing

### Production (Supabase PostgreSQL)
- Free tier: 500MB database
- Automatic backups
- Visual dashboard to view data
- See detailed setup guide: [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

### Database Endpoints

All data now persists to the database. Key endpoints:

- `GET/POST /api/interpreters` - Manage interpreters
- `GET/POST /api/clients` - Manage clients
- `GET/POST /api/payments` - Manage payment records
- `GET /api/payments/stats/summary` - Get payment statistics
- Full API docs at `http://localhost:8000/docs`

## 🌐 Deployment

### Frontend - Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project" and import your repository
4. Select the `frontend` directory
5. Add environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend API URL
6. Deploy!

**CLI Deployment:**
```bash
cd frontend
npm install -g vercel
vercel
```

### Backend - Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Set root directory to `backend`
6. Railway will auto-detect FastAPI and deploy!

**CLI Deployment:**
```bash
cd backend
npm install -g @railway/cli
railway login
railway init
railway up
```

### Backend - Render (Alternative)

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New" → "Web Service"
4. Connect your repository
5. Use these settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Deploy!

## 🔧 Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```
PORT=8000
FRONTEND_URL=http://localhost:3000
```

## 📁 Project Structure

```
alfa-payment/
├── frontend/              # Next.js application
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── package.json
│   └── vercel.json       # Vercel deployment config
│
├── backend/              # FastAPI application
│   ├── main.py          # FastAPI app & routes
│   ├── requirements.txt # Python dependencies
│   ├── railway.json     # Railway deployment config
│   └── render.yaml      # Render deployment config
│
└── README.md
```

## 🐛 Fixed Issues

This version fixes several critical bugs from the original:

1. ✅ **Modal re-rendering bug** - Moved modals outside parent component
2. ✅ **CSV parsing** - Uses PapaParse for robust CSV handling
3. ✅ **File upload** - Actually parses uploaded files instead of using mock data
4. ✅ **TypeScript types** - Added proper type definitions
5. ✅ **Typo fixes** - Fixed "Emplyee ID" typo

## 📝 Usage

1. **Import Interpreters**: Upload your CRM CSV with interpreter details and rates
2. **Select Client**: Choose which client's report you're processing
3. **Upload Report**: Import the client's payment report
4. **Map Columns**: System auto-detects columns, adjust if needed
5. **Calculate**: System matches interpreters and calculates payments
6. **Review**: Approve/reject payments, add adjustments if needed
7. **Export**: Download final payment report as CSV

## 🆘 Support

For issues or questions, please create an issue in the repository.

## 📄 License

MIT
