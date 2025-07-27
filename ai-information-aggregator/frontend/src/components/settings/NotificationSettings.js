import React, { useState } from 'react';
import styled from 'styled-components';
import configurationService from '../../services/configurationService';

const Container = styled.div`
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.h3`
  color: #333;
  margin-bottom: 16px;
  font-size: 18px;
`;

const Description = styled.p`
  color: #666;
  margin-bottom: 24px;
  line-height: 1.5;
`;

const FormGroup = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 12px;
  font-weight: 500;
  color: #333;
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CheckboxItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background-color: #f8f9fa;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.div`
  flex: 1;
`;

const CheckboxTitle = styled.div`
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
`;

const CheckboxDescription = styled.div`
  font-size: 14px;
  color: #666;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }

  &:disabled {
    background-color: #f8f9fa;
    color: #6c757d;
  }
`;

const SaveButton = styled.button`
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  margin-top: 24px;

  &:hover {
    background-color: #218838;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin-top: 16px;
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-top: 16px;
`;

const NotificationSettings = ({ settings, onUpdate }) => {
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: settings.notificationSettings?.emailEnabled || false,
    pushEnabled: settings.notificationSettings?.pushEnabled || false,
    digestEnabled: settings.notificationSettings?.digestEnabled || false,
    breakingNewsEnabled: settings.notificationSettings?.breakingNewsEnabled || false,
    newContentEnabled: settings.notificationSettings?.newContentEnabled || false,
    weeklyDigestEnabled: settings.notificationSettings?.weeklyDigestEnabled || false,
    emailFrequency: settings.notificationSettings?.emailFrequency || 'immediate',
    pushFrequency: settings.notificationSettings?.pushFrequency || 'immediate',
    quietHoursEnabled: settings.notificationSettings?.quietHoursEnabled || false,
    quietHoursStart: settings.notificationSettings?.quietHoursStart || '22:00',
    quietHoursEnd: settings.notificationSettings?.quietHoursEnd || '08:00'
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleCheckboxChange = (field) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSelectChange = (field, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await configurationService.updateNotificationSettings(notificationSettings);
      onUpdate('notificationSettings', notificationSettings);
      
      setMessage({ type: 'success', text: 'Notification settings saved successfully!' });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setMessage({ type: 'error', text: 'Failed to save notification settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Notification Settings</SectionTitle>
      <Description>
        Configure how and when you want to receive notifications about new content, 
        breaking news, and system updates.
      </Description>

      <FormGroup>
        <Label>Notification Channels</Label>
        <CheckboxGroup>
          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.emailEnabled}
              onChange={() => handleCheckboxChange('emailEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>Email Notifications</CheckboxTitle>
              <CheckboxDescription>
                Receive notifications via email
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>

          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.pushEnabled}
              onChange={() => handleCheckboxChange('pushEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>Push Notifications</CheckboxTitle>
              <CheckboxDescription>
                Receive browser push notifications
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>
        </CheckboxGroup>
      </FormGroup>

      <FormGroup>
        <Label>Notification Types</Label>
        <CheckboxGroup>
          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.breakingNewsEnabled}
              onChange={() => handleCheckboxChange('breakingNewsEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>Breaking News</CheckboxTitle>
              <CheckboxDescription>
                High-priority content and urgent updates
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>

          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.newContentEnabled}
              onChange={() => handleCheckboxChange('newContentEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>New Content</CheckboxTitle>
              <CheckboxDescription>
                Notifications when new relevant content is discovered
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>

          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.digestEnabled}
              onChange={() => handleCheckboxChange('digestEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>Daily Digest</CheckboxTitle>
              <CheckboxDescription>
                Daily summary of important content
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>

          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={notificationSettings.weeklyDigestEnabled}
              onChange={() => handleCheckboxChange('weeklyDigestEnabled')}
            />
            <CheckboxLabel>
              <CheckboxTitle>Weekly Digest</CheckboxTitle>
              <CheckboxDescription>
                Weekly roundup of key developments
              </CheckboxDescription>
            </CheckboxLabel>
          </CheckboxItem>
        </CheckboxGroup>
      </FormGroup>

      <FormGroup>
        <Label>Email Frequency</Label>
        <Select
          value={notificationSettings.emailFrequency}
          onChange={(e) => handleSelectChange('emailFrequency', e.target.value)}
          disabled={!notificationSettings.emailEnabled}
        >
          <option value="immediate">Immediate</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <Label>Push Notification Frequency</Label>
        <Select
          value={notificationSettings.pushFrequency}
          onChange={(e) => handleSelectChange('pushFrequency', e.target.value)}
          disabled={!notificationSettings.pushEnabled}
        >
          <option value="immediate">Immediate</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={notificationSettings.quietHoursEnabled}
            onChange={() => handleCheckboxChange('quietHoursEnabled')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Quiet Hours</CheckboxTitle>
            <CheckboxDescription>
              Disable notifications during specified hours
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      {notificationSettings.quietHoursEnabled && (
        <FormGroup>
          <Label>Quiet Hours Schedule</Label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '14px', color: '#666', marginBottom: '4px', display: 'block' }}>
                Start Time
              </label>
              <Select
                value={notificationSettings.quietHoursStart}
                onChange={(e) => handleSelectChange('quietHoursStart', e.target.value)}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i.toString().padStart(2, '0');
                  return (
                    <option key={hour} value={`${hour}:00`}>
                      {hour}:00
                    </option>
                  );
                })}
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '14px', color: '#666', marginBottom: '4px', display: 'block' }}>
                End Time
              </label>
              <Select
                value={notificationSettings.quietHoursEnd}
                onChange={(e) => handleSelectChange('quietHoursEnd', e.target.value)}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i.toString().padStart(2, '0');
                  return (
                    <option key={hour} value={`${hour}:00`}>
                      {hour}:00
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>
        </FormGroup>
      )}

      <SaveButton onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </SaveButton>

      {message && (
        message.type === 'success' ? (
          <SuccessMessage>{message.text}</SuccessMessage>
        ) : (
          <ErrorMessage>{message.text}</ErrorMessage>
        )
      )}
    </Container>
  );
};

export default NotificationSettings;