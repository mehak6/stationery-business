# 🚀 Deployment Guide

Complete guide to deploy your Stationery & Games Inventory Management System to Vercel with Supabase.

## 📋 Prerequisites

1. GitHub account
2. Vercel account (sign up with GitHub)
3. Supabase account (free tier)

## 🔧 Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" 
3. Sign in with GitHub
4. Click "New Project"
5. Choose your organization
6. Enter project details:
   - **Name**: `stationery-inventory`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
7. Click "Create new project"
8. Wait for setup to complete (~2 minutes)

### 1.2 Get Database Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (starts with `https://`)
   - **Anon public** key (long JWT token)
3. Save these for later use

### 1.3 Setup Database Schema
1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy the entire content of `inventory_setup.sql`
4. Paste it in the SQL editor
5. Click "Run" to execute
6. Verify tables are created in **Table Editor**

Expected tables:
- `categories` - Product categories
- `products` - Inventory items
- `sales` - Transaction records
- `customers` - Customer information

## 🚀 Step 2: GitHub Repository

### 2.1 Create Repository
1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Repository details:
   - **Name**: `stationery-business`
   - **Description**: `A comprehensive inventory management system for stationery and games businesses`
   - **Visibility**: Public (or Private if preferred)
4. Click "Create repository"

### 2.2 Push Code
```bash
# Add GitHub remote (replace USERNAME with your GitHub username)
git remote add origin https://github.com/USERNAME/stationery-business.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🌐 Step 3: Vercel Deployment

### 3.1 Connect GitHub to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/in with GitHub
3. Click "Import Project"
4. Select your `stationery-business` repository
5. Click "Import"

### 3.2 Configure Environment Variables
Before deploying, add environment variables:

1. In Vercel dashboard, go to **Settings** → **Environment Variables**
2. Add these variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key | Production, Preview, Development |
| `NEXT_PUBLIC_APP_NAME` | `Stationery & Games Inventory` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_VERSION` | `1.0.0` | Production, Preview, Development |

### 3.3 Deploy
1. Click "Deploy" in Vercel
2. Wait for build to complete (~2-3 minutes)
3. Click on the generated URL to test your app

## ✅ Step 4: Verification

### 4.1 Test Application
1. Open your Vercel app URL
2. Verify the dashboard loads
3. Try adding a test product
4. Check if data persists in Supabase

### 4.2 Check Database
1. Go to Supabase **Table Editor**
2. Check `products` table for test data
3. Verify real-time updates work

## 🔄 Step 5: Ongoing Updates

### 5.1 Automatic Deployments
- Any push to `main` branch triggers automatic deployment
- Preview deployments for pull requests
- Rollback to previous versions available

### 5.2 Database Updates
- Run SQL migrations in Supabase SQL Editor
- Updates are immediately available to your app
- Use `cleanup_script.sql` for data cleanup if needed

## 📱 Features Available After Deployment

✅ **Dashboard**: Business analytics and KPIs  
✅ **Inventory Management**: Add, edit, delete products  
✅ **Sales Tracking**: Record transactions with profit calculation  
✅ **Category Management**: Organize products  
✅ **Real-time Updates**: Live data synchronization  
✅ **Mobile Responsive**: Works on all devices  
✅ **Print Support**: Print-friendly reports  

## 🛠️ Troubleshooting

### Common Issues:

**1. "Failed to fetch" errors**
- Check environment variables are set correctly
- Verify Supabase URL and key are valid
- Ensure Supabase project is running

**2. Database connection fails**
- Verify SQL schema was executed successfully
- Check Supabase project status
- Validate environment variable names (exact spelling)

**3. Build errors in Vercel**
- Check build logs for specific errors
- Verify all dependencies are in `package.json`
- Ensure TypeScript errors are resolved

**4. Data not saving**
- Check Supabase logs in dashboard
- Verify RLS policies allow operations
- Test database connection in SQL Editor

## 📊 Monitoring

### Vercel Analytics
- Enable in Vercel dashboard for traffic insights
- Monitor performance and errors
- Track user engagement

### Supabase Monitoring
- Database performance in Supabase dashboard
- API usage and limits
- Real-time connections

## 💰 Cost Breakdown

**Total Monthly Cost: $0** (within free tiers)

- **Vercel**: Free for personal projects
  - 100GB bandwidth
  - Unlimited static requests
  - Serverless functions included

- **Supabase**: Free tier includes
  - 500MB database storage
  - 2GB bandwidth
  - 50,000 API requests
  - Real-time subscriptions

## 🎉 You're Live!

Your inventory management system is now deployed and ready for use!

**Next Steps:**
- Share the URL with your team
- Start adding your real inventory data
- Customize the app for your specific needs
- Set up regular backups in Supabase

---

**Need help?** Check the main README.md for detailed technical documentation.