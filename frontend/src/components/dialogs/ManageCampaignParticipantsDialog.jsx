// components/dialogs/ManageCampaignParticipantsDialog.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Users, Search, UserPlus, UserMinus, Building, Mail, Phone, Loader2, AlertCircle } from 'lucide-react';
import api from '@/services/api';

const ManageCampaignParticipantsDialog = ({ open, onOpenChange, campaign, onParticipantsUpdated }) => {
  const { t } = useTranslation();
  
  const [currentParticipants, setCurrentParticipants] = useState([]);
  const [availableEntities, setAvailableEntities] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && campaign) {
      fetchCurrentParticipants();
      fetchAvailableEntities();
      setSelectedEntities([]);
      setSearchTerm('');
      setError(null);
    }
  }, [open, campaign]);

  const fetchCurrentParticipants = async () => {
    if (!campaign) return;
    
    try {
      const details = await api.get(`/campaigns/${campaign.id}`);
      setCurrentParticipants(details.data.participants || []);
    } catch (error) {
      console.error('Error fetching current participants:', error);
      setError(t('manageParticipants.errors.fetchParticipantsFailed'));
    }
  };

  const fetchAvailableEntities = async () => {
    if (!campaign) return;
    
    setLoading(true);
    try {
      const endpoint = campaign.campaign_type === 'lead' ? '/leads' : '/accounts';
      const params = new URLSearchParams({ 
        limit: '100'
      });
      
      const response = await api.get(`${endpoint}?${params.toString()}`);
      const entities = Array.isArray(response.data.data) ? response.data.data : response;
      
      // Filter out already participating entities
      const participantIds = currentParticipants.map(p => p.entity_id);
      const available = entities.filter(entity => !participantIds.includes(entity.id));
      
      setAvailableEntities(available);
    } catch (error) {
      console.error('Error fetching available entities:', error);
      setError(t('manageParticipants.errors.fetchEntitiesFailed'));
    }
    setLoading(false);
  };

  const getFilteredAvailableEntities = () => {
    if (!searchTerm.trim()) return availableEntities;
    
    const term = searchTerm.toLowerCase();
    return availableEntities.filter(entity => {
      if (campaign.campaign_type === 'lead') {
        return (
          entity.first_name?.toLowerCase().includes(term) ||
          entity.last_name?.toLowerCase().includes(term) ||
          entity.email_address?.toLowerCase().includes(term) ||
          entity.company_name?.toLowerCase().includes(term)
        );
      } else {
        return (
          entity.account_name?.toLowerCase().includes(term) ||
          entity.contact_email?.toLowerCase().includes(term) ||
          entity.industry?.toLowerCase().includes(term)
        );
      }
    });
  };

  const getEntityDisplayName = (entity) => {
    if (campaign.campaign_type === 'lead') {
      return `${entity.first_name || ''} ${entity.last_name || ''}`.trim() || t('manageParticipants.unnamed');
    } else {
      return entity.account_name || t('manageParticipants.unnamed');
    }
  };

  const getEntityEmail = (entity) => {
    if (campaign.campaign_type === 'lead') {
      return entity.email_address;
    } else {
      return entity.contact_email;
    }
  };

  const getEntityInfo = (entity) => {
    if (campaign.campaign_type === 'lead') {
      return entity.company_name;
    } else {
      return entity.industry || entity.type;
    }
  };

  const handleEntityToggle = (entity, checked) => {
    if (checked) {
      setSelectedEntities(prev => [...prev, {
        entity_type: campaign.campaign_type,
        entity_id: entity.id
      }]);
    } else {
      setSelectedEntities(prev => prev.filter(
        selected => selected.entity_id !== entity.id
      ));
    }
  };

  const handleAddParticipants = async () => {
    if (selectedEntities.length === 0) return;
    
    setSaving(true);
    try {
      await api.post(`/campaigns/${campaign.id}/participants`, {
        participants: selectedEntities
      });
      
      await fetchCurrentParticipants();
      await fetchAvailableEntities();
      setSelectedEntities([]);
      
      // Show success message or refresh parent component
      onParticipantsUpdated();
    } catch (error) {
      console.error('Error adding participants:', error);
      setError(error.response?.data?.error || t('manageParticipants.errors.addFailed'));
    }
    setSaving(false);
  };

const handleRemoveParticipant = async (participant) => {
  setSaving(true);
  console.log('Removing participant:', participant);
  
  try {
    // Use the updated delete method with data parameter
    await api.delete(`/campaigns/${campaign.id}/participants`, {
      participants: [{
        entity_type: participant.entity_type,
        entity_id: participant.entity_id
      }]
    });
    
    await fetchCurrentParticipants();
    await fetchAvailableEntities();
    onParticipantsUpdated();
  } catch (error) {
    console.error('Error removing participant:', error);
    setError(error.response?.data?.error || t('manageParticipants.errors.removeFailed'));
  }
  
  setSaving(false);
};

  const getParticipantStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('manageParticipants.status.active')}</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">{t('manageParticipants.status.completed')}</Badge>;
      case 'removed':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">{t('manageParticipants.status.removed')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('manageParticipants.title', { campaignName: campaign.name })}
          </DialogTitle>
          <DialogDescription>
            {t('manageParticipants.description', { 
              type: t(`campaignsTab.type.${campaign.campaign_type}`) 
            })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Tabs defaultValue="current" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">
              {t('manageParticipants.tabs.current')} ({currentParticipants.length})
            </TabsTrigger>
            <TabsTrigger value="add">
              {t('manageParticipants.tabs.add')} ({selectedEntities.length} {t('manageParticipants.selected')})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              {currentParticipants.length > 0 ? (
                <div className="space-y-3">
                  {currentParticipants.map((participant) => (
                    <div key={`${participant.entity_type}-${participant.entity_id}`}className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {participant.entity_type === 'lead' ? (
                            <UserPlus className="h-4 w-4" />
                          ) : (
                            <Building className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{participant.entity_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {participant.entity_email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {participant.entity_email}
                              </div>
                            )}
                            {participant.entity_info && (
                              <div className="text-xs mt-1">{participant.entity_info}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getParticipantStatusBadge(participant.status)}
                        {participant.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveParticipant(participant)}
                            disabled={saving}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('manageParticipants.noCurrentParticipants')}</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t('manageParticipants.searchPlaceholder', { 
                    type: t(`campaignsTab.type.${campaign.campaign_type}`) 
                  })}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedEntities.length > 0 && (
                <Button onClick={handleAddParticipants} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {t('manageParticipants.addSelected')} ({selectedEntities.length})
                </Button>
              )}
            </div>

            <ScrollArea className="h-[350px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">{t('manageParticipants.loading')}</span>
                </div>
              ) : (
                <>
                  {getFilteredAvailableEntities().length > 0 ? (
                    <div className="space-y-2">
                      {getFilteredAvailableEntities().map((entity) => (
                        <div 
                          key={entity.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Checkbox
                            id={`entity-${entity.id}`}
                            checked={selectedEntities.some(selected => selected.entity_id === entity.id)}
                            onCheckedChange={(checked) => handleEntityToggle(entity, checked)}
                          />
                          <Label htmlFor={`entity-${entity.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                {campaign.campaign_type === 'lead' ? (
                                  <UserPlus className="h-4 w-4" />
                                ) : (
                                  <Building className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{getEntityDisplayName(entity)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {getEntityEmail(entity) && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {getEntityEmail(entity)}
                                    </div>
                                  )}
                                  {getEntityInfo(entity) && (
                                    <div className="text-xs mt-1">{getEntityInfo(entity)}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm.trim() 
                          ? t('manageParticipants.noSearchResults')
                          : t('manageParticipants.noAvailableEntities')
                        }
                      </p>
                    </div>
                  )}
                </>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('relationships.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageCampaignParticipantsDialog;