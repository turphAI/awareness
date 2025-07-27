import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import styled from 'styled-components';
import sourceService from '../../services/sourceService';
import categoryService from '../../services/categoryService';

const FormContainer = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

const FormTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #333;
`;

const FormRow = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const FormGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: 500;
  margin-bottom: 5px;
  color: #333;
`;

const Input = styled(Field)`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
  
  &.error {
    border-color: #dc3545;
  }
`;

const Select = styled(Field)`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const TextArea = styled(Field)`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const ErrorText = styled.div`
  color: #dc3545;
  font-size: 12px;
  margin-top: 5px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  ${props => props.variant === 'primary' ? `
    background-color: #007bff;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #0056b3;
    }
  ` : `
    background-color: #6c757d;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #5a6268;
    }
  `}
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const CategorySection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
`;

const CategoryList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
`;

const CategoryTag = styled.div`
  background: ${props => props.selected ? '#007bff' : '#e9ecef'};
  color: ${props => props.selected ? 'white' : '#333'};
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.selected ? '#0056b3' : '#dee2e6'};
  }
`;

const SuggestedCategories = styled.div`
  margin-top: 15px;
`;

const SuggestionTitle = styled.h5`
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
`;

const UrlValidation = styled.div`
  margin-top: 10px;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  
  ${props => props.status === 'valid' ? `
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  ` : props.status === 'invalid' ? `
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  ` : `
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  `}
`;

const validationSchema = Yup.object({
  url: Yup.string()
    .url('Please enter a valid URL')
    .required('URL is required'),
  name: Yup.string()
    .max(100, 'Name cannot exceed 100 characters')
    .required('Name is required'),
  description: Yup.string()
    .max(500, 'Description cannot exceed 500 characters'),
  type: Yup.string()
    .oneOf(['website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss'])
    .required('Type is required'),
  checkFrequency: Yup.string()
    .oneOf(['hourly', 'daily', 'weekly', 'monthly'])
    .required('Check frequency is required'),
  relevanceScore: Yup.number()
    .min(0, 'Relevance score must be at least 0')
    .max(1, 'Relevance score cannot exceed 1')
    .required('Relevance score is required')
});

const SourceForm = ({ source, categories, onSubmit, onCancel, isLoading }) => {
  const [selectedCategories, setSelectedCategories] = useState(source?.categories || []);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [urlValidation, setUrlValidation] = useState(null);
  const [validatingUrl, setValidatingUrl] = useState(false);

  const initialValues = {
    url: source?.url || '',
    name: source?.name || '',
    description: source?.description || '',
    type: source?.type || 'website',
    checkFrequency: source?.checkFrequency || 'daily',
    relevanceScore: source?.relevanceScore || 0.5,
    requiresAuthentication: source?.requiresAuthentication || false
  };

  const validateUrl = async (url) => {
    if (!url || !url.match(/^https?:\/\/.+/)) {
      setUrlValidation(null);
      return;
    }

    setValidatingUrl(true);
    try {
      const result = await sourceService.validateUrl(url);
      setUrlValidation({ status: 'valid', message: 'URL is valid and reachable' });
      
      // Auto-fill name if not provided
      if (result.title && !initialValues.name) {
        // This would need to be handled by the parent form state
      }
    } catch (error) {
      setUrlValidation({ 
        status: 'invalid', 
        message: error.response?.data?.message || 'URL validation failed' 
      });
    } finally {
      setValidatingUrl(false);
    }
  };

  const getSuggestedCategories = async (formValues) => {
    try {
      const suggestions = await categoryService.suggestCategories({
        url: formValues.url,
        title: formValues.name,
        description: formValues.description
      });
      setSuggestedCategories(suggestions);
    } catch (error) {
      console.error('Failed to get category suggestions:', error);
    }
  };

  const handleCategoryToggle = (categoryName) => {
    setSelectedCategories(prev => 
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleSubmit = (values) => {
    onSubmit({
      ...values,
      categories: selectedCategories
    });
  };

  return (
    <FormContainer>
      <FormTitle>{source ? 'Edit Source' : 'Add New Source'}</FormTitle>
      
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, setFieldValue }) => (
          <Form>
            <FormRow>
              <FormGroup>
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com"
                  onBlur={(e) => validateUrl(e.target.value)}
                />
                <ErrorMessage name="url" component={ErrorText} />
                {validatingUrl && (
                  <UrlValidation status="validating">
                    Validating URL...
                  </UrlValidation>
                )}
                {urlValidation && (
                  <UrlValidation status={urlValidation.status}>
                    {urlValidation.message}
                  </UrlValidation>
                )}
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Source name"
                />
                <ErrorMessage name="name" component={ErrorText} />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <Label htmlFor="type">Type *</Label>
                <Select id="type" name="type" as="select">
                  <option value="website">Website</option>
                  <option value="blog">Blog</option>
                  <option value="academic">Academic</option>
                  <option value="podcast">Podcast</option>
                  <option value="social">Social Media</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="rss">RSS Feed</option>
                </Select>
                <ErrorMessage name="type" component={ErrorText} />
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="checkFrequency">Check Frequency *</Label>
                <Select id="checkFrequency" name="checkFrequency" as="select">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
                <ErrorMessage name="checkFrequency" component={ErrorText} />
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="relevanceScore">Relevance Score *</Label>
                <Input
                  id="relevanceScore"
                  name="relevanceScore"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                />
                <ErrorMessage name="relevanceScore" component={ErrorText} />
              </FormGroup>
            </FormRow>

            <FormGroup>
              <Label htmlFor="description">Description</Label>
              <TextArea
                id="description"
                name="description"
                as="textarea"
                placeholder="Brief description of the source"
              />
              <ErrorMessage name="description" component={ErrorText} />
            </FormGroup>

            <CategorySection>
              <Label>Categories</Label>
              <CategoryList>
                {categories.map(category => (
                  <CategoryTag
                    key={category._id}
                    selected={selectedCategories.includes(category.name)}
                    onClick={() => handleCategoryToggle(category.name)}
                  >
                    {category.name}
                  </CategoryTag>
                ))}
              </CategoryList>
              
              {suggestedCategories.length > 0 && (
                <SuggestedCategories>
                  <SuggestionTitle>Suggested Categories:</SuggestionTitle>
                  <CategoryList>
                    {suggestedCategories.map(suggestion => (
                      <CategoryTag
                        key={suggestion._id}
                        selected={selectedCategories.includes(suggestion.name)}
                        onClick={() => handleCategoryToggle(suggestion.name)}
                        style={{ opacity: 0.8 }}
                      >
                        {suggestion.name} ({(suggestion.score * 100).toFixed(0)}%)
                      </CategoryTag>
                    ))}
                  </CategoryList>
                </SuggestedCategories>
              )}
              
              <Button
                type="button"
                variant="secondary"
                onClick={() => getSuggestedCategories(values)}
                style={{ marginTop: '10px', fontSize: '12px', padding: '5px 10px' }}
              >
                Get Suggestions
              </Button>
            </CategorySection>

            <ButtonGroup>
              <Button type="button" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : source ? 'Update Source' : 'Add Source'}
              </Button>
            </ButtonGroup>
          </Form>
        )}
      </Formik>
    </FormContainer>
  );
};

export default SourceForm;