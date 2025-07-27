import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';

const RegisterContainer = styled.div`
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 30px;
  color: #333;
`;

const StyledForm = styled(Form)`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
`;

const Input = styled(Field)`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;

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

const SubmitButton = styled.button`
  padding: 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: #218838;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const LinkContainer = styled.div`
  text-align: center;
  margin-top: 20px;
`;

const StyledLink = styled(Link)`
  color: #007bff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const ErrorAlert = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

const validationSchema = Yup.object({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .required('Name is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

const RegisterForm = () => {
  const { register, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      clearError();
      const { confirmPassword, ...userData } = values;
      await register(userData);
      navigate('/dashboard');
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegisterContainer>
      <Title>Create Account</Title>
      
      {error && (
        <ErrorAlert>
          {error}
        </ErrorAlert>
      )}

      <Formik
        initialValues={{
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <StyledForm>
            <FormGroup>
              <Label htmlFor="name">Full Name</Label>
              <Input
                type="text"
                name="name"
                id="name"
                placeholder="Enter your full name"
              />
              <ErrorMessage name="name" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                name="email"
                id="email"
                placeholder="Enter your email"
              />
              <ErrorMessage name="email" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                name="password"
                id="password"
                placeholder="Create a password"
              />
              <ErrorMessage name="password" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                placeholder="Confirm your password"
              />
              <ErrorMessage name="confirmPassword" component={ErrorText} />
            </FormGroup>

            <SubmitButton
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? 'Creating Account...' : 'Create Account'}
            </SubmitButton>
          </StyledForm>
        )}
      </Formik>

      <LinkContainer>
        <p>
          Already have an account?{' '}
          <StyledLink to="/login">Sign in</StyledLink>
        </p>
      </LinkContainer>
    </RegisterContainer>
  );
};

export default RegisterForm;