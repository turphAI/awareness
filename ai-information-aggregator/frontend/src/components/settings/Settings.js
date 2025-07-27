import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import TopicPreferences from './TopicPreferences';
import NotificationSettings from './NotificationSettings';
import ContentVolumeSettings from './ContentVolumeSettings';
import DiscoverySettings from './DiscoverySettings';
import SummaryPreferences from './SummaryPreferences';
import DigestScheduling from './DigestScheduling';
import configurationService from '../../services/configurationService';

const SettingsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 10px;
`;

const Subtitle = styled.p`
  color: #666;
  font-size: 16px;
`;

const TabContainer = styled.div`
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 30px;
`;

const TabList = styled.div`
  display: flex;
  gap: 0;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.active ? '#007bff' : '#666'};
  border-bottom: 2px solid ${props => props.active ? '#007bff' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    color: #007bff;
    background-color: #f8f9fa;
  }
`;

const TabContent = styled.div`
  min-height: 400px;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  flex-direction: column;
  gap: 15px;
`;

const Spinner = styled.div`
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: #666;
  margin: 0;
`;

const ErrorContainer = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
`;

const Settings = () => {
  const [activeTab, setActiveTab] = useState('topics');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const tabs = [
    { id: 'topics', label: 'Topic Preferences', component: TopicPreferences },
    { id: 'notifications', label: 'Notifications', component: NotificationSettings },
    { id: 'content', label: 'Content Volume', component: ContentVolumeSettings },
    { id: 'discovery', label: 'Discovery', component: DiscoverySettings },
    { id: 'summary', label: 'Summary', component: SummaryPreferences },
    { id: 'digest', label: 'Digest', component: DigestScheduling }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const allSettings = await configurationService.getAllSettings();
      setSettings(allSettings);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsUpdate = (category, updatedSettings) => {
    setSettings(prev => ({
      ...prev,
      [category]: updatedSettings
    }));
  };

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  if (loading) {
    return (
      <SettingsContainer>
        <LoadingContainer>
          <Spinner />
          <LoadingText>Loading settings...</LoadingText>
        </LoadingContainer>
      </SettingsContainer>
    );
  }

  return (
    <SettingsContainer>
      <Header>
        <Title>System Configuration</Title>
        <Subtitle>
          Customize your AI Information Aggregator experience by adjusting preferences and settings.
        </Subtitle>
      </Header>

      {error && (
        <ErrorContainer>
          {error}
        </ErrorContainer>
      )}

      <TabContainer>
        <TabList>
          {tabs.map(tab => (
            <Tab
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </TabContainer>

      <TabContent>
        {ActiveComponent && settings && (
          <ActiveComponent
            settings={settings}
            onUpdate={handleSettingsUpdate}
            onReload={loadSettings}
          />
        )}
      </TabContent>
    </SettingsContainer>
  );
};

export default Settings;