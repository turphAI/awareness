import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import categoryService from '../../services/categoryService';

const Container = styled.div`
  width: 100%;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
`;

const Button = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const CategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
`;

const CategoryCard = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
`;

const CategoryName = styled.h4`
  margin: 0;
  color: #333;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ColorIndicator = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: ${props => props.color || '#007bff'};
`;

const CategoryDescription = styled.p`
  color: #666;
  font-size: 14px;
  margin: 10px 0;
`;

const CategoryStats = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-top: 15px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 5px;
`;

const ActionButton = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  ${props => props.variant === 'delete' ? `
    background: #dc3545;
    color: white;
    &:hover { background: #c82333; }
  ` : `
    background: #6c757d;
    color: white;
    &:hover { background: #5a6268; }
  `}
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const CategoryForm = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

const FormRow = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  
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

const Input = styled.input`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const TextArea = styled.textarea`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const CategoryManager = ({ categories, sources }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#007bff'
  });
  
  const queryClient = useQueryClient();

  // Create category mutation
  const createCategoryMutation = useMutation(categoryService.createCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
      setShowForm(false);
      setFormData({ name: '', description: '', color: '#007bff' });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation(categoryService.deleteCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createCategoryMutation.mutate(formData);
    }
  };

  const handleDelete = (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const getSourceCount = (categoryName) => {
    return sources.filter(source => 
      source.categories.includes(categoryName)
    ).length;
  };

  return (
    <Container>
      <Header>
        <Title>Categories</Title>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Category'}
        </Button>
      </Header>

      {showForm && (
        <CategoryForm>
          <form onSubmit={handleSubmit}>
            <FormRow>
              <FormGroup>
                <Label>Name</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Category name"
                  required
                />
              </FormGroup>
              <FormGroup style={{ maxWidth: '100px' }}>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </FormGroup>
            </FormRow>
            
            <FormGroup>
              <Label>Description</Label>
              <TextArea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the category"
              />
            </FormGroup>
            
            <ButtonGroup>
              <Button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCategoryMutation.isLoading}
              >
                {createCategoryMutation.isLoading ? 'Creating...' : 'Create Category'}
              </Button>
            </ButtonGroup>
          </form>
        </CategoryForm>
      )}

      {categories.length === 0 ? (
        <EmptyState>
          <h3>No categories found</h3>
          <p>Create your first category to organize your sources</p>
        </EmptyState>
      ) : (
        <CategoryGrid>
          {categories.map(category => (
            <CategoryCard key={category._id}>
              <CategoryHeader>
                <CategoryName>
                  <ColorIndicator color={category.color} />
                  {category.name}
                </CategoryName>
                {!category.isSystem && (
                  <ActionButtons>
                    <ActionButton
                      variant="delete"
                      onClick={() => handleDelete(category._id)}
                      disabled={deleteCategoryMutation.isLoading}
                    >
                      Delete
                    </ActionButton>
                  </ActionButtons>
                )}
              </CategoryHeader>
              
              {category.description && (
                <CategoryDescription>
                  {category.description}
                </CategoryDescription>
              )}
              
              <CategoryStats>
                <span>{getSourceCount(category.name)} sources</span>
                <span>{category.isSystem ? 'System' : 'Custom'}</span>
              </CategoryStats>
            </CategoryCard>
          ))}
        </CategoryGrid>
      )}
    </Container>
  );
};

export default CategoryManager;