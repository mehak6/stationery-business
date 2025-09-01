# 🗄️ Supabase Database Setup

## Your Supabase Project Details
- **Project URL**: `https://ccpvnpidhxkcbxeeyqeq.supabase.co`
- **Project ID**: `ccpvnpidhxkcbxeeyqeq`
- **Dashboard**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq

## 📋 Setup Instructions

### Step 1: Run Database Schema
1. **Go to SQL Editor**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq/sql
2. **Click "New Query"**
3. **Copy and paste the entire content** from `inventory_setup.sql`
4. **Click "Run"** to execute the script

### Step 2: Verify Tables Created
Go to **Table Editor**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq/editor

You should see these tables:
- ✅ `categories` - Product categories
- ✅ `products` - Inventory items
- ✅ `sales` - Transaction records  
- ✅ `customers` - Customer information

### Step 3: Test Data (Optional)
You can add some test data to verify everything works:

```sql
-- Insert test categories
INSERT INTO categories (name, description) VALUES 
    ('Stationery', 'Pens, pencils, notebooks, etc.'),
    ('Games', 'Board games, puzzles, toys'),
    ('Art Supplies', 'Paints, brushes, canvases');

-- Insert test products
INSERT INTO products (name, category_id, purchase_price, selling_price, stock_quantity, min_stock_level) 
SELECT 
    'Blue Pen',
    c.id,
    5.00,
    8.00,
    50,
    10
FROM categories c WHERE c.name = 'Stationery';

INSERT INTO products (name, category_id, purchase_price, selling_price, stock_quantity, min_stock_level) 
SELECT 
    'Chess Set',
    c.id,
    25.00,
    40.00,
    10,
    5
FROM categories c WHERE c.name = 'Games';
```

## ✅ Verification Checklist

### Database Structure
- [ ] UUID extension enabled
- [ ] All 4 tables created (categories, products, customers, sales)
- [ ] Indexes created for performance
- [ ] Row Level Security disabled (for single-user setup)
- [ ] Triggers and functions working

### Test Application Connection
1. **Local Development**: Environment variables are now set in `.env.local`
2. **Restart Dev Server**: `npm run dev` to pick up new environment
3. **Test CRUD Operations**: Try adding/editing products in the app
4. **Check Supabase**: Verify data appears in Table Editor

### Ready for Production
- [ ] Database schema deployed
- [ ] Local app connects successfully
- [ ] Test data CRUD operations work
- [ ] Ready to deploy to Vercel

## 🚨 Important Notes

### Security Settings
- **Row Level Security**: Disabled for simplicity (single-user app)
- **API Keys**: Only anon key is used (read/write enabled by default)
- **Public Access**: Database is accessible with the provided anon key

### For Production Use
If you plan to add user authentication later:
1. Enable Row Level Security
2. Create proper RLS policies
3. Use the authenticated setup from `supabase_sql_setup.sql`

## 🔗 Quick Links
- **Project Dashboard**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq
- **SQL Editor**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq/sql
- **Table Editor**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq/editor
- **API Settings**: https://supabase.com/dashboard/project/ccpvnpidhxkcbxeeyqeq/settings/api

---

**Next Step**: Run the SQL script and test your local application!