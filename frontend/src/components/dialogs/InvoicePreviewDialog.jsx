import { useRef, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Printer } from 'lucide-react'
import api from '@/services/api'

const InvoicePreviewDialog = ({ open, onOpenChange, invoice }) => {
  const printRef = useRef()
  const [companyDetails, setCompanyDetails] = useState(null)

  useEffect(() => {
    if (open) {
      fetchCompanyDetails()
    }
  }, [open])

  const fetchCompanyDetails = async () => {
    try {
      const response = await api.get('/company-detail')
      setCompanyDetails(response.data)
    } catch (error) {
      console.error('Error fetching company details:', error)
      setCompanyDetails({
        company_name: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        email: '',
        phone: '',
        website: '',
        logo_url: null,
        tax_id: ''
      })
    }
  }

  if (!invoice) return null

  const formatCurrency = (amount, currency = 'USD') => {
    return `${parseFloat(amount || 0).toFixed(2)} ${currency}`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-orange-100 text-orange-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const originalContent = document.body.innerHTML
    
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload()
  }

  const getCompanyAddress = () => {
    if (!companyDetails) return []
    const parts = []
    
    if (companyDetails.address_line1?.trim()) parts.push(companyDetails.address_line1)
    if (companyDetails.address_line2?.trim()) parts.push(companyDetails.address_line2)
    
    const cityStateZip = [
      companyDetails.city,
      companyDetails.state,
      companyDetails.zip_code
    ].filter(v => v?.trim()).join(', ')
    
    if (cityStateZip) parts.push(cityStateZip)
    if (companyDetails.country?.trim()) parts.push(companyDetails.country)
    
    return parts
  }

  const hasCompanyData = () => {
    if (!companyDetails) return false
    return !!(
      companyDetails.company_name?.trim() ||
      companyDetails.address_line1?.trim() ||
      companyDetails.email?.trim() ||
      companyDetails.phone?.trim() ||
      companyDetails.logo_url
    )
  }

  // Use currency_totals from backend if available, otherwise calculate
  const getTotalsByCurrency = () => {
    // First check if backend provided currency_totals
    if (invoice.currency_totals && typeof invoice.currency_totals === 'object') {
      return invoice.currency_totals
    }

    // Fallback: Calculate from items
    if (!invoice.items) return {}
    
    const currencyTotals = {}
    
    invoice.items.forEach(item => {
      const currency = item.currency || 'USD'
      if (!currencyTotals[currency]) {
        currencyTotals[currency] = {
          subtotal: 0,
          itemDiscounts: 0,
          itemTaxes: 0,
          invoiceDiscount: 0,
          invoiceTax: 0,
          total: 0
        }
      }
      
      const itemSubtotal = item.quantity * item.unit_price
      const itemDiscount = (itemSubtotal * (item.discount_percent || 0)) / 100
      const itemTaxable = itemSubtotal - itemDiscount
      const itemTax = (itemTaxable * (item.tax_rate || 0)) / 100
      
      currencyTotals[currency].subtotal += itemSubtotal
      currencyTotals[currency].itemDiscounts += itemDiscount
      currencyTotals[currency].itemTaxes += itemTax
      currencyTotals[currency].total += (itemTaxable + itemTax)
    })

    return currencyTotals
  }

  const totalsByCurrency = getTotalsByCurrency()
  const currencies = Object.keys(totalsByCurrency)
  const hasMultipleCurrencies = currencies.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none !w-[95vw] sm:!w-[90vw] lg:!w-[80vw] xl:!w-[70vw] p-4">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>

<div ref={printRef} className="invoice-preview bg-white p-8 rounded-lg overflow-scroll max-h-[calc(100vh-150px)]">          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">INVOICE</h1>
              <p className="text-lg font-mono text-gray-600">{invoice.invoice_number}</p>
            </div>
            <div className="flex flex-col items-end">
              {hasCompanyData() && (
                <>
                  {companyDetails?.logo_url ? (
                    <div className="mb-2">
                      <img
                        src={companyDetails.logo_url}
                        alt={companyDetails.company_name || 'Company Logo'}
                        className="w-auto h-16 max-w-xs object-contain"
                      />
                    </div>
                  ) : null}
                  
                  <div className="text-right text-sm text-gray-600">
                    {companyDetails?.company_name?.trim() && (
                      <p className="font-semibold">{companyDetails.company_name}</p>
                    )}
                    {getCompanyAddress().map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                    {companyDetails?.email?.trim() && <p>{companyDetails.email}</p>}
                    {companyDetails?.phone?.trim() && <p>{companyDetails.phone}</p>}
                    {companyDetails?.website?.trim() && <p>{companyDetails.website}</p>}
                    {companyDetails?.tax_id?.trim() && (
                      <p className="mt-1">Tax ID: {companyDetails.tax_id}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bill To / Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
              <div className="text-gray-800">
                <p className="font-semibold text-lg">{invoice.entity_name}</p>
                {invoice.entity_email && <p className="text-sm">{invoice.entity_email}</p>}
                {invoice.entity_phone && <p className="text-sm">{invoice.entity_phone}</p>}
                {invoice.entity_address && (
                  <div className="text-sm mt-1">
                    <p>{invoice.entity_address}</p>
                    {invoice.entity_city && invoice.entity_state && (
                      <p>{invoice.entity_city}, {invoice.entity_state} {invoice.entity_zip}</p>
                    )}
                    {invoice.entity_country && <p>{invoice.entity_country}</p>}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Invoice Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Issue Date:</span>
                  <span className="font-medium">{formatDate(invoice.issue_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium">{formatDate(invoice.due_date)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Item</th>
                  <th className="text-center py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Qty</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Price</th>
                  {hasMultipleCurrencies && (
                    <th className="text-center py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Curr</th>
                  )}
                  <th className="text-center py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Disc%</th>
                  <th className="text-center py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Tax%</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600 uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items && invoice.items.map((item, index) => {
                  const itemCurrency = item.currency || 'USD'
                  return (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-gray-800">{item.product_name}</p>
                          {item.product_code && (
                            <p className="text-xs text-gray-500 font-mono">{item.product_code}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 text-gray-800">{item.quantity}</td>
                      <td className="text-right py-3 px-2 text-gray-800">
                        {formatCurrency(item.unit_price, itemCurrency)}
                      </td>
                      {hasMultipleCurrencies && (
                        <td className="text-center py-3 px-2 text-gray-600 font-semibold">
                          {itemCurrency}
                        </td>
                      )}
                      <td className="text-center py-3 px-2 text-gray-600">
                        {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                      </td>
                      <td className="text-center py-3 px-2 text-gray-600">
                        {item.tax_rate > 0 ? `${item.tax_rate}%` : '-'}
                      </td>
                      <td className="text-right py-3 px-2 font-medium text-gray-800">
                        {formatCurrency(item.line_total, itemCurrency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Section - Multi-Currency Support */}
          <div className="flex justify-end mb-8">
            <div className="w-96">
              {currencies.map((currency, idx) => {
                const totals = totalsByCurrency[currency]
                const isPaid = invoice.status === 'paid'
                
                return (
                  <div key={currency} className={`${idx > 0 ? 'mt-6 pt-4 border-t-2 border-gray-300' : ''}`}>
                    {hasMultipleCurrencies && (
                      <div className="bg-gray-100 px-3 py-2 mb-3 rounded">
                        <span className="font-bold text-base text-gray-800">{currency}</span>
                      </div>
                    )}
                    
                    <div className="space-y-2 px-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(totals.subtotal, currency)}</span>
                      </div>
                      
                      {totals.itemDiscounts > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Item Discounts:</span>
                          <span className="font-medium text-red-600">
                            -{formatCurrency(totals.itemDiscounts, currency)}
                          </span>
                        </div>
                      )}

                      {totals.invoiceDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Invoice Discount:</span>
                          <span className="font-medium text-red-600">
                            -{formatCurrency(totals.invoiceDiscount, currency)}
                          </span>
                        </div>
                      )}

                      {totals.itemTaxes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Item Taxes:</span>
                          <span className="font-medium">{formatCurrency(totals.itemTaxes, currency)}</span>
                        </div>
                      )}

                      {totals.invoiceTax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Invoice Tax:</span>
                          <span className="font-medium">{formatCurrency(totals.invoiceTax, currency)}</span>
                        </div>
                      )}

                      <div className="border-t-2 border-gray-400 pt-2 mt-3">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total {hasMultipleCurrencies ? `(${currency})` : ''}:</span>
                          <span className="text-gray-900">{formatCurrency(totals.total, currency)}</span>
                        </div>
                      </div>

                      {isPaid && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex justify-between text-base">
                            <span className="text-green-700 font-medium">Amount Paid:</span>
                            <span className="font-bold text-green-700">
                              {formatCurrency(totals.total, currency)}
                            </span>
                          </div>
                        </div>
                      )}

                      {!isPaid && invoice.paid_amount > 0 && idx === 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex justify-between text-base">
                            <span className="text-green-700 font-medium">Amount Paid:</span>
                            <span className="font-bold text-green-700">
                              {formatCurrency(invoice.paid_amount, currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes and Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="border-t-2 border-gray-300 pt-6 space-y-4">
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {invoice.terms && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </DialogFooter>

        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .invoice-preview, .invoice-preview * {
              visibility: visible;
            }
            .invoice-preview {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20mm;
              background: white;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}

export default InvoicePreviewDialog