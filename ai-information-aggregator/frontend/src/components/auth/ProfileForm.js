import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import styled from 'styled-components';

const ProfileContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 30px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
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

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const SubmitButton = styled.button`
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
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

const CancelButton = styled.button`
  padding: 12px 24px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #545b62;
  }
`;

const SuccessAlert = styled.div`
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #c3e6cb;
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
});

const ProfileForm = ({ onCancel }) => {
  const { user, updateProfile } = useAuth();
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      setSuccess(false);
      await updateProfile(values);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <ProfileContainer>
      <Title>Profile Settings</Title>
      
      {success && (
        <SuccessAlert>
          Profile updated successfully!
        </SuccessAlert>
      )}

      {error && (
        <ErrorAlert>
          {error}
        </ErrorAlert>
      )}

      <Formik
        initialValues={{
          name: user.name || '',
          email: user.email || '',
          preferences: {
            topics: user.preferences?.topics || [],
            contentVolume: user.preferences?.contentVolume || 10,
            discoveryAggressiveness: user.preferences?.discoveryAggressiveness || 5,
            summaryLength: user.preferences?.summaryLength || 'medium',
            digestFrequency: user.preferences?.digestFrequency || 'daily',
          },
          notifications: {
            email: user.notifications?.email || true,
            push: user.notifications?.push || false,
            digest: user.notifications?.digest || true,
          },
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, values }) => (
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
              <Label htmlFor="preferences.contentVolume">Daily Content Volume</Label>
              <Field
                type="number"
                name="preferences.contentVolume"
                id="preferences.contentVolume"
                min="1"
                max="50"
                component="input"
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s',
                  width: '100%'
                }}
              />
              <ErrorMessage name="preferences.contentVolume" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="preferences.summaryLength">Summary Length</Label>
              <Field name="preferences.summaryLength" id="preferences.summaryLength" component="select" style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white',
                transition: 'border-color 0.2s',
                width: '100%'
              }}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </Field>
              <ErrorMessage name="preferences.summaryLength" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="preferences.digestFrequency">Digest Frequency</Label>
              <Field name="preferences.digestFrequency" id="preferences.digestFrequency" component="select" style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white',
                transition: 'border-color 0.2s',
                width: '100%'
              }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Field>
              <ErrorMessage name="preferences.digestFrequency" component={ErrorText} />
            </FormGroup>

            <FormGroup>
              <Label>
                <Field
                  type="checkbox"
                  name="notifications.email"
                  style={{ marginRight: '8px' }}
                />
                Email Notifications
              </Label>
            </FormGroup>

            <FormGroup>
              <Label>
                <Field
                  type="checkbox"
                  name="notifications.push"
                  style={{ marginRight: '8px' }}
                />
                Push Notifications
              </Label>
            </FormGroup>

            <FormGroup>
              <Label>
                <Field
                  type="checkbox"
                  name="notifications.digest"
                  style={{ marginRight: '8px' }}
                />
                Digest Notifications
              </Label>
            </FormGroup>

            <ButtonGroup>
              {onCancel && (
                <CancelButton type="button" onClick={onCancel}>
                  Cancel
                </CancelButton>
              )}
              <SubmitButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </SubmitButton>
            </ButtonGroup>
          </StyledForm>
        )}
      </Formik>
    </ProfileContainer>
  );
};

export default ProfileForm;