// components/ui/SearchComponent.jsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Search, X } from 'lucide-react';

const SearchComponent = ({ 
  onSearch, 
  placeholder = "Search...",
  className = "",
  initialValue = ''
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState('');

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  const handleSearch = async () => {
    if (!inputValue.trim()) {
      await handleClearSearch();
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const count = await onSearch(inputValue.trim(), false);
      setSearchResultCount(count);
      setShowSearchResults(true);
      setLastSearchTerm(inputValue.trim());
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed');
      setSearchResultCount(0);
      setShowSearchResults(true);
      setLastSearchTerm(inputValue.trim());
    }

    setIsSearching(false);
  };

  const handleClearSearch = async () => {
    setInputValue('');
    setSearchError(null);
    setShowSearchResults(false);
    setLastSearchTerm('');
    
    if (onSearch) {
      setIsSearching(true);
      try {
        const count = await onSearch('', true); 
        setSearchResultCount(count); 
      } catch (error) {
        setSearchError('Failed to load data');
      }
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  const hasInputValue = inputValue.trim().length > 0;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className={`pr-10 w-55 ${searchError ? 'border-red-500' : ''}`}
          />
          {hasInputValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted-foreground/10"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <Button 
          onClick={handleSearch}
          disabled={isSearching}
          size="sm"
          className="px-3"
        >
          {isSearching ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {(searchError || showSearchResults) && (
        <div className="mt-2">
          <div className={`text-xs px-3 py-1 rounded border inline-block ${
            searchError 
              ? 'bg-red-50 text-red-700 border-red-200' 
              : 'bg-muted/50 text-muted-foreground border-muted'
          }`}>
            {searchError 
              ? searchError
              : `Result${searchResultCount !== 1 ? 's' : ''} for "${lastSearchTerm}"`
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchComponent;