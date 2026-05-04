'use client';

import React, { useState, useEffect } from 'react';
import {
  getProducts,
  getSales,
  getPartyPurchases,
  getSalesByDateRange,
  getClosingStockForYear
} from 'lib/offline-adapter';
import { 
  getFinancialYear, 
  getFYRange, 
  getFYList,
  formatFYLabel
} from 'lib/date-utils';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO, getCurrentDateISO, getCurrentDateDisplay } from '../utils/dateHelpers';
import type { Product, Sale, PartyPurchase } from 'supabase_client';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Calendar, 
  Filter, 
  Download,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';

interface ReportsProps {
  onNavigate: (view: string) => void;
}

export default function Reports({ onNavigate }: ReportsProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [financialYear, setFinancialYear] = useState(getFinancialYear());
  const [historicalStock, setHistoricalStock] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getCurrentDateISO());
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState(getCurrentDateDisplay());
  const [filterApplied, setFilterApplied] = useState(false);
  const [isCustomRange, setIsCustomRange] = useState(false);

  const isCurrentYear = financialYear === getFinancialYear() && !isCustomRange;

  useEffect(() => {
    if (!isCustomRange) {
      // Set default date range based on financial year
      const range = getFYRange(financialYear);
      setStartDate(range.start);
      setStartDateDisplay(formatDateToDDMMYYYY(range.start));
      
      // For end date, use either the end of FY or today if today is earlier
      const today = getCurrentDateISO();
      const effectiveEnd = today < range.end ? today : range.end.split('T')[0];
      setEndDate(effectiveEnd);
      setEndDateDisplay(formatDateToDDMMYYYY(effectiveEnd));

      fetchReportsData(financialYear);
    }
  }, [financialYear, isCustomRange]);

  const fetchReportsData = async (year: string) => {
    try {
      setLoading(true);
      const range = getFYRange(year);
      const [productsData, salesData, partyData, closingData] = await Promise.all([
        getProducts(),
        getSalesByDateRange(range.start, range.end),
        getPartyPurchases(),
        year !== getFinancialYear() ? getClosingStockForYear(year) : Promise.resolve({})
      ]);

      setProducts(productsData || []);
      setSales(salesData || []);
      setPartyPurchases(partyData || []);
      setHistoricalStock(closingData || {});
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = async () => {
    if (startDate && endDate) {
      try {
        setLoading(true);
        setIsCustomRange(true);
        const [filteredSales, productsData] = await Promise.all([
          getSalesByDateRange(startDate, endDate),
          getProducts()
        ]);
        setSales(filteredSales || []);
        setProducts(productsData || []);
        setFilterApplied(true);
        setStartDateDisplay(formatDateToDDMMYYYY(startDate));
        setEndDateDisplay(formatDateToDDMMYYYY(endDate));
      } catch (error) {
        console.error('Error applying date filter:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const clearFilter = async () => {
    setIsCustomRange(false);
    setFilterApplied(false);
    fetchReportsData(financialYear);
  };

  const downloadReport = () => {
    // Calculate monthly breakdown
    const monthlyData: Record<string, { revenue: number, profit: number, count: number }> = {};
    sales.forEach(sale => {
      const month = new Date(sale.sale_date).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0, count: 0 };
      monthlyData[month].revenue += Number(sale.total_amount);
      monthlyData[month].profit += Number(sale.profit);
      monthlyData[month].count += 1;
    });

    const reportData = {
      report_type: isCustomRange ? 'Custom Range' : `Financial Year ${financialYear}`,
      generated_at: new Date().toISOString(),
      business_summary: {
        total_sales_revenue: totalSalesRevenue,
        total_net_profit: totalProfit,
        profit_margin_percent: profitMargin.toFixed(2),
        total_inventory_investment: totalInvestment,
        current_inventory_value: currentInventoryValue,
        total_items_sold: totalQuantitySold,
        average_sale_value: avgSaleValue,
        total_transactions: sales.length
      },
      monthly_performance: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data
      })),
      top_performing_products: topProducts.map(p => ({
        name: p.name,
        quantity_sold: p.salesData.quantity,
        revenue: p.salesData.revenue,
        profit: p.salesData.profit
      })),
      period_covered: {
        start: startDateDisplay,
        end: endDateDisplay
      }
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `business_report_${isCustomRange ? 'custom' : financialYear}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate investment based on either current stock or historical closing stock
  const getStockForProduct = (p: Product) => isCurrentYear ? p.stock_quantity : (historicalStock[p.id] ?? 0);

  const totalProductInvestment = products.reduce((sum, p) => sum + (p.purchase_price * getStockForProduct(p)), 0);
  const totalPartyInvestment = isCurrentYear ? partyPurchases.reduce((sum, pp) => sum + (pp.purchase_price * pp.remaining_quantity), 0) : 0;
  const totalInvestment = totalProductInvestment + totalPartyInvestment;
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalCostOfGoodsSold = totalSalesRevenue - totalProfit;
  const profitMargin = totalSalesRevenue > 0 ? (totalProfit / totalSalesRevenue) * 100 : 0;
  const currentInventoryValue = products.reduce((sum, p) => sum + (p.selling_price * getStockForProduct(p)), 0);

  const productSalesMap = sales.reduce((acc: Record<string, any>, sale) => {
    if (!acc[sale.product_id]) acc[sale.product_id] = { revenue: 0, profit: 0, quantity: 0 };
    acc[sale.product_id].revenue += sale.total_amount;
    acc[sale.product_id].profit += sale.profit;
    acc[sale.product_id].quantity += sale.quantity;
    return acc;
  }, {});

  const topProducts = products
    .map(p => ({ ...p, salesData: productSalesMap[p.id] || { revenue: 0, profit: 0, quantity: 0 } }))
    .filter(p => p.salesData.revenue > 0)
    .sort((a, b) => b.salesData.revenue - a.salesData.revenue)
    .slice(0, 5);

  const totalQuantitySold = sales.reduce((sum, s) => sum + s.quantity, 0);
  const avgSaleValue = sales.length > 0 ? totalSalesRevenue / sales.length : 0;
  const totalItemsInInventory = products.reduce((sum, p) => sum + getStockForProduct(p), 0);

  if (loading) return (
    <div className="p-12 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-gray-500 font-medium">Analyzing business data...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      {/* Enhanced Header with Date Controls */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-8">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {isCustomRange ? 'Custom Performance Report' : 'Yearly Performance'}
          </h1>
          <p className="text-gray-600 mt-1 font-medium">
            {isCustomRange 
              ? `Showing data from ${startDateDisplay} to ${endDateDisplay}`
              : `Business summary for financial year ${financialYear}`}
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          {/* FY Selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
            <Calendar className="h-4 w-4 text-primary-500" />
            <select 
              value={financialYear}
              onChange={(e) => {
                setFinancialYear(e.target.value);
                setIsCustomRange(false);
              }}
              className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
            >
              {getFYList().map(fy => (
                <option key={fy} value={fy}>{formatFYLabel(fy)}</option>
              ))}
            </select>
          </div>

          <div className="h-8 w-[1px] bg-gray-100 hidden md:block"></div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-[10px] uppercase font-black text-gray-400">From</span>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-[10px] uppercase font-black text-gray-400">To</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none"
              />
            </div>
            <button 
              onClick={applyDateFilter}
              className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
              title="Apply Custom Range"
            >
              <Filter className="h-4 w-4" />
            </button>
            {isCustomRange && (
              <button 
                onClick={clearFilter}
                className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors"
                title="Reset to FY"
              >
                <AlertCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="h-8 w-[1px] bg-gray-100 hidden md:block"></div>

          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 font-bold text-sm rounded-xl hover:bg-primary-100 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Core Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <BarChart3 className="h-16 w-16" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Revenue</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-tight">Total Sales</p>
            <p className="text-3xl font-black text-gray-900 mt-1">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-bold text-blue-600">₹{totalCostOfGoodsSold.toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 font-medium">COGS</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp className="h-16 w-16" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">+{profitMargin.toFixed(1)}%</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-tight">Net Profit</p>
            <p className="text-3xl font-black text-green-600 mt-1">₹{totalProfit.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-2 font-medium">Earnings after costs</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <DollarSign className="h-16 w-16" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-wider">Capital</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-tight">Stock Investment</p>
            <p className="text-3xl font-black text-gray-900 mt-1">₹{totalInvestment.toLocaleString('en-IN')}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-bold text-orange-600">{totalItemsInInventory.toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 font-medium">items in hand</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <ShoppingCart className="h-16 w-16" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-tight">Orders Processed</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{sales.length.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-bold text-purple-600">₹{avgSaleValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              <span className="text-[10px] text-gray-400 font-medium">avg per order</span>
            </div>
          </div>
        </div>

        {/* Detailed Performance Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Financial Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-bold text-sm">Gross Sales:</span>
                <span className="font-black text-lg">₹{totalSalesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50/50 rounded-2xl border border-green-100">
                <span className="text-green-700 font-bold text-sm">Net Profit:</span>
                <span className="font-black text-xl text-green-700">₹{totalProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-bold text-sm">Purchase Costs (COGS):</span>
                <span className="font-black">₹{totalCostOfGoodsSold.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-bold text-sm">Profit Margin:</span>
                <span className="font-black text-primary-600">{profitMargin.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Inventory Valuation
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <span className="text-blue-700 font-bold text-sm">Total Sales Value:</span>
                <span className="font-black text-xl text-blue-700">₹{currentInventoryValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-bold text-sm">Stock Purchase Cost:</span>
                <span className="font-black text-lg">₹{totalInvestment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50/50 rounded-2xl border border-green-100">
                <span className="text-green-700 font-bold text-sm">Potential Profit:</span>
                <span className="font-black text-green-700">₹{(currentInventoryValue - totalProductInvestment).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-bold text-sm">Items in Stock:</span>
                <span className="font-black">{totalItemsInInventory.toLocaleString()} items</span>
              </div>
            </div>
          </div>
        </div>

        {/* Period Summary Table */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="text-lg font-black text-gray-900">Performance Summary</h3>
            <div className="text-[10px] font-black text-primary-600 bg-primary-50 px-4 py-2 rounded-full border border-primary-100 uppercase tracking-widest">
              Range: {startDateDisplay} to {endDateDisplay}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-black border-b border-gray-100 tracking-tighter">
                  <th className="pb-4 px-2">Key Metric</th>
                  <th className="pb-4 px-2 text-right">Value</th>
                  <th className="pb-4 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr className="text-sm group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 font-bold text-gray-700">Total Revenue Generated</td>
                  <td className="py-5 px-2 text-right font-black text-gray-900">₹{totalSalesRevenue.toLocaleString()}</td>
                  <td className="py-5 px-2 text-right">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">Income</span>
                  </td>
                </tr>
                <tr className="text-sm group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 font-bold text-gray-700">Total Profit Earned</td>
                  <td className="py-5 px-2 text-right font-black text-green-600">₹{totalProfit.toLocaleString()}</td>
                  <td className="py-5 px-2 text-right">
                    <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase">Net</span>
                  </td>
                </tr>
                <tr className="text-sm group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 font-bold text-gray-700">Highest Sale Amount</td>
                  <td className="py-5 px-2 text-right font-black text-gray-900">
                    ₹{sales.length > 0 ? Math.max(...sales.map(s => s.total_amount)).toLocaleString() : 0}
                  </td>
                  <td className="py-5 px-2 text-right">
                    <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg uppercase">Peak</span>
                  </td>
                </tr>
                <tr className="text-sm group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 font-bold text-gray-700">Average Sale Value</td>
                  <td className="py-5 px-2 text-right font-black text-gray-900">
                    ₹{avgSaleValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </td>
                  <td className="py-5 px-2 text-right">
                    <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg uppercase">Average</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
