// components/email/RichTextEditor.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import FroalaEditor from 'react-froala-wysiwyg';
// Import Froala Editor CSS and JS
import 'froala-editor/css/froala_style.min.css';
import 'froala-editor/css/froala_editor.pkgd.min.css';
import 'froala-editor/js/plugins.pkgd.min.js';
import 'froala-editor/js/plugins/code_view.min.js';
import 'froala-editor/js/plugins/image.min.js';
import 'froala-editor/js/plugins/image_manager.min.js';
import 'froala-editor/js/plugins/fullscreen.min.js';

const RichTextEditor = ({ value, onChange, api }) => {
  const apiRef = useRef(api);
  const editorRef = useRef(null);
  
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  // Register custom button before editor initialization
  useEffect(() => {
    if (typeof window !== 'undefined' && window.FroalaEditor) {
      // Define the custom image placeholder button
      window.FroalaEditor.DefineIcon('imagePlaceholder', { NAME: 'image', SVG_KEY: 'insertImage' });
      window.FroalaEditor.RegisterCommand('imagePlaceholder', {
        title: 'Insert Image Placeholder',
        focus: false,
        undo: false,
        refreshAfterCallback: false,
        callback: function () {
          const placeholderHtml = `
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNSw1Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI0NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RHJhZyBpbWFnZSBoZXJlPC90ZXh0PgogIDx0ZXh0IHg9IjUwJSIgeT0iNjAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPm9yIGNsaWNrIHRvIGJyb3dzZTwvdGV4dD4KPC9zdmc+" 
                 alt="Image Placeholder" 
                 class="fr-draggable image-placeholder" 
                 style="width: 300px; height: 200px; border: 2px dashed #ddd; cursor: pointer; display: block; margin: 10px auto;"
                 data-placeholder="true" />
          `;
          this.html.insert(placeholderHtml);
        }
      });
    }
  }, []);

  const config = useMemo(() => {
    if (!api) {
      return { placeholderText: 'Loading Editor...' };
    }

    const token = 
      localStorage.getItem('auth_token') || 
      sessionStorage.getItem('auth_token');
    
    const baseURL = import.meta.env.VITE_BASE_URL || '';

    return {
      placeholderText: 'Design your email template here...',
      heightMin: 400,
      fullPage: true,
      htmlUntouched: true,
      
      // Image configuration
      imageUpload: true,
      imageAllowedTypes: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
      imageMaxSize: 10 * 1024 * 1024,
      imageInsertButtons: ['imageBack', '|', 'imageByURL'],
      
      // Image Manager configuration
      imageManagerLoadURL: `${baseURL}/api/mailing/images`,
      imageManagerUploadURL: `${baseURL}/api/mailing/images`,
      imageManagerDeleteURL: `${baseURL}/api/mailing/images`,
      
      // Add authentication headers
      requestWithCORS: true,
      requestHeaders: token ? {
        'Authorization': `Bearer ${token}`
      } : {},

      events: {
        // Handle image uploads (drag & drop on placeholders)
        'image.beforeUpload': async function (images) {
          const editor = this;
          const file = images[0];
          if (!file) { 
            console.log('No file provided in images array');
            return false; 
          }
          
          console.log('Uploading image:', file.name, 'Size:', file.size, 'Type:', file.type);
          
          // Create FormData and append the file
          const formData = new FormData();
          formData.append('file', file, file.name);
          
          // Log FormData contents for debugging
          for (let pair of formData.entries()) {
            console.log('FormData entry:', pair[0], pair[1]);
          }
          
          try {
            // Use native fetch instead of your API wrapper to avoid any issues
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            const baseURL = import.meta.env.VITE_BASE_URL || '';
            
            const response = await fetch(`${baseURL}/api/mailing/images`, {
              method: 'POST',
              body: formData,
              headers: token ? {
                'Authorization': `Bearer ${token}`
              } : {}
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
              throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data?.link) {
              console.log('Image uploaded successfully:', data.link);
              editor.image.insert(data.link, null, null, editor.image.get());
              return true;
            } else {
              throw new Error('Invalid response from server');
            }
          } catch (error) {
            console.error('Image upload failed:', error);
            const errorMsg = error.message || 'Upload failed';
            editor.events.trigger('popups.show', ['image.error', `Upload failed: ${errorMsg}`]);
          }
          return false;
        },

        // Intercept image manager load to use your API
        'imageManager.beforeLoad': async function () {
          const editor = this;
          console.log('Loading images from API...');
          
          try {
            const response = await apiRef.current.get('/mailing/images');
            console.log('Images loaded:', response.data);
            
            // Transform your API response to Froala format
            const images = response.data.map(img => ({
              url: img.url || img.link,
              thumb: img.thumb || img.url || img.link,
              tag: img.name || img.filename || 'Image'
            }));
            
            editor.imageManager.set(images);
            return false; // Prevent default request
          } catch (error) {
            console.error("Failed to load images:", error);
            const errorMsg = error.response?.data?.error || error.message;
            
            if (error.response?.status === 401) {
              editor.events.trigger('popups.show', ['imageManager.error', 'Authentication failed. Please login again.']);
            } else {
              editor.events.trigger('popups.show', ['imageManager.error', `Failed to load images: ${errorMsg}`]);
            }
            return false;
          }
        },

        // Handle image manager uploads
        'imageManager.beforeUpload': async function (images) {
          const editor = this;
          const file = images[0];
          if (!file) { 
            console.log('No file provided for manager upload');
            return false; 
          }
          
          console.log('Uploading via image manager:', file.name, 'Size:', file.size);
          
          const formData = new FormData();
          formData.append('file', file, file.name);
          
          try {
            // Use native fetch for manager uploads too
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            const baseURL = import.meta.env.VITE_BASE_URL || '';
            
            const response = await fetch(`${baseURL}/api/mailing/images`, {
              method: 'POST',
              body: formData,
              headers: token ? {
                'Authorization': `Bearer ${token}`
              } : {}
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
              throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data?.link) {
              console.log('Image uploaded via manager:', data.link);
              
              // Add to manager display
              const newImage = {
                url: data.link,
                thumb: data.link,
                tag: data.name || file.name
              };
              
              editor.imageManager.add(newImage);
              return true;
            } else {
              throw new Error('Invalid response from server');
            }
          } catch (error) {
            console.error('Manager upload failed:', error);
            const errorMsg = error.message || 'Upload failed';
            editor.events.trigger('popups.show', ['imageManager.error', `Upload failed: ${errorMsg}`]);
          }
          return false;
        },

'imageManager.beforeDeleteImage': function ($img) {
  const editor = this;

  const src = $img.attr('src');
  if (!src) {
    console.error("No image src found for deletion.");
    return false;
  }

  const filename = src.split('/').pop();
  console.log('Deleting image from server:', filename);

  apiRef.current.delete(`/mailing/images/${filename}`)
    .then(() => {
      console.log('✅ Deleted from server');

      // Remove from Froala Image Manager UI
      const container = $img.closest('.fr-image-container');
      if (container && container.length) {
        container.remove();
        console.log('✅ Removed from Image Manager UI');
      }
    })
    .catch((err) => {
      console.error('❌ Delete failed:', err);
      editor.events.trigger('popups.show', [
        'imageManager.error',
        `Delete failed: ${err.message || 'Server error'}`,
      ]);
    });

  // Prevent Froala’s own request
  return false;
},

        // Handle clicks on image placeholders
        'click': function (clickEvent) {
          const editor = this;
          const target = clickEvent.originalEvent.target;
          
          if (target.tagName === 'IMG' && target.getAttribute('data-placeholder') === 'true') {
            // Show options: Browse existing or upload new
            editor.imageManager.show();
          }
        },

        // Enhanced drag and drop for placeholders
        'drop': function (dropEvent) {
          const files = dropEvent.originalEvent.dataTransfer.files;
          const target = dropEvent.originalEvent.target;
          
          if (target.tagName === 'IMG' && target.getAttribute('data-placeholder') === 'true') {
            dropEvent.preventDefault();
            
            if (files && files.length > 0) {
              const file = files[0];
              if (file.type.startsWith('image/')) {
                // Select the placeholder image and upload to replace it
                this.image.get = function() { return $(target); };
                this.image.upload([file]);
              }
            }
          }
        }
      },

      // Toolbar with placeholder insertion
      toolbarButtons: [
        ['paragraphFormat', 'bold', 'italic', 'underline', 'strikeThrough'],
        ['formatUL', 'formatOL', 'outdent', 'indent'],
        ['insertLink', 'imageManager', 'imagePlaceholder'],
        ['textColor', 'backgroundColor'],
        ['align', 'clearFormatting', 'fullscreen', 'html'],
      ],
    };
  }, [api]);

  return (
    <FroalaEditor
      ref={editorRef}
      tag='textarea'
      config={config}
      model={value}
      onModelChange={onChange}
    />
  );
};

export default RichTextEditor;