import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Paperclip, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SendEmailDialog = ({ open, onOpenChange, recipient, recipientName }) => {
  const { t } = useTranslation();
  const [isGisLoaded, setIsGisLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    to: recipient || '',
    subject: '',
    body: '',
  });

  const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

  // Helper functions for localStorage auth
  const getStoredGoogleAuth = () => {
    try {
      const authData = localStorage.getItem('google_gmail_auth');
      if (!authData) return null;
      
      const parsed = JSON.parse(authData);
      
      // Check if token hasn't expired (with 5 minute buffer)
      if (parsed.expiresAt && new Date().getTime() > (parsed.expiresAt - 300000)) {
        localStorage.removeItem('google_gmail_auth');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Error reading Google auth from localStorage:', error);
      localStorage.removeItem('google_gmail_auth');
      return null;
    }
  };

  const setStoredGoogleAuth = (authData) => {
    try {
      if (authData) {
        // Calculate expiration time (default 1 hour, with buffer)
        const expiresIn = authData.expires_in || 3600;
        const expiresAt = new Date().getTime() + (expiresIn * 1000);
        
        const dataToStore = {
          access_token: authData.access_token,
          expiresAt: expiresAt,
          granted: true,
          timestamp: new Date().getTime()
        };
        
        localStorage.setItem('google_gmail_auth', JSON.stringify(dataToStore));
      } else {
        localStorage.removeItem('google_gmail_auth');
      }
    } catch (error) {
      console.warn('Error storing Google auth in localStorage:', error);
    }
  };

  // Load Google Identity Services script
  useEffect(() => {
    // Check for stored auth on mount
    const storedAuth = getStoredGoogleAuth();
    if (storedAuth && storedAuth.access_token) {
      setAccessToken(storedAuth.access_token);
      setIsAuthorized(true);
    }

    const loadGis = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_APP_GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              setError('Authorization failed: ' + response.error);
              return;
            }
            setAccessToken(response.access_token);
            setIsAuthorized(true);
            // Store the auth data
            setStoredGoogleAuth(response);
          },
        });
        setTokenClient(client);
        setIsGisLoaded(true);
      };
      document.body.appendChild(script);
    };

    if (!window.google?.accounts) {
      loadGis();
    } else {
      setIsGisLoaded(true);
      if (!tokenClient) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_APP_GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              setError('Authorization failed: ' + response.error);
              return;
            }
            setAccessToken(response.access_token);
            setIsAuthorized(true);
            // Store the auth data
            setStoredGoogleAuth(response);
          },
        });
        setTokenClient(client);
      }
    }
  }, []);

  // Update recipient when prop changes
  useEffect(() => {
    if (recipient) {
      setFormData(prev => ({ ...prev, to: recipient }));
    }
  }, [recipient]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        to: recipient || '',
        subject: '',
        body: '',
      });
      setError('');
      setSuccess(false);
    }
  }, [open, recipient]);

  const handleAuthorize = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      setError('Token client not initialized');
    }
  };

  const createRawMessage = (to, subject, body) => {
    // Encode subject with RFC 2047 for UTF-8 support
    const encodeSubject = (str) => {
      // Check if encoding is needed (contains non-ASCII characters)
      if (/[^\x00-\x7F]/.test(str)) {
        return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`;
      }
      return str;
    };

    // Properly encode UTF-8 strings to base64url
    const utf8ToBase64Url = (str) => {
      // Use native btoa with proper UTF-8 encoding
      const base64 = btoa(unescape(encodeURIComponent(str)));
      // Convert to base64url format
      return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };

    const message = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      'MIME-Version: 1.0',
      `Subject: ${encodeSubject(subject)}`,
      '',
      btoa(unescape(encodeURIComponent(body))),
    ].join('\r\n');

    return utf8ToBase64Url(message);
  };

  const handleSendEmail = async () => {
    if (!formData.to || !formData.subject || !formData.body) {
      setError('Please fill in all fields');
      return;
    }

    if (!isAuthorized || !accessToken) {
      setError('Please authorize Gmail access first');
      return;
    }

    setSending(true);
    setError('');

    try {
      const rawMessage = createRawMessage(
        formData.to,
        formData.subject,
        formData.body
      );

      // Direct REST API call to Gmail
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: rawMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send email');
      }

      const result = await response.json();
      
      if (result.id) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Error sending email:', err);
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <Mail className="h-5 w-5 flex-shrink-0" />
            <span className="flex-shrink-0">{t('sendEmail.title', 'Send Email')}</span>
            {recipientName && (
              <span className="text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]" title={recipientName}>
                to {recipientName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {t('sendEmail.description', 'Compose and send an email via Gmail')}
          </DialogDescription>
        </DialogHeader>

        {!isGisLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t('common.loading', 'Loading')}...</span>
          </div>
        ) : (
          <div className="space-y-4 min-w-0">
            {!isAuthorized && (
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span>{t('sendEmail.authRequired', 'Authorize Gmail access to send emails')}</span>
                  <Button onClick={handleAuthorize} size="sm">
                    {t('sendEmail.authorize', 'Authorize Gmail')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="break-words">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  {t('sendEmail.success', 'Email sent successfully!')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 min-w-0">
              <Label htmlFor="to">{t('sendEmail.to', 'To')}</Label>
              <Input
                id="to"
                type="email"
                value={formData.to}
                onChange={(e) => handleInputChange('to', e.target.value)}
                placeholder="recipient@example.com"
                disabled={sending}
                className="w-full break-all"
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label htmlFor="subject">{t('sendEmail.subject', 'Subject')}</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder={t('sendEmail.subjectPlaceholder', 'Enter email subject')}
                disabled={sending}
                className="w-full break-all"
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label htmlFor="body">{t('sendEmail.message', 'Message')}</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => handleInputChange('body', e.target.value)}
                placeholder={t('sendEmail.messagePlaceholder', 'Enter your message here...')}
                rows={10}
                disabled={sending}
                className="resize-none w-full break-all overflow-wrap-anywhere"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={sending || !isAuthorized || !isGisLoaded}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('sendEmail.sending', 'Sending')}...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {t('sendEmail.send', 'Send Email')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendEmailDialog;