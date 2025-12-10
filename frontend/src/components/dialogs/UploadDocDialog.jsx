// components/dialogs/UploadDocDialog.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, XCircle, User, Building, Upload, File } from 'lucide-react';
import api from '@/services/api';

const UploadDocDialog = ({ open, onOpenChange, onUploadSuccess, person, uploadType }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Check if we have pre-populated data from parent
  const isPrePopulated = person && uploadType;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setSearchTerm('');
      setSearchResults([]);
      setSelectedEntity(null);
      setIsUploading(false);
    } else if (isPrePopulated) {
      setSelectedEntity({
        id: person.id,
        name: person.account_name || person.first_name + ' ' + person.last_name,
        type: uploadType
      });
      setSearchTerm(person.account_name || person.first_name + ' ' + person.last_name);
    }
  }, [open, person, uploadType, isPrePopulated]);

  useEffect(() => {
    // Skip search if pre-populated or if search term is too short
    if (isPrePopulated || searchTerm.length < 2 || selectedEntity) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(`/docs/search-entities?search=${searchTerm}`);
        // Handle axios response structure
        setSearchResults(Array.isArray(response.data) ? response.data : []);
      } catch (error) { 
        console.error("Failed to search entities:", error); 
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, selectedEntity, isPrePopulated, api]);

  const handleUpload = async () => {
    if (!file || !selectedEntity) {
      alert(t('uploadDocDialog.errors.fileAndEntityRequired'));
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('related_to_entity', selectedEntity.type);
    formData.append('related_to_id', selectedEntity.id);
    formData.append('file', file);

    try {
      // Add Content-Type header for multipart/form-data
      const response = await api.post('/docs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Upload response:', response.data); // Log axios response data
      onUploadSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Upload failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      alert(t('uploadDocDialog.errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };
  
  const getEntityTypeLabel = (type) => {
    return t(`uploadDocDialog.entityTypes.${type}`, { defaultValue: type });
  };

  const handleClearSelection = () => {
    // Only allow clearing if not pre-populated
    if (!isPrePopulated) {
      setSelectedEntity(null);
      setSearchTerm('');
    }
  };

  // File upload handlers
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    
    // Check file size (10MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      alert(t('uploadDocDialog.errors.fileTooLarge', { defaultValue: 'File size must be less than 10MB' }));
      return;
    }
    
    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg', 
      'image/png'
    ];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      alert(t('uploadDocDialog.errors.invalidFileType', { defaultValue: 'Please select a valid file type (PDF, DOC, DOCX, JPG, PNG)' }));
      return;
    }
    
    setFile(selectedFile);
  };

  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('uploadDocDialog.title')}</DialogTitle>
          <DialogDescription>{t('uploadDocDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('uploadDocDialog.labels.step1')}</Label>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              id="file-upload"
            />
            
            {/* Custom file upload area */}
            <div
              onClick={handleUploadAreaClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : file 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/50'
                }
              `}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">{file.name}</p>
                    <p className="text-xs text-green-600">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className={`mx-auto h-8 w-8 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {isDragOver ? 'Drop file here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('uploadDocDialog.labels.step2')}</Label>
            {selectedEntity ? (
              <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                <div className="flex items-center gap-2">
                    {selectedEntity.type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                    <span>{selectedEntity.name}</span>
                    <span className="text-xs text-muted-foreground uppercase">({getEntityTypeLabel(selectedEntity.type)})</span>
                    {isPrePopulated && <span className="text-xs text-blue-600 ml-2">(Pre-selected)</span>}
                </div>
                {!isPrePopulated && (
                  <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                      <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('uploadDocDialog.placeholders.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  disabled={isPrePopulated}
                />
                {(isSearching || searchResults.length > 0) && !isPrePopulated && (
                  <div className="absolute z-10 w-full mt-1 border rounded-md shadow-lg bg-background max-h-48 overflow-y-auto">
                    {isSearching && <div className="p-2 text-sm text-center">{t('uploadDocDialog.searching')}</div>}
                    {searchResults.map((entity) => (
                      <div
                        key={`${entity.type}-${entity.id}`}
                        className="p-2 text-sm hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setSelectedEntity(entity);
                          setSearchTerm(entity.name);
                        }}
                      >
                        {entity.type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                        {entity.name} <span className="text-xs text-muted-foreground uppercase">({getEntityTypeLabel(entity.type)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleUpload} disabled={!file || !selectedEntity || isUploading}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? t('uploadDocDialog.buttons.uploading') : t('uploadDocDialog.buttons.uploadAndLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDocDialog;