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
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
`;

const TopicList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
`;

const TopicTag = styled.div`
  background-color: ${props => props.selected ? '#007bff' : '#f8f9fa'};
  color: ${props => props.selected ? 'white' : '#333'};
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid ${props => props.selected ? '#007bff' : '#e0e0e0'};
  transition: all 0.2s;
  font-size: 14px;

  &:hover {
    background-color: ${props => props.selected ? '#0056b3' : '#e9ecef'};
  }
`;

const CustomTopicInput = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
`;

const Input = styled.input`
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Button = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;



const SaveButton = styled(Button)`
  background-color: #28a745;
  margin-top: 24px;

  &:hover {
    background-color: #218838;
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

const predefinedTopics = [
  'Machine Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Deep Learning',
  'AI Ethics',
  'Large Language Models',
  'Generative AI',
  'AI Safety',
  'Robotics',
  'Neural Networks',
  'AI Research',
  'AI Applications',
  'AI Tools',
  'AI Industry News'
];

const TopicPreferences = ({ settings, onUpdate }) => {
  const [selectedTopics, setSelectedTopics] = useState(
    settings.topicPreferences?.topics || []
  );
  const [customTopic, setCustomTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const addCustomTopic = () => {
    if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
      setSelectedTopics(prev => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  };

  const removeCustomTopic = (topic) => {
    if (!predefinedTopics.includes(topic)) {
      setSelectedTopics(prev => prev.filter(t => t !== topic));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const updatedPreferences = {
        ...settings.topicPreferences,
        topics: selectedTopics
      };

      await configurationService.updateTopicPreferences(updatedPreferences);
      onUpdate('topicPreferences', updatedPreferences);
      
      setMessage({ type: 'success', text: 'Topic preferences saved successfully!' });
    } catch (error) {
      console.error('Error saving topic preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save topic preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Topic Preferences</SectionTitle>
      <Description>
        Select the topics you're most interested in. The system will prioritize content 
        related to these topics in your dashboard and recommendations.
      </Description>

      <FormGroup>
        <Label>Select Topics of Interest</Label>
        <TopicList>
          {predefinedTopics.map(topic => (
            <TopicTag
              key={topic}
              selected={selectedTopics.includes(topic)}
              onClick={() => toggleTopic(topic)}
            >
              {topic}
            </TopicTag>
          ))}
        </TopicList>

        {selectedTopics.filter(topic => !predefinedTopics.includes(topic)).length > 0 && (
          <>
            <Label>Custom Topics</Label>
            <TopicList>
              {selectedTopics
                .filter(topic => !predefinedTopics.includes(topic))
                .map(topic => (
                  <TopicTag
                    key={topic}
                    selected={true}
                    onClick={() => removeCustomTopic(topic)}
                    title="Click to remove"
                  >
                    {topic} ×
                  </TopicTag>
                ))}
            </TopicList>
          </>
        )}

        <CustomTopicInput>
          <Input
            type="text"
            placeholder="Add custom topic..."
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomTopic()}
          />
          <Button onClick={addCustomTopic} disabled={!customTopic.trim()}>
            Add Topic
          </Button>
        </CustomTopicInput>
      </FormGroup>

      <SaveButton onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Preferences'}
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

export default TopicPreferences;