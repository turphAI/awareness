import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import styled from 'styled-components';

const FormContainer = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 30px;
  margin-bottom: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const FormTitle = styled.h2`
  margin: 0 0 30px 0;
  color: #333;
  text-align: center;
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
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
`;

const Input = styled(Field)`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
  
  &.error {
    border-color: #dc3545;
  }
`;

const TextArea = styled(Field)`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Select = styled(Field)`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
`;

const Checkbox = styled(Field)`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  font-size: 14px;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ColorPicker = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const ColorOption = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${props => props.color};
  border: 3px solid ${props => props.selected ? '#007bff' : '#ddd'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.1);
    border-color: #007bff;
  }
`;

const IconPicker = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const IconOption = styled.div`
  width: 40px;
  height: 40px;
  border: 2px solid ${props => props.selected ? '#007bff' : '#ddd'};
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  background: ${props => props.selected ? '#e3f2fd' : 'white'};
  
  &:hover {
    border-color: #007bff;
    background: #e3f2fd;
  }
`;

const TagsInput = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  min-height: 44px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  
  &:focus-within {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Tag = styled.span`
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TagRemove = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const TagInput = styled.input`
  border: none;
  outline: none;
  flex: 1;
  min-width: 100px;
  padding: 4px;
  font-size: 14px;
`;

const ErrorText = styled.div`
  color: #dc3545;
  font-size: 12px;
  margin-top: 5px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
`;

const Button = styled.button`
  padding: 12px 30px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  
  ${props => props.variant === 'primary' ? `
    background-color: #007bff;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #0056b3;
      transform: translateY(-1px);
    }
  ` : `
    background-color: #6c757d;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #5a6268;
      transform: translateY(-1px);
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const validationSchema = Yup.object({
  name: Yup.string()
    .max(100, 'Collection name cannot exceed 100 characters')
    .required('Collection name is required'),
  description: Yup.string()
    .max(500, 'Description cannot exceed 500 characters'),
  color: Yup.string()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color'),
  icon: Yup.string()
    .required('Please select an icon')
});

const colorOptions = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
  '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
  '#95a5a6', '#f1c40f', '#8e44ad', '#16a085'
];

const iconOptions = [
  '📁', '📚', '🔖', '⭐', '💡', '🎯', 
  '📊', '🔬', '🎨', '🎵', '📰', '🏆'
];

const CollectionForm = ({ collection, onSubmit, onCancel, isLoading }) => {
  const [tags, setTags] = useState(collection?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const initialValues = {
    name: collection?.name || '',
    description: collection?.description || '',
    public: collection?.public || false,
    featured: collection?.featured || false,
    color: collection?.color || '#3498db',
    icon: collection?.icon || '📁'
  };

  const handleTagAdd = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = (values) => {
    onSubmit({
      ...values,
      tags
    });
  };

  return (
    <FormContainer>
      <FormTitle>{collection ? 'Edit Collection' : 'Create New Collection'}</FormTitle>
      
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, setFieldValue }) => (
          <Form>
            <FormGroup>
              <Label htmlFor="name">Collection Name *</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Enter collection name"
              />
              <ErrorMessage name="name" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="description">Description</Label>
              <TextArea
                id="description"
                name="description"
                as="textarea"
                placeholder="Describe your collection (optional)"
              />
              <ErrorMessage name="description" component={ErrorText} />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <Label>Color</Label>
                <ColorPicker>
                  {colorOptions.map(color => (
                    <ColorOption
                      key={color}
                      color={color}
                      selected={values.color === color}
                      onClick={() => setFieldValue('color', color)}
                    />
                  ))}
                </ColorPicker>
              </FormGroup>

              <FormGroup>
                <Label>Icon</Label>
                <IconPicker>
                  {iconOptions.map(icon => (
                    <IconOption
                      key={icon}
                      selected={values.icon === icon}
                      onClick={() => setFieldValue('icon', icon)}
                    >
                      {icon}
                    </IconOption>
                  ))}
                </IconPicker>
              </FormGroup>
            </FormRow>

            <FormGroup>
              <Label>Tags</Label>
              <TagsInput>
                {tags.map(tag => (
                  <Tag key={tag}>
                    {tag}
                    <TagRemove
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                    >
                      ×
                    </TagRemove>
                  </Tag>
                ))}
                <TagInput
                  type="text"
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                />
              </TagsInput>
            </FormGroup>

            <CheckboxGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  name="public"
                />
                Make this collection public
              </CheckboxLabel>
            </CheckboxGroup>

            {values.public && (
              <CheckboxGroup>
                <CheckboxLabel>
                  <Checkbox
                    type="checkbox"
                    name="featured"
                  />
                  Feature this collection
                </CheckboxLabel>
              </CheckboxGroup>
            )}

            <ButtonGroup>
              <Button type="button" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : collection ? 'Update Collection' : 'Create Collection'}
              </Button>
            </ButtonGroup>
          </Form>
        )}
      </Formik>
    </FormContainer>
  );
};

export default CollectionForm;