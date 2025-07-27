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

const TimeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-top: 12px;
`;

const TimeSlot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
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

const PreviewContainer = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
`;

const PreviewTitle = styled.h4`
  color: #333;
  margin-bottom: 12px;
  font-size: 16px;
`;

const PreviewSchedule = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ScheduleItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  font-size: 14px;
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

const DigestScheduling = ({ settings, onUpdate }) => {
  const [digestSettings, setDigestSettings] = useState({
    enabled: settings.digestScheduling?.enabled || false,
    frequency: settings.digestScheduling?.frequency || 'daily',
    deliveryTime: settings.digestScheduling?.deliveryTime || '09:00',
    weeklyDay: settings.digestScheduling?.weeklyDay || 'monday',
    includeBreakingNews: settings.digestScheduling?.includeBreakingNews || true,
    includeTopStories: settings.digestScheduling?.includeTopStories || true,
    includePersonalized: settings.digestScheduling?.includePersonalized || true,
    includeTrending: settings.digestScheduling?.includeTrending || false,
    maxItems: settings.digestScheduling?.maxItems || 10,
    contentTypes: settings.digestScheduling?.contentTypes || {
      academic: true,
      news: true,
      blog: true,
      social: false
    },
    timezone: settings.digestScheduling?.timezone || 'UTC'
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleCheckboxChange = (field) => {
    setDigestSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSelectChange = (field, value) => {
    setDigestSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSliderChange = (field, value) => {
    setDigestSettings(prev => ({
      ...prev,
      [field]: parseInt(value)
    }));
  };

  const handleContentTypeChange = (contentType) => {
    setDigestSettings(prev => ({
      ...prev,
      contentTypes: {
        ...prev.contentTypes,
        [contentType]: !prev.contentTypes[contentType]
      }
    }));
  };

  const getSchedulePreview = () => {
    if (!digestSettings.enabled) return [];

    const schedules = [];
    
    if (digestSettings.frequency === 'daily') {
      schedules.push({
        type: 'Daily Digest',
        time: `Every day at ${digestSettings.deliveryTime}`,
        items: `Up to ${digestSettings.maxItems} items`
      });
    } else if (digestSettings.frequency === 'weekly') {
      const dayName = digestSettings.weeklyDay.charAt(0).toUpperCase() + digestSettings.weeklyDay.slice(1);
      schedules.push({
        type: 'Weekly Digest',
        time: `Every ${dayName} at ${digestSettings.deliveryTime}`,
        items: `Up to ${digestSettings.maxItems * 7} items`
      });
    } else if (digestSettings.frequency === 'twice-weekly') {
      schedules.push({
        type: 'Bi-weekly Digest',
        time: `Monday and Thursday at ${digestSettings.deliveryTime}`,
        items: `Up to ${Math.round(digestSettings.maxItems * 3.5)} items each`
      });
    }

    return schedules;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await configurationService.updateDigestScheduling(digestSettings);
      onUpdate('digestScheduling', digestSettings);
      
      setMessage({ type: 'success', text: 'Digest scheduling saved successfully!' });
    } catch (error) {
      console.error('Error saving digest scheduling:', error);
      setMessage({ type: 'error', text: 'Failed to save digest scheduling. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Digest Scheduling</SectionTitle>
      <Description>
        Configure when and how you receive curated digests of the most important content. 
        Digests help you stay informed without being overwhelmed by individual notifications.
      </Description>

      <FormGroup>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={digestSettings.enabled}
            onChange={() => handleCheckboxChange('enabled')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Enable Digest Delivery</CheckboxTitle>
            <CheckboxDescription>
              Receive scheduled digests of curated content
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      {digestSettings.enabled && (
        <>
          <FormGroup>
            <Label>Digest Frequency</Label>
            <Select
              value={digestSettings.frequency}
              onChange={(e) => handleSelectChange('frequency', e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="twice-weekly">Twice Weekly</option>
              <option value="weekly">Weekly</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Delivery Time</Label>
            <Select
              value={digestSettings.deliveryTime}
              onChange={(e) => handleSelectChange('deliveryTime', e.target.value)}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i.toString().padStart(2, '0');
                const time12 = i === 0 ? '12:00 AM' : 
                              i < 12 ? `${i}:00 AM` : 
                              i === 12 ? '12:00 PM' : 
                              `${i - 12}:00 PM`;
                return (
                  <option key={hour} value={`${hour}:00`}>
                    {time12}
                  </option>
                );
              })}
            </Select>
          </FormGroup>

          {digestSettings.frequency === 'weekly' && (
            <FormGroup>
              <Label>Weekly Delivery Day</Label>
              <Select
                value={digestSettings.weeklyDay}
                onChange={(e) => handleSelectChange('weeklyDay', e.target.value)}
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </Select>
            </FormGroup>
          )}

          <FormGroup>
            <Label>Maximum Items per Digest</Label>
            <SliderContainer>
              <Slider
                type="range"
                min="5"
                max="50"
                step="5"
                value={digestSettings.maxItems}
                onChange={(e) => handleSliderChange('maxItems', e.target.value)}
              />
              <SliderValue>{digestSettings.maxItems} items</SliderValue>
            </SliderContainer>
          </FormGroup>

          <FormGroup>
            <Label>Digest Content</Label>
            <CheckboxItem>
              <Checkbox
                type="checkbox"
                checked={digestSettings.includeBreakingNews}
                onChange={() => handleCheckboxChange('includeBreakingNews')}
              />
              <CheckboxLabel>
                <CheckboxTitle>Breaking News</CheckboxTitle>
                <CheckboxDescription>
                  Include high-priority and urgent updates
                </CheckboxDescription>
              </CheckboxLabel>
            </CheckboxItem>

            <CheckboxItem>
              <Checkbox
                type="checkbox"
                checked={digestSettings.includeTopStories}
                onChange={() => handleCheckboxChange('includeTopStories')}
              />
              <CheckboxLabel>
                <CheckboxTitle>Top Stories</CheckboxTitle>
                <CheckboxDescription>
                  Include the most important stories of the period
                </CheckboxDescription>
              </CheckboxLabel>
            </CheckboxItem>

            <CheckboxItem>
              <Checkbox
                type="checkbox"
                checked={digestSettings.includePersonalized}
                onChange={() => handleCheckboxChange('includePersonalized')}
              />
              <CheckboxLabel>
                <CheckboxTitle>Personalized Content</CheckboxTitle>
                <CheckboxDescription>
                  Include content tailored to your interests
                </CheckboxDescription>
              </CheckboxLabel>
            </CheckboxItem>

            <CheckboxItem>
              <Checkbox
                type="checkbox"
                checked={digestSettings.includeTrending}
                onChange={() => handleCheckboxChange('includeTrending')}
              />
              <CheckboxLabel>
                <CheckboxTitle>Trending Topics</CheckboxTitle>
                <CheckboxDescription>
                  Include content about trending topics in your field
                </CheckboxDescription>
              </CheckboxLabel>
            </CheckboxItem>
          </FormGroup>

          <FormGroup>
            <Label>Content Types to Include</Label>
            <TimeGrid>
              {Object.entries(digestSettings.contentTypes).map(([type, enabled]) => (
                <TimeSlot key={type}>
                  <Checkbox
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleContentTypeChange(type)}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{type}</span>
                </TimeSlot>
              ))}
            </TimeGrid>
          </FormGroup>

          <PreviewContainer>
            <PreviewTitle>Delivery Schedule Preview</PreviewTitle>
            <PreviewSchedule>
              {getSchedulePreview().map((schedule, index) => (
                <ScheduleItem key={index}>
                  <div>
                    <strong>{schedule.type}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{schedule.time}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {schedule.items}
                  </div>
                </ScheduleItem>
              ))}
              {getSchedulePreview().length === 0 && (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                  No digests scheduled
                </div>
              )}
            </PreviewSchedule>
          </PreviewContainer>
        </>
      )}

      <SaveButton onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Schedule'}
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

export default DigestScheduling;