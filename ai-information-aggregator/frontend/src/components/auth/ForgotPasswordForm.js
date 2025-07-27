import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { authService } from '../../services/authService';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const ForgotPasswordContainer = styled.div`
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 20px;
  color: #333;
`;

const Description = styled.p`
  text-align: center;
  margin-bottom: 30px;
  color: #666;
  line-height: 1.5;
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
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: #0056b3;
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

const SuccessAlert = styled.div`
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #c3e6cb;
  text-align: center;
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
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
});

const ForgotPasswordForm = () => {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      await authService.requestPasswordReset(values.email);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ForgotPasswordContainer>
        <Title>Check Your Email</Title>
        <SuccessAlert>
          We've sent a password reset link to your email address. 
          Please check your inbox and follow the instructions to reset your password.
        </SuccessAlert>
        <LinkContainer>
          <StyledLink to="/login">Back to Sign In</StyledLink>
        </LinkContainer>
      </ForgotPasswordContainer>
    );
  }

  return (
    <ForgotPasswordContainer>
      <Title>Forgot Password</Title>
      <Description>
        Enter your email address and we'll send you a link to reset your password.
      </Description>
      
      {error && (
        <ErrorAlert>
          {error}
        </ErrorAlert>
      )}

      <Formik
        initialValues={{ email: '' }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <StyledForm>
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

            <SubmitButton
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </SubmitButton>
          </StyledForm>
        )}
      </Formik>

      <LinkContainer>
        <StyledLink to="/login">Back to Sign In</StyledLink>
      </LinkContainer>
    </ForgotPasswordContainer>
  );
};

export default ForgotPasswordForm;