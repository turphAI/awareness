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
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
`;

const SliderContainer = styled.div`
  margin-bottom: 16px;
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #007bff;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #007bff;
    cursor: pointer;
    border: none;
  }
`;

const SliderValue = styled.div`
  text-align: center;
  margin-top: 8px;
  font-weight: 500;
  color: #007bff;
`;

const SliderLabels = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
  color: #666;
`;

const CheckboxItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background-color: #f8f9fa;
  margin-bottom: 12px;
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

const DiscoverySettings = ({ settings, onUpdate }) => {
  const [discoverySettings, setDiscoverySettings] = useState({
    aggressiveness: settings.discoverySettings?.aggressiveness || 0.7,
    autoApprovalThreshold: settings.discoverySettings?.autoApprovalThreshold || 0.8,
    enableReferenceDiscovery: settings.discoverySettings?.enableReferenceDiscovery || true,
    enableCitationFollowing: settings.discoverySettings?.enableCitationFollowing || true,
    enableSocialMediaDiscovery: settings.discoverySettings?.enableSocialMediaDiscovery || false,
    maxDiscoveryDepth: settings.discoverySettings?.maxDiscoveryDepth || 3,
    discoveryFrequency: settings.discoverySettings?.discoveryFrequency || 'daily',
    enableSerendipity: settings.discoverySettings?.enableSerendipity || true,
    serendipityWeight: settings.discoverySettings?.serendipityWeight || 0.2,
    enableTrendingTopics: settings.discoverySettings?.enableTrendingTopics || true,
    languageFilters: settings.discoverySettings?.languageFilters || ['en'],
    excludeDomains: settings.discoverySettings?.excludeDomains || []
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSliderChange = (field, value) => {
    setDiscoverySettings(prev => ({
      ...prev,
      [field]: parseFloat(value)
    }));
  };

  const handleCheckboxChange = (field) => {
    setDiscoverySettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSelectChange = (field, value) => {
    setDiscoverySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getAggressivenessLabel = (value) => {
    if (value < 0.3) return 'Conservative';
    if (value < 0.7) return 'Moderate';
    return 'Aggressive';
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await configurationService.updateDiscoverySettings(discoverySettings);
      onUpdate('discoverySettings', discoverySettings);
      
      setMessage({ type: 'success', text: 'Discovery settings saved successfully!' });
    } catch (error) {
      console.error('Error saving discovery settings:', error);
      setMessage({ type: 'error', text: 'Failed to save discovery settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Discovery Settings</SectionTitle>
      <Description>
        Configure how aggressively the system discovers new content and sources. 
        Higher aggressiveness means more content discovery but potentially more noise.
      </Description>

      <FormGroup>
        <Label>Discovery Aggressiveness</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={discoverySettings.aggressiveness}
            onChange={(e) => handleSliderChange('aggressiveness', e.target.value)}
          />
          <SliderValue>
            {getAggressivenessLabel(discoverySettings.aggressiveness)} ({Math.round(discoverySettings.aggressiveness * 100)}%)
          </SliderValue>
          <SliderLabels>
            <span>Conservative</span>
            <span>Aggressive</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Auto-Approval Threshold</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={discoverySettings.autoApprovalThreshold}
            onChange={(e) => handleSliderChange('autoApprovalThreshold', e.target.value)}
          />
          <SliderValue>{Math.round(discoverySettings.autoApprovalThreshold * 100)}% confidence required</SliderValue>
          <SliderLabels>
            <span>50%</span>
            <span>100%</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Maximum Discovery Depth</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="1"
            max="5"
            step="1"
            value={discoverySettings.maxDiscoveryDepth}
            onChange={(e) => handleSliderChange('maxDiscoveryDepth', e.target.value)}
          />
          <SliderValue>{discoverySettings.maxDiscoveryDepth} levels deep</SliderValue>
          <SliderLabels>
            <span>1 level</span>
            <span>5 levels</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Discovery Frequency</Label>
        <Select
          value={discoverySettings.discoveryFrequency}
          onChange={(e) => handleSelectChange('discoveryFrequency', e.target.value)}
        >
          <option value="hourly">Every Hour</option>
          <option value="every6hours">Every 6 Hours</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <Label>Discovery Methods</Label>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={discoverySettings.enableReferenceDiscovery}
            onChange={() => handleCheckboxChange('enableReferenceDiscovery')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Reference Discovery</CheckboxTitle>
            <CheckboxDescription>
              Follow links and references found in content to discover new sources
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={discoverySettings.enableCitationFollowing}
            onChange={() => handleCheckboxChange('enableCitationFollowing')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Citation Following</CheckboxTitle>
            <CheckboxDescription>
              Discover content by following academic citations and references
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={discoverySettings.enableSocialMediaDiscovery}
            onChange={() => handleCheckboxChange('enableSocialMediaDiscovery')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Social Media Discovery</CheckboxTitle>
            <CheckboxDescription>
              Include social media platforms in content discovery
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={discoverySettings.enableTrendingTopics}
            onChange={() => handleCheckboxChange('enableTrendingTopics')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Trending Topics</CheckboxTitle>
            <CheckboxDescription>
              Discover content based on trending topics in your field
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      <FormGroup>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={discoverySettings.enableSerendipity}
            onChange={() => handleCheckboxChange('enableSerendipity')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Enable Serendipitous Discovery</CheckboxTitle>
            <CheckboxDescription>
              Occasionally include content outside your usual interests for broader perspective
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      {discoverySettings.enableSerendipity && (
        <FormGroup>
          <Label>Serendipity Weight</Label>
          <SliderContainer>
            <Slider
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={discoverySettings.serendipityWeight}
              onChange={(e) => handleSliderChange('serendipityWeight', e.target.value)}
            />
            <SliderValue>{Math.round(discoverySettings.serendipityWeight * 100)}% of content</SliderValue>
            <SliderLabels>
              <span>10%</span>
              <span>50%</span>
            </SliderLabels>
          </SliderContainer>
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

export default DiscoverySettings;