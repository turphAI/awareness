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

const ContentVolumeSettings = ({ settings, onUpdate }) => {
  const [volumeSettings, setVolumeSettings] = useState({
    dailyLimit: settings.contentVolumeSettings?.dailyLimit || 50,
    priorityThreshold: settings.contentVolumeSettings?.priorityThreshold || 0.7,
    adaptiveVolumeEnabled: settings.contentVolumeSettings?.adaptiveVolumeEnabled || true,
    weekendReduction: settings.contentVolumeSettings?.weekendReduction || 0.5,
    contentTypeWeights: settings.contentVolumeSettings?.contentTypeWeights || {
      academic: 1.0,
      news: 0.8,
      blog: 0.6,
      social: 0.4
    },
    timeBasedPrioritization: settings.contentVolumeSettings?.timeBasedPrioritization || 'recent'
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSliderChange = (field, value) => {
    setVolumeSettings(prev => ({
      ...prev,
      [field]: parseFloat(value)
    }));
  };

  const handleCheckboxChange = (field) => {
    setVolumeSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSelectChange = (field, value) => {
    setVolumeSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleWeightChange = (contentType, value) => {
    setVolumeSettings(prev => ({
      ...prev,
      contentTypeWeights: {
        ...prev.contentTypeWeights,
        [contentType]: parseFloat(value)
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await configurationService.updateContentVolumeSettings(volumeSettings);
      onUpdate('contentVolumeSettings', volumeSettings);
      
      setMessage({ type: 'success', text: 'Content volume settings saved successfully!' });
    } catch (error) {
      console.error('Error saving content volume settings:', error);
      setMessage({ type: 'error', text: 'Failed to save content volume settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Content Volume Settings</SectionTitle>
      <Description>
        Control how much content you receive daily and how it's prioritized. 
        These settings help manage information overload while ensuring you don't miss important updates.
      </Description>

      <FormGroup>
        <Label>Daily Content Limit</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="10"
            max="200"
            value={volumeSettings.dailyLimit}
            onChange={(e) => handleSliderChange('dailyLimit', e.target.value)}
          />
          <SliderValue>{volumeSettings.dailyLimit} items per day</SliderValue>
          <SliderLabels>
            <span>10</span>
            <span>200</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Priority Threshold</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volumeSettings.priorityThreshold}
            onChange={(e) => handleSliderChange('priorityThreshold', e.target.value)}
          />
          <SliderValue>{Math.round(volumeSettings.priorityThreshold * 100)}% relevance required</SliderValue>
          <SliderLabels>
            <span>0%</span>
            <span>100%</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Weekend Content Reduction</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volumeSettings.weekendReduction}
            onChange={(e) => handleSliderChange('weekendReduction', e.target.value)}
          />
          <SliderValue>{Math.round((1 - volumeSettings.weekendReduction) * 100)}% of weekday volume</SliderValue>
          <SliderLabels>
            <span>0%</span>
            <span>100%</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={volumeSettings.adaptiveVolumeEnabled}
            onChange={() => handleCheckboxChange('adaptiveVolumeEnabled')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Adaptive Volume Control</CheckboxTitle>
            <CheckboxDescription>
              Automatically adjust content volume based on your reading patterns and engagement
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      <FormGroup>
        <Label>Time-based Prioritization</Label>
        <Select
          value={volumeSettings.timeBasedPrioritization}
          onChange={(e) => handleSelectChange('timeBasedPrioritization', e.target.value)}
        >
          <option value="recent">Prioritize Recent Content</option>
          <option value="trending">Prioritize Trending Content</option>
          <option value="balanced">Balanced Approach</option>
          <option value="evergreen">Include Evergreen Content</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <Label>Content Type Weights</Label>
        <Description style={{ fontSize: '14px', marginBottom: '16px' }}>
          Adjust the relative importance of different content types in your feed.
        </Description>
        
        {Object.entries(volumeSettings.contentTypeWeights).map(([type, weight]) => (
          <div key={type} style={{ marginBottom: '16px' }}>
            <Label style={{ fontSize: '14px', textTransform: 'capitalize', marginBottom: '4px' }}>
              {type} Content
            </Label>
            <SliderContainer>
              <Slider
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weight}
                onChange={(e) => handleWeightChange(type, e.target.value)}
              />
              <SliderValue style={{ fontSize: '14px' }}>
                Weight: {weight.toFixed(1)}
              </SliderValue>
            </SliderContainer>
          </div>
        ))}
      </FormGroup>

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

export default ContentVolumeSettings;