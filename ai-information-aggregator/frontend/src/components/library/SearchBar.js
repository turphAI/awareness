import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const SearchContainer = styled.div`
  position: relative;
  margin-bottom: 20px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  background: #f8f9fa;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    background: white;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
  
  &::placeholder {
    color: #6c757d;
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 16px;
  pointer-events: none;
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: ${props => props.show ? 'block' : 'none'};
  
  &:hover {
    background: #e9ecef;
    color: #495057;
  }
`;

const SearchSuggestions = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  display: ${props => props.show ? 'block' : 'none'};
`;

const SuggestionItem = styled.div`
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
  font-size: 14px;
  
  &:hover {
    background: #f8f9fa;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const SuggestionType = styled.span`
  color: #6c757d;
  font-size: 12px;
  text-transform: uppercase;
  margin-left: 8px;
`;

const SearchBar = ({ value, onChange, placeholder = "Search..." }) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, onChange, value]);

  // Update input when external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Mock suggestions - in real app, this would come from API
  const mockSuggestions = [
    { text: 'machine learning', type: 'topic' },
    { text: 'neural networks', type: 'topic' },
    { text: 'GPT-4', type: 'keyword' },
    { text: 'transformer architecture', type: 'topic' },
    { text: 'AI ethics', type: 'topic' },
  ];

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Show suggestions if there's input
    if (newValue.trim()) {
      const filtered = mockSuggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(newValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.text);
    onChange(suggestion.text);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <SearchContainer>
      <SearchIcon>🔍</SearchIcon>
      <SearchInput
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => inputValue.trim() && setShowSuggestions(true)}
        placeholder={placeholder}
      />
      <ClearButton
        show={inputValue.length > 0}
        onClick={handleClear}
        title="Clear search"
      >
        ✕
      </ClearButton>
      
      <SearchSuggestions show={showSuggestions && suggestions.length > 0}>
        {suggestions.map((suggestion, index) => (
          <SuggestionItem
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
          >
            {suggestion.text}
            <SuggestionType>{suggestion.type}</SuggestionType>
          </SuggestionItem>
        ))}
      </SearchSuggestions>
    </SearchContainer>
  );
};

export default SearchBar;