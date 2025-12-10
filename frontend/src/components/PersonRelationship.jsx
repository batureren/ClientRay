//src/components/PersonRelationship.jsx

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import {
  Plus, Users, Search, Edit, Trash2, MoreHorizontal,
  User, Building, Mail, Phone, Calendar, ArrowRight,
  Heart, UserCheck, Briefcase, Users2, Loader2
} from 'lucide-react'
import api from '@/services/api';

// Relationship Badge Component
export const RelationshipBadge = ({ count, onClick, loading = false }) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('relationships.loadingBadge')}
      </Badge>
    )
  }

  if (!count || count === 0) {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs flex items-center gap-1">
        <Users className="h-3 w-3" />
        0
      </Badge>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      className="p-0 h-auto"
    >
      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs flex items-center gap-1 hover:bg-blue-200 cursor-pointer">
        <Users className="h-3 w-3" />
        {count}
      </Badge>
    </Button>
  )
}

// Relationship Type Icon
const getRelationshipIcon = (type) => {
  const iconMap = {
    'spouse': Heart, 'father': User, 'mother': User, 'son': User, 'daughter': User,
    'brother': User, 'sister': User, 'colleague': Users2, 'manager': UserCheck,
    'assistant': User, 'business_partner': Briefcase, 'client': Building,
    'vendor': Building, 'referral': ArrowRight, 'friend': Users, 'other': Users
  }
  return iconMap[type] || Users
}

// Relationship Type Badge
const RelationshipTypeBadge = ({ type }) => {
  const { t } = useTranslation()
  const Icon = getRelationshipIcon(type)
  const colors = {
    'spouse': 'bg-pink-100 text-pink-800', 'father': 'bg-blue-100 text-blue-800',
    'mother': 'bg-purple-100 text-purple-800', 'son': 'bg-green-100 text-green-800',
    'daughter': 'bg-green-100 text-green-800', 'brother': 'bg-cyan-100 text-cyan-800',
    'sister': 'bg-cyan-100 text-cyan-800', 'colleague': 'bg-orange-100 text-orange-800',
    'manager': 'bg-red-100 text-red-800', 'assistant': 'bg-yellow-100 text-yellow-800',
    'business_partner': 'bg-indigo-100 text-indigo-800', 'client': 'bg-emerald-100 text-emerald-800',
    'vendor': 'bg-teal-100 text-teal-800', 'referral': 'bg-violet-100 text-violet-800',
    'friend': 'bg-rose-100 text-rose-800', 'other': 'bg-gray-100 text-gray-800'
  }

  return (
    <Badge className={`${colors[type] || colors.other} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {t(`relationships.types.${type}`, { defaultValue: type.replace('_', ' ') })}
    </Badge>
  )
}

// Create Relationship Dialog
export const CreateRelationshipDialog = ({
  open, onOpenChange, entityType, entityId, onRelationshipCreated
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [relationshipTypes, setRelationshipTypes] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [formData, setFormData] = useState({
    relationship_type: '', notes: '', related_type: 'lead'
  })

  useEffect(() => {
    const loadRelationshipTypes = async () => {
      try {
        const response = await api.get('/relationships/types')
        setRelationshipTypes(response.data)
      } catch (error) { 
        console.error('Error loading relationship types:', error) 
      }
    }
    if (open) loadRelationshipTypes()
  }, [open])

  const searchEntities = async (query, type) => {
    if (!query || query.length < 2) {
      setSearchResults([]); return
    }
    setSearchLoading(true)
    try {
      const response = await api.get(`/relationships/search/${type}`, {
        params: { q: query, exclude_id: entityId }
      })
      setSearchResults(response.data)
    } catch (error) {
      console.error('Error searching entities:', error)
      setSearchResults([])
    }
    setSearchLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) searchEntities(searchTerm, formData.related_type)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, formData.related_type, entityId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedEntity || !formData.relationship_type) return
    setLoading(true)
    try {
      await api.post('/relationships', {
        entity_type: entityType, 
        entity_id: entityId,
        related_type: selectedEntity.entity_type, 
        related_id: selectedEntity.id,
        relationship_type: formData.relationship_type, 
        notes: formData.notes
      })
      onRelationshipCreated?.()
      onOpenChange(false)
      setFormData({ relationship_type: '', notes: '', related_type: 'lead' })
      setSelectedEntity(null)
      setSearchTerm('')
      setSearchResults([])
    } catch (error) {
      console.error('Error creating relationship:', error)
      alert(t('relationships.createError', { error: error.response?.data?.message || error.message }))
    }
    setLoading(false)
  }

  const relatedTypeLabel = t(formData.related_type === 'lead' ? 'navigation.leads' : 'navigation.accounts');
  const relatedTypeSingular = t(formData.related_type === 'lead' ? 'navigation.leads' : 'navigation.accounts', { count: 1 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('relationships.addRelationship')}
          </DialogTitle>
          <DialogDescription>{t('relationships.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('relationships.searchIn')}</Label>
            <Select
              value={formData.related_type}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, related_type: value }))
                setSelectedEntity(null); setSearchResults([])
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">{t('navigation.leads')}</SelectItem>
                <SelectItem value="account">{t('navigation.accounts')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('relationships.searchLabel', { type: relatedTypeLabel })}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('relationships.searchPlaceholder', { type: relatedTypeLabel.toLowerCase() })}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchLoading && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />}
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>{t('relationships.selectLabel', { type: relatedTypeSingular })}</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((entity) => (
                  <div key={entity.id}
                    className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${selectedEntity?.id === entity.id ? 'bg-blue-50 border-blue-200' : ''}`}
                    onClick={() => setSelectedEntity(entity)}>
                    <div className="flex items-center gap-2">
                      {entity.entity_type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                      <div className="flex-1">
                        <div className="font-medium">{entity.display_name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-3">
                          {entity.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{entity.email}</span>}
                          {entity.company && <span className="flex items-center gap-1"><Building className="h-3 w-3" />{entity.company}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedEntity && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2">
                {selectedEntity.entity_type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                <div>
                  <div className="font-medium">{selectedEntity.display_name}</div>
                  <div className="text-sm text-gray-600">{t('relationships.selectedEntity', { type: selectedEntity.entity_type })}</div>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('relationships.relationshipType')}</Label>
            <Select value={formData.relationship_type} onValueChange={(value) => setFormData(prev => ({ ...prev, relationship_type: value }))}>
              <SelectTrigger><SelectValue placeholder={t('relationships.selectRelationshipType')} /></SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {React.createElement(getRelationshipIcon(type), { className: "h-4 w-4" })}
                      {t(`relationships.types.${type}`, { defaultValue: type.replace('_', ' ') })}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('relationships.notesOptional')}</Label>
            <Textarea
              placeholder={t('relationships.notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading || !selectedEntity || !formData.relationship_type}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('relationships.createRelationship')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Relationship Dialog
export const EditRelationshipDialog = ({
  open, onOpenChange, relationship, onRelationshipUpdated
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [relationshipTypes, setRelationshipTypes] = useState([])
  const [formData, setFormData] = useState({ relationship_type: '', notes: '' })

  useEffect(() => {
    if (relationship && open) {
      setFormData({
        relationship_type: relationship.relationship_type || '',
        notes: relationship.notes || ''
      })
    }
  }, [relationship, open])

  useEffect(() => {
    const loadRelationshipTypes = async () => {
      try {
        const response = await api.get('/relationships/types')
        setRelationshipTypes(response.data)
      } catch (error) { 
        console.error('Error loading relationship types:', error) 
      }
    }
    if (open) loadRelationshipTypes()
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    if (!relationship) return
    setLoading(true)
    try {
      await api.put(`/relationships/${relationship.id}`, formData)
      onRelationshipUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating relationship:', error)
      alert(t('relationships.updateError', { error: error.response?.data?.message || error.message }))
    }
    setLoading(false)
  }

  if (!relationship) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t('relationships.editRelationship')}
          </DialogTitle>
          <DialogDescription>
            {t('relationships.editDescription', { name: relationship.related_entity?.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-gray-50 border rounded-md">
            <div className="flex items-center gap-2">
              {relationship.related_entity?.type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
              <div>
                <div className="font-medium">{relationship.related_entity?.name}</div>
                <div className="text-sm text-gray-600">{relationship.related_entity?.type} • {relationship.related_entity?.email}</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('relationships.relationshipType')}</Label>
            <Select value={formData.relationship_type} onValueChange={(value) => setFormData(prev => ({ ...prev, relationship_type: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {React.createElement(getRelationshipIcon(type), { className: "h-4 w-4" })}
                      {t(`relationships.types.${type}`, { defaultValue: type.replace('_', ' ') })}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('relationships.notes')}</Label>
            <Textarea
              placeholder={t('relationships.notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('relationships.updateRelationship')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Relationships Section Component
export const RelationshipsSection = ({
  entityType, entityId, entityName, onClose
}) => {
  const { t } = useTranslation()
  const [relationships, setRelationships] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState(null)

  const fetchRelationships = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/relationships/${entityType}/${entityId}`)
      setRelationships(response.data)
    } catch (error) {
      console.error('Error fetching relationships:', error)
      setRelationships([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRelationships()
  }, [entityType, entityId])

  const handleDeleteRelationship = async (relationshipId) => {
    if (!confirm(t('relationships.deleteConfirmation'))) return
    try {
      await api.delete(`/relationships/${relationshipId}`)
      fetchRelationships()
    } catch (error) {
      console.error('Error deleting relationship:', error)
      alert(t('relationships.deleteError'))
    }
  }

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString()

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('relationships.title', { name: entityName })}
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('relationships.addRelationship')}
            </Button>
            <Button variant="outline" onClick={onClose}>{t('relationships.close')}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t('relationships.loadingRelationships')}</span>
          </div>
        ) : relationships.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('relationships.noRelationshipsFound')}</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('relationships.addFirstRelationship')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="block md:hidden space-y-4">
              {relationships.map((rel) => (
                <Card key={rel.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {rel.related_entity.type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                        <div>
                          <div className="font-medium">{rel.related_entity.name}</div>
                          <div className="text-sm text-gray-500">{rel.related_entity.type}</div>
                        </div>
                      </div>
                      <RelationshipTypeBadge type={rel.relationship_type} />
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      {rel.related_entity.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{rel.related_entity.email}</div>}
                      {rel.related_entity.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{rel.related_entity.phone}</div>}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {t('relationships.created')} {formatDate(rel.created_at)}
                      </div>
                    </div>
                    {rel.notes && <div className="mt-3 p-2 bg-gray-50 rounded text-sm">{rel.notes}</div>}
                    <div className="flex justify-end mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedRelationship(rel); setShowEditDialog(true) }}>
                            <Edit className="h-4 w-4 mr-2" />{t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteRelationship(rel.id)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('relationships.relatedEntity')}</TableHead>
                    <TableHead>{t('relationships.relationship')}</TableHead>
                    <TableHead>{t('relationships.contact')}</TableHead>
                    <TableHead>{t('relationships.notes')}</TableHead>
                    <TableHead>{t('relationships.createdDate')}</TableHead>
                    <TableHead className="w-[100px]">{t('relationships.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relationships.map((rel) => (
                    <TableRow key={rel.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rel.related_entity.type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                          <div>
                            <div className="font-medium">{rel.related_entity.name}</div>
                            <div className="text-sm text-gray-500 capitalize">{rel.related_entity.type}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><RelationshipTypeBadge type={rel.relationship_type} /></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {rel.related_entity.email && <div className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{rel.related_entity.email}</div>}
                          {rel.related_entity.phone && <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{rel.related_entity.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell><div className="max-w-xs truncate text-sm">{rel.notes || '-'}</div></TableCell>
                      <TableCell><div className="text-sm text-gray-500">{formatDate(rel.created_at)}</div></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedRelationship(rel); setShowEditDialog(true) }}>
                              <Edit className="h-4 w-4 mr-2" />{t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteRelationship(rel.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <CreateRelationshipDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          entityType={entityType}
          entityId={entityId}
          onRelationshipCreated={fetchRelationships}
        />
        <EditRelationshipDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          relationship={selectedRelationship}
          onRelationshipUpdated={() => { fetchRelationships(); setSelectedRelationship(null) }}
        />
      </CardContent>
    </Card>
  )
}