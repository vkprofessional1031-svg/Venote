import React, { useState, useRef, useEffect } from 'react';

interface TagManagerProps {
  entryId: string;
  tags: string[];
  allUniqueTags: string[];
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
}

export default function TagManager({ entryId, tags, allUniqueTags, onAddTag, onRemoveTag }: TagManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredTags = allUniqueTags.filter(t => 
    t.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(t)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.trim().toLowerCase();
      if (val) {
        onAddTag(entryId, val);
        setInputValue('');
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSelectTag = (tag: string) => {
    onAddTag(entryId, tag);
    setInputValue('');
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6" ref={containerRef}>
      {/* Existing Tags */}
      {tags.map(tag => (
        <span 
          key={tag} 
          className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-hairline text-sm font-mono tracking-wide text-primary-text transition-colors hover:border-primary-accent"
        >
          #{tag}
          <button 
            onClick={() => onRemoveTag(entryId, tag)}
            className="text-muted-text hover:text-primary-accent transition-colors"
            title="Remove tag"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </span>
      ))}

      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          className="bg-transparent border border-dashed border-muted-text/50 rounded-full px-3 py-1 text-sm font-mono text-primary-text focus:outline-none focus:border-primary-accent focus:border-solid w-[120px] focus:w-[160px] transition-all placeholder:text-muted-text/70"
        />
        
        {/* Dropdown Suggestion List */}
        {showDropdown && filteredTags.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-hairline rounded-lg shadow-xl overflow-hidden z-50">
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {filteredTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleSelectTag(tag)}
                  className="w-full text-left px-3 py-2 font-mono text-sm text-primary-text hover:bg-background/50 hover:text-primary-accent transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
