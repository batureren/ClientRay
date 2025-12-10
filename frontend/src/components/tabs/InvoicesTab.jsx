import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Plus, MoreHorizontal, Edit, Trash2, Search, FileText, Download, Send, Eye, Settings, ChevronLeft, ChevronRight, Loader2, User } from 'lucide-react'
import CreateInvoiceDialog from '../dialogs/CreateInvoiceDialog'
import {EditInvoiceDialog, DeleteInvoiceDialog } from '../dialogs/EditInvoiceDialog'
import InvoicePreviewDialog from '../dialogs/InvoicePreviewDialog'
import CompanyDetailsDialog from '../dialogs/CompanyDetailsDialog'
import api from '@/services/api'

const InvoicesTab = ({ user }) => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showCompanyDetailsDialog, setShowCompanyDetailsDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all') // Filter by creator (all | me)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 20
  })

  const getPageNumbers = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []
    const totalPages = pagination.totalPages
    const currentPage = pagination.currentPage
    
    if (totalPages <= 1) return [1]
    
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }
    
    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }
    
    rangeWithDots.push(...range)
    
    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }
    
    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index)
  }

  const fetchInvoices = async (page = 1, limit = pagination.limit) => {
    try {
      setLoading(true)
      const params = {
        page,
        limit,
        search: searchTerm
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      // Apply creator filter
      if (creatorFilter === 'me' && user && user.id) {
        params.created_by = user.id;
      }

      const response = await api.get('/invoices', { params })
      setInvoices(response.data.data)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices(pagination.currentPage)
  }, [searchTerm, statusFilter, creatorFilter])

  const handlePageChange = (newPage) => {
    fetchInvoices(newPage, pagination.limit)
  }

  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value)
    setPagination(prev => ({ ...prev, limit: newLimit }))
    fetchInvoices(1, newLimit)
  }

  const handlePreviousPage = () => {
    if (pagination.currentPage > 1) {
      handlePageChange(pagination.currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      handlePageChange(pagination.currentPage + 1)
    }
  }

  const handleInvoiceCreated = () => {
    setShowCreateDialog(false)
    fetchInvoices(1)
  }

  const handleInvoiceUpdated = () => {
    setShowEditDialog(false)
    setSelectedInvoice(null)
    fetchInvoices(pagination.currentPage)
  }

  const handleEdit = async (invoice) => {
    try {
      const response = await api.get(`/invoices/${invoice.id}`)
      setSelectedInvoice(response.data)
      setShowEditDialog(true)
    } catch (error) {
      console.error('Error fetching invoice details:', error)
      alert('Failed to load invoice details. Please try again.')
    }
  }

  const handlePreview = async (invoice) => {
    try {
      const response = await api.get(`/invoices/${invoice.id}`)
      setSelectedInvoice(response.data)
      setShowPreviewDialog(true)
    } catch (error) {
      console.error('Error fetching invoice details:', error)
    }
  }

  const handleDeleteClick = (invoice) => {
    setSelectedInvoice(invoice)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirmed = async (invoiceId) => {
    try {
      await api.delete(`/invoices/${invoiceId}`)
      fetchInvoices(pagination.currentPage)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice. Please try again.')
    } finally {
      setSelectedInvoice(null)
    }
  }

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      await api.patch(`/invoices/${invoiceId}/status`, { status: newStatus })
      fetchInvoices(pagination.currentPage)
    } catch (error) {
      console.error('Error updating invoice status:', error)
      alert('Failed to update invoice status.')
    }
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

  const formatCurrency = (amount, currency = 'USD') => {
    return `${parseFloat(amount || 0).toFixed(2)} ${currency}`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const isOverdue = (invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return false
    return new Date(invoice.due_date) < new Date()
  }

  const renderCurrencyTotals = (invoice) => {
    if (invoice.currency_totals && typeof invoice.currency_totals === 'object') {
      const currencies = Object.keys(invoice.currency_totals)
      
      if (currencies.length === 1) {
        const currency = currencies[0]
        const total = invoice.currency_totals[currency].total
        return (
          <div className="font-medium">
            {formatCurrency(total, currency)}
          </div>
        )
      } else {
        return (
          <div className="space-y-1">
            {currencies.map(currency => (
              <div key={currency} className="text-sm">
                <span className="font-medium">
                  {formatCurrency(invoice.currency_totals[currency].total, currency)}
                </span>
              </div>
            ))}
          </div>
        )
      }
    }
    
    return (
      <div className="font-medium">
        {formatCurrency(invoice.total_amount, 'USD')}
      </div>
    )
  }

  const renderPaidAmounts = (invoice) => {
    if (invoice.status === 'paid') {
      return renderCurrencyTotals(invoice)
    }
    
    if (invoice.currency_totals && typeof invoice.currency_totals === 'object') {
      const currencies = Object.keys(invoice.currency_totals)
      const primaryCurrency = currencies[0] || 'USD'
      return (
        <div>
          {formatCurrency(invoice.paid_amount || 0, primaryCurrency)}
        </div>
      )
    }
    
    return (
      <div>
        {formatCurrency(invoice.paid_amount || 0, 'USD')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Invoices</h2>
          <p className="text-muted-foreground">
            {pagination.total} total invoice{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowCompanyDetailsDialog(true)}
            className="flex-1 sm:flex-initial"
          >
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Company Details</span>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Invoice</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Filters Section */}
          <div className="flex flex-col gap-4 p-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <div className="text-sm text-muted-foreground">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    (() => {
                      const from = (pagination.currentPage - 1) * pagination.limit + 1;
                      const to = Math.min(pagination.currentPage * pagination.limit, pagination.total);
                      return `Showing ${from} to ${to} of ${pagination.total}`;
                    })()
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Per page:</label>
                  <Select value={pagination.limit?.toString() || "20"} onValueChange={handleItemsPerPageChange} disabled={loading}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Creator Filter */}
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="me">My Invoices</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-800 dark:border-gray-600 sm:w-[180px]"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="hidden sm:flex items-center gap-2">
                  {getPageNumbers().map((pageNum, index) => (
                    <Button
                      key={index}
                      variant={pageNum === pagination.currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                      disabled={pageNum === '...'}
                      className="min-w-[40px]"
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>
                <div className="sm:hidden text-sm text-muted-foreground">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin mr-2" />
                        <span>Loading invoices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-semibold">No Invoices Found</p>
                      <p className="text-sm">
                        {searchTerm || statusFilter !== 'all' || creatorFilter !== 'all'
                          ? 'Try adjusting your search or filter criteria.'
                          : 'Click "Create Invoice" to get started.'
                        }
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.entity_name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {invoice.entity_type}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                                {invoice.created_by_name || 'Unknown'}
                            </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(invoice.due_date)}
                          {isOverdue(invoice) && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderCurrencyTotals(invoice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderPaidAmounts(invoice)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)} variant="outline">
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(invoice)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'sent')}>
                                <Send className="h-4 w-4 mr-2" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                              <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'paid')}>
                                <Download className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Loading invoices...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 px-4 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-semibold">No Invoices Found</p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== 'all' || creatorFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Click "Create" to get started.'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-medium text-sm truncate">
                          {invoice.invoice_number}
                        </div>
                        <div className="font-medium mt-1">{invoice.entity_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {invoice.entity_type}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge className={getStatusColor(invoice.status)} variant="outline">
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(invoice)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'sent')}>
                                <Send className="h-4 w-4 mr-2" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                              <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'paid')}>
                                <Download className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Issue Date</div>
                        <div className="font-medium">{formatDate(invoice.issue_date)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Due Date</div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDate(invoice.due_date)}</span>
                          {isOverdue(invoice) && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                         <div className="text-muted-foreground text-xs">Created By</div>
                         <div className="font-medium truncate">{invoice.created_by_name || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Total</div>
                        {renderCurrencyTotals(invoice)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onInvoiceCreated={handleInvoiceCreated}
        user={user}
      />

      <EditInvoiceDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        invoice={selectedInvoice}
        onInvoiceUpdated={handleInvoiceUpdated}
        user={user}
      />

      <DeleteInvoiceDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        invoice={selectedInvoice}
        onDeleteConfirmed={handleDeleteConfirmed}
      />

      <InvoicePreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        invoice={selectedInvoice}
      />

      <CompanyDetailsDialog
        open={showCompanyDetailsDialog}
        onOpenChange={setShowCompanyDetailsDialog}
        onSaved={() => {}}
      />
    </div>
  )
}

export default InvoicesTab