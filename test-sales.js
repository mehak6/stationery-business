// Check current sales in database
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSales() {
  console.log('🔍 Checking Sales Data...\n')

  try {
    // Check sales with product info
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        *,
        products (
          id,
          name,
          categories (name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ Error fetching sales:', error)
      return
    }

    console.log(`📊 Found ${sales?.length || 0} sales`)
    
    if (sales && sales.length > 0) {
      console.log('\n📋 Sales Details:')
      sales.forEach((sale, index) => {
        console.log(`${index + 1}. ${sale.products?.name || 'Unknown Product'} - Qty: ${sale.quantity} - Total: ₹${sale.total_amount} - Date: ${sale.sale_date}`)
      })
    } else {
      console.log('\n💭 No sales found in database')
      console.log('\n🎯 To test sales:')
      console.log('1. Go to http://localhost:3000')
      console.log('2. Add a product first (if none exist)')
      console.log('3. Go to Quick Sale')
      console.log('4. Select a product and complete a sale')
      console.log('5. Check dashboard for updated data')
    }

    // Check products too
    const { data: products } = await supabase
      .from('products')
      .select('id, name, stock_quantity')
      .limit(5)

    console.log(`\n📦 Products available: ${products?.length || 0}`)
    if (products?.length > 0) {
      products.forEach(p => {
        console.log(`   - ${p.name}: ${p.stock_quantity} in stock`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkSales()