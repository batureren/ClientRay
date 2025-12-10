// components/tabs/DocsTab.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { 
  Plus, Trash2, FileText, Loader2, User, Building, ChevronLeft, ChevronRight,
  FolderOpen, Folder, Eye, Download, Filter, X, Grid, List, Image, FileIcon
} from 'lucide-react';
import SearchComponent from '../ui/SearchComponent';
import UploadDocDialog from '../dialogs/UploadDocDialog';
import ConfirmationDialog from '../dialogs/ConfirmationDialog';
import api from '@/services/api';

const DocsTab = () => {
  const { t } = useTranslation();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  
  // View states
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'folders'
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  // Filter states
  const [entityFilter, setEntityFilter] = useState('all'); // 'all', 'leads', 'accounts'
  const [showFilters, setShowFilters] = useState(false);
  
  // Preview states
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Pagination and search states - matching LeadsTab structure
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  // Fetch function updated to match LeadsTab pattern
  const fetchDocs = async (page = currentPage, limit = itemsPerPage, search = searchTerm, entityType = entityFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search && search.trim()) params.append('search', search.trim());
      if (entityType !== 'all') params.append('entity_type', entityType === 'leads' ? 'lead' : 'account');
      
      const response = await api.get(`/docs?${params.toString()}`);
      
      // Handle axios response structure - data is in response.data
      if (response.data && response.data.data && response.data.pagination) {
        setDocs(response.data.data);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
        setCurrentPage(response.data.pagination.currentPage);
      } else if (Array.isArray(response.data)) {
        setDocs(response.data);
        setTotalItems(response.data.length);
        setTotalPages(1);
      } else {
        setDocs([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (error) { 
      console.error('Error fetching documents:', error); 
      setDocs([]); 
      setTotalItems(0); 
      setTotalPages(0); 
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(1, itemsPerPage, '', 'all'); }, []);

  // Pagination handlers matching LeadsTab
  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchDocs(page, itemsPerPage, searchTerm, entityFilter);
  };

  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit);
    setCurrentPage(1);
    fetchDocs(1, newLimit, searchTerm, entityFilter);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchDocs(newPage, itemsPerPage, searchTerm, entityFilter);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchDocs(newPage, itemsPerPage, searchTerm, entityFilter);
    }
  };

  // Generate page numbers for pagination controls (same as LeadsTab)
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    if (totalPages <= 1) return [1];

    for (let i = Math.max(2, currentPage - delta);
         i <= Math.min(totalPages - 1, currentPage + delta);
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };

  // Updated search handler matching LeadsTab
  const handleSearch = async (searchValue, showAll = false) => {
    const newSearchTerm = showAll ? '' : searchValue;
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
    
    try {
      await fetchDocs(1, itemsPerPage, newSearchTerm, entityFilter);
      return totalItems;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  };

  const handleEntityFilter = (filter) => {
    setEntityFilter(filter);
    setCurrentPage(1);
    fetchDocs(1, itemsPerPage, searchTerm, filter);
  };
  
  const handleRefresh = () => {
    fetchDocs(currentPage, itemsPerPage, searchTerm, entityFilter);
  };

  const promptDelete = (docId) => {
    setDocToDelete(docId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await api.delete(`/docs/${docToDelete}`);
      handleRefresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert(t('docsTab.errors.deleteFailed'));
    } finally {
      setShowDeleteConfirm(false);
      setDocToDelete(null);
    }
  };

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
    setShowPreview(true);
  };

  const handleDownload = async (doc) => {
    try {
      // Use axios with responseType: 'blob' for file downloads
      const response = await api.get(`/docs/download/${doc.id}`, {
        responseType: 'blob'
      });

      // Create blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file.');
    }
  };

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const isImageFile = (mimeType) => {
    return mimeType?.startsWith('image/');
  };

  const isDocxFile = (fileType) => {
    return fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
           fileType === 'application/msword';
  };

  const getShortFileType = (mimeType) => {
    if (!mimeType) return 'Unknown';
    
    const typeMap = {
      // Images
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/webp': 'WebP',
      'image/svg+xml': 'SVG',
      
      // Documents
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      
      // Text
      'text/plain': 'TXT',
      'text/csv': 'CSV',
      'text/html': 'HTML',
      'application/json': 'JSON',
      'application/xml': 'XML',
      'text/xml': 'XML',
      
      // Archives
      'application/zip': 'ZIP',
      'application/x-rar-compressed': 'RAR',
      'application/x-7z-compressed': '7Z',
      
      // Other
      'application/octet-stream': 'File'
    };
    
    // Check for exact match first
    if (typeMap[mimeType]) {
      return typeMap[mimeType];
    }
    
    // Extract main type if no exact match
    const mainType = mimeType.split('/')[0];
    switch (mainType) {
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      case 'text': return 'Text';
      default: return 'File';
    }
  };

  // Group documents by entity for folder view
  const groupedDocs = docs.reduce((acc, doc) => {
    const key = `${doc.related_to_entity}_${doc.related_to_id}`;
    if (!acc[key]) {
      acc[key] = {
        entity: doc.related_to_entity,
        entityId: doc.related_to_id,
        entityName: doc.related_to_name || 'Unknown',
        docs: []
      };
    }
    acc[key].docs.push(doc);
    return acc;
  }, {});

  const PreviewModal = () => {
    if (!previewDoc || !showPreview) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">{previewDoc.file_name}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {isImageFile(previewDoc.file_type) ? (
              <img
                src={`/api/docs/preview/${previewDoc.id}?token=${localStorage.getItem('auth_token')}`}
                alt={previewDoc.file_name}
                className="max-w-full h-auto"
              />
            ) : previewDoc.file_type === 'application/pdf' ? (
              <iframe
                src={`/api/docs/preview/${previewDoc.id}?token=${localStorage.getItem('auth_token')}`}
                className="w-full h-[70vh]"
                title={previewDoc.file_name}
              />
            ) : isDocxFile(previewDoc.file_type) ? (
              <iframe
                src={`/api/docs/preview/${previewDoc.id}?format=html&token=${localStorage.getItem('auth_token')}`}
                className="w-full h-[70vh] border-0"
                title={previewDoc.file_name}
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className="text-center py-8">
                <FileIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Preview not available for this file type.</p>
                <p className="text-sm text-gray-500 mt-2">
                  File type: {previewDoc.file_type}<br/>
                  Size: {formatFileSize(previewDoc.file_size)}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t">
            <Button variant="outline" onClick={() => handleDownload(previewDoc)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('docsTab.table.fileName')}</TableHead>
          <TableHead>{t('docsTab.table.relatedTo')}</TableHead>
          <TableHead>{t('docsTab.table.typeSize')}</TableHead>
          <TableHead>{t('docsTab.table.uploadedBy')}</TableHead>
          <TableHead>{t('docsTab.table.dateUploaded')}</TableHead>
          <TableHead className="text-right">{t('docsTab.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.length > 0 ? (
          docs.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium flex items-center gap-2">
                {getFileIcon(doc.file_type)}
                {doc.file_name}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {doc.related_to_entity === 'lead' ? 
                    <User className="h-4 w-4 text-blue-500" /> : 
                    <Building className="h-4 w-4 text-green-500" />
                  }
                  <div>
                    <div className="font-medium text-sm">{doc.related_to_name || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground uppercase">{doc.related_to_entity}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="mb-1">{getShortFileType(doc.file_type)}</Badge>
                <div className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</div>
              </TableCell>
              <TableCell>{doc.uploaded_by_name || 'N/A'}</TableCell>
              <TableCell>{formatDate(doc.created_at)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(doc)}
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => promptDelete(doc.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24">
              No documents found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const renderFolderView = () => (
    <div className="space-y-4">
      {Object.entries(groupedDocs).map(([key, folder]) => (
        <div key={key} className="border rounded-lg">
          <div 
            className="flex items-center gap-2 p-4 cursor-pointer hover:bg-muted"
            onClick={() => toggleFolder(key)}
          >
            {expandedFolders.has(key) ? 
              <FolderOpen className="h-5 w-5 text-blue-500" /> : 
              <Folder className="h-5 w-5 text-gray-500" />
            }
            {folder.entity === 'lead' ? 
              <User className="h-4 w-4 text-blue-500" /> : 
              <Building className="h-4 w-4 text-green-500" />
            }
            <span className="font-medium">{folder.entityName}</span>
            <Badge variant="outline" className="ml-2">
              {folder.docs.length} file{folder.docs.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="ml-1 text-xs uppercase">
              {folder.entity}
            </Badge>
          </div>
          
          {expandedFolders.has(key) && (
            <div className="border-t">
              {folder.docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.file_type)}
                    <div>
                      <div className="font-medium text-sm">{doc.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(doc)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => promptDelete(doc.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {Object.keys(groupedDocs).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No documents found.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{t('docsTab.title')}</h2>
        <Button onClick={() => setShowUploadDialog(true)}><Plus className="h-4 w-4 mr-2" />{t('docsTab.uploadButton')}</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <CardTitle>{t('docsTab.cardTitle')}</CardTitle>
                <CardDescription>{t('docsTab.cardDescription')}</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <SearchComponent onSearch={handleSearch} placeholder={t('docsTab.searchPlaceholder')} initialValue={searchTerm} />
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4 mr-2" />{t('docsTab.filters.button')}</Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center gap-2">
                {showFilters && (
                  <div className="flex items-center gap-2">
                    <Button variant={entityFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => handleEntityFilter('all')}>{t('docsTab.filters.all')}</Button>
                    <Button variant={entityFilter === 'leads' ? 'default' : 'outline'} size="sm" onClick={() => handleEntityFilter('leads')}><User className="h-4 w-4 mr-1" />{t('docsTab.filters.leads')}</Button>
                    <Button variant={entityFilter === 'accounts' ? 'default' : 'outline'} size="sm" onClick={() => handleEntityFilter('accounts')}><Building className="h-4 w-4 mr-1" />{t('docsTab.filters.accounts')}</Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}><List className="h-4 w-4 mr-1" />{t('docsTab.viewModes.list')}</Button>
                <Button variant={viewMode === 'folders' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('folders')}><Grid className="h-4 w-4 mr-1" />{t('docsTab.viewModes.folders')}</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {loading ? ( <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>
                ) : ( t('docsTab.pagination.showing', { start: totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, end: Math.min(currentPage * itemsPerPage, totalItems), total: totalItems }) )}
                {entityFilter !== 'all' && <Badge variant="secondary" className="ml-2">{t(`docsTab.filters.${entityFilter}Only`)}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('docsTab.pagination.perPage')}</label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange} disabled={loading}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
              </div>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((pageNum, index) => (
                  <Button 
                    key={index} 
                    variant={pageNum === currentPage ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)} 
                    disabled={pageNum === '...'} 
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {loading && docs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading documents...</span>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block md:hidden">
                {docs.map((doc) => (
                  <div key={doc.id} className="border-b p-4 space-y-3 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getFileIcon(doc.file_type)}
                          <div className="font-medium text-sm truncate">{doc.file_name}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {doc.related_to_entity === 'lead' ? 
                              <User className="h-3 w-3 text-blue-500 flex-shrink-0" /> : 
                              <Building className="h-3 w-3 text-green-500 flex-shrink-0" />
                            }
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{doc.related_to_name || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground uppercase">{doc.related_to_entity}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs" title={doc.file_type}>
                              {getShortFileType(doc.file_type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded by: {doc.uploaded_by_name || 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(doc.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(doc)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => promptDelete(doc.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {docs.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No documents found.</p>
                  </div>
                )}
              </div>
              
              {/* Desktop view */}
              <div className="hidden md:block p-4">
                {viewMode === 'list' ? renderListView() : renderFolderView()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <UploadDocDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadSuccess={handleRefresh}
      />
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('docsTab.deleteConfirm.title')}
        description={t('docsTab.deleteConfirm.description')}
        onConfirm={confirmDelete}
        cancelText={t('common.cancel')}
        confirmText={t('common.delete')}
      />
      <PreviewModal />
    </div>
  );
};

export default DocsTab;