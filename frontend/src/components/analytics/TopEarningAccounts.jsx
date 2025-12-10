import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  DollarSign, 
  Building2, 
  ShoppingCart, 
  TrendingUp,
  Mail,
  Star,
  Calendar,
  Package
} from 'lucide-react';

const TopEarningAccounts = ({ topEarningAccounts, goalCurrency }) => {
  const formatCurrency = (amount) => {
    const currencySymbols = {
      USD: '$', EUR: '€', GBP: '£', CAD: 'C$', 
      AUD: 'A$', JPY: '¥', TRY: '₺'
    };
    const symbol = currencySymbols[goalCurrency] || '$';
    return `${symbol}${amount.toLocaleString()}`;
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getRevenueColor = (revenue, maxRevenue) => {
    const percentage = (revenue / maxRevenue) * 100;
    if (percentage >= 80) return 'text-green-700 bg-green-50';
    if (percentage >= 60) return 'text-blue-700 bg-blue-50';
    if (percentage >= 40) return 'text-orange-700 bg-orange-50';
    return 'text-gray-700 bg-gray-50';
  };

  if (!topEarningAccounts || topEarningAccounts.length === 0) {
    return null;
  }

  const maxRevenue = Math.max(...topEarningAccounts.map(account => account.total_revenue));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="h-5 w-5 text-green-600" />
          Top Earning Accounts
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({topEarningAccounts.length} accounts)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-700">Account</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700">Total Revenue</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 hidden sm:table-cell">Purchases</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 hidden md:table-cell">Avg. Order</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 hidden lg:table-cell">Last Purchase</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 hidden xl:table-cell">Performance</th>
              </tr>
            </thead>
            <tbody>
              {topEarningAccounts.map((account, i) => {
                const daysSinceLastPurchase = account.last_purchase_date ? 
                  Math.floor((new Date() - new Date(account.last_purchase_date)) / (1000 * 60 * 60 * 24)) : null;
                
                return (
                  <tr key={account.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="py-3 px-2 text-xs sm:text-sm">
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getRevenueColor(account.total_revenue, maxRevenue)}`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">
                            {account.account_name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{account.contact_name}</span>
                            </div>
                            {account.industry && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate">{account.industry}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span className="truncate">{account.unique_products_purchased} products</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 text-right font-bold text-xs sm:text-sm">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${getRevenueColor(account.total_revenue, maxRevenue)}`}>
                        {formatCurrency(account.total_revenue)}
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 text-right text-xs sm:text-sm hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <ShoppingCart className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{formatNumber(account.total_purchases)}</span>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 text-right text-xs sm:text-sm hidden md:table-cell">
                      <div className="text-gray-600">
                        {formatCurrency(account.avg_purchase_value)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Max: {formatCurrency(account.highest_purchase_value)}
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 text-right text-xs sm:text-sm hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span>{formatDate(account.last_purchase_date)}</span>
                      </div>
                      {daysSinceLastPurchase !== null && (
                        <div className={`text-xs mt-1 ${
                          daysSinceLastPurchase <= 30 ? 'text-green-600' :
                          daysSinceLastPurchase <= 60 ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {daysSinceLastPurchase} days ago
                        </div>
                      )}
                    </td>
                    
                    <td className="py-3 px-2 text-right text-xs sm:text-sm hidden xl:table-cell">
                      <div className="flex items-center justify-end">
                        {account.total_revenue >= maxRevenue * 0.8 ? (
                          <div className="flex items-center gap-1 text-green-700">
                            <Star className="h-3 w-3 fill-current" />
                            <span className="text-xs font-medium">Top Performer</span>
                          </div>
                        ) : account.total_revenue >= maxRevenue * 0.6 ? (
                          <div className="flex items-center gap-1 text-blue-700">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-xs font-medium">High Value</span>
                          </div>
                        ) : account.total_revenue >= maxRevenue * 0.4 ? (
                          <div className="flex items-center gap-1 text-orange-700">
                            <DollarSign className="h-3 w-3" />
                            <span className="text-xs font-medium">Good Value</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-gray-700">
                            <Building2 className="h-3 w-3" />
                            <span className="text-xs font-medium">Standard</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate" title={account.top_products}>
                        Top: {account.top_products ? account.top_products.split(',')[0].trim() : 'N/A'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {topEarningAccounts.length === 10 && (
          <div className="mt-4 text-center text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md">
            Showing top 10 earning accounts. Total accounts may be higher.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopEarningAccounts;