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

const PreviewText = styled.p`
  color: #666;
  line-height: 1.5;
  margin: 0;
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

const SummaryPreferences = ({ settings, onUpdate }) => {
  const [summarySettings, setSummarySettings] = useState({
    defaultLength: settings.summaryPreferences?.defaultLength || 'medium',
    detailLevel: settings.summaryPreferences?.detailLevel || 0.7,
    includeKeyInsights: settings.summaryPreferences?.includeKeyInsights || true,
    includeMethodology: settings.summaryPreferences?.includeMethodology || true,
    includeConclusions: settings.summaryPreferences?.includeConclusions || true,
    includeVisualDescriptions: settings.summaryPreferences?.includeVisualDescriptions || false,
    technicalLanguage: settings.summaryPreferences?.technicalLanguage || 'balanced',
    citationStyle: settings.summaryPreferences?.citationStyle || 'apa',
    enablePersonalization: settings.summaryPreferences?.enablePersonalization || true,
    contentTypeSpecific: settings.summaryPreferences?.contentTypeSpecific || {
      academic: 'detailed',
      news: 'brief',
      blog: 'medium',
      social: 'brief'
    }
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSelectChange = (field, value) => {
    setSummarySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSliderChange = (field, value) => {
    setSummarySettings(prev => ({
      ...prev,
      [field]: parseFloat(value)
    }));
  };

  const handleCheckboxChange = (field) => {
    setSummarySettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleContentTypeChange = (contentType, value) => {
    setSummarySettings(prev => ({
      ...prev,
      contentTypeSpecific: {
        ...prev.contentTypeSpecific,
        [contentType]: value
      }
    }));
  };

  const getLengthDescription = (length) => {
    switch (length) {
      case 'brief': return '1-2 sentences, key points only';
      case 'medium': return '1-2 paragraphs, main ideas and context';
      case 'detailed': return '3-4 paragraphs, comprehensive overview';
      case 'comprehensive': return 'Full analysis with all details';
      default: return '';
    }
  };

  const getPreviewText = () => {
    const { defaultLength, detailLevel } = summarySettings;
    
    if (defaultLength === 'brief') {
      return "This research introduces a novel transformer architecture that achieves 15% better performance on language understanding tasks.";
    } else if (defaultLength === 'medium') {
      return "This research introduces a novel transformer architecture that achieves 15% better performance on language understanding tasks. The authors propose a new attention mechanism that reduces computational complexity while maintaining accuracy. The model was tested on multiple benchmarks including GLUE and SuperGLUE, showing consistent improvements across different task types.";
    } else if (defaultLength === 'detailed') {
      return "This research introduces a novel transformer architecture that achieves 15% better performance on language understanding tasks. The authors propose a new attention mechanism called 'Sparse Attention' that reduces computational complexity from O(n²) to O(n log n) while maintaining accuracy. The methodology involves training on a diverse dataset of 100B tokens with careful hyperparameter tuning. The model was tested on multiple benchmarks including GLUE and SuperGLUE, showing consistent improvements across different task types. Key insights include the importance of attention sparsity patterns and the role of positional encodings in long sequences.";
    } else {
      return "This comprehensive research paper introduces a novel transformer architecture that achieves 15% better performance on language understanding tasks compared to existing state-of-the-art models. The authors propose a new attention mechanism called 'Sparse Attention' that reduces computational complexity from O(n²) to O(n log n) while maintaining or improving accuracy across various tasks. The methodology involves extensive experimentation with training on a diverse dataset of 100B tokens, careful hyperparameter tuning using Bayesian optimization, and novel regularization techniques. The model architecture incorporates several innovations including adaptive attention heads, dynamic positional encodings, and layer-wise learning rate adaptation. Comprehensive evaluation was conducted on multiple benchmarks including GLUE, SuperGLUE, and domain-specific tasks, showing consistent improvements across different task types and domains. Key insights include the critical importance of attention sparsity patterns for efficiency, the role of positional encodings in handling long sequences, and the effectiveness of adaptive mechanisms in transformer architectures.";
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await configurationService.updateSummaryPreferences(summarySettings);
      onUpdate('summaryPreferences', summarySettings);
      
      setMessage({ type: 'success', text: 'Summary preferences saved successfully!' });
    } catch (error) {
      console.error('Error saving summary preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save summary preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <SectionTitle>Summary Preferences</SectionTitle>
      <Description>
        Customize how content is summarized to match your reading preferences and information needs.
      </Description>

      <FormGroup>
        <Label>Default Summary Length</Label>
        <Select
          value={summarySettings.defaultLength}
          onChange={(e) => handleSelectChange('defaultLength', e.target.value)}
        >
          <option value="brief">Brief</option>
          <option value="medium">Medium</option>
          <option value="detailed">Detailed</option>
          <option value="comprehensive">Comprehensive</option>
        </Select>
        <Description style={{ fontSize: '14px', marginTop: '8px', marginBottom: '0' }}>
          {getLengthDescription(summarySettings.defaultLength)}
        </Description>
      </FormGroup>

      <FormGroup>
        <Label>Detail Level</Label>
        <SliderContainer>
          <Slider
            type="range"
            min="0.3"
            max="1"
            step="0.1"
            value={summarySettings.detailLevel}
            onChange={(e) => handleSliderChange('detailLevel', e.target.value)}
          />
          <SliderValue>
            {summarySettings.detailLevel < 0.5 ? 'High-level' : 
             summarySettings.detailLevel < 0.8 ? 'Balanced' : 'Technical'} 
            ({Math.round(summarySettings.detailLevel * 100)}%)
          </SliderValue>
          <SliderLabels>
            <span>High-level</span>
            <span>Technical</span>
          </SliderLabels>
        </SliderContainer>
      </FormGroup>

      <FormGroup>
        <Label>Technical Language Level</Label>
        <Select
          value={summarySettings.technicalLanguage}
          onChange={(e) => handleSelectChange('technicalLanguage', e.target.value)}
        >
          <option value="simplified">Simplified (General audience)</option>
          <option value="balanced">Balanced (Some technical terms)</option>
          <option value="technical">Technical (Domain experts)</option>
          <option value="academic">Academic (Research-level)</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <Label>Summary Components</Label>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={summarySettings.includeKeyInsights}
            onChange={() => handleCheckboxChange('includeKeyInsights')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Key Insights</CheckboxTitle>
            <CheckboxDescription>
              Include the most important takeaways and findings
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={summarySettings.includeMethodology}
            onChange={() => handleCheckboxChange('includeMethodology')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Methodology</CheckboxTitle>
            <CheckboxDescription>
              Include information about research methods and approaches
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={summarySettings.includeConclusions}
            onChange={() => handleCheckboxChange('includeConclusions')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Conclusions</CheckboxTitle>
            <CheckboxDescription>
              Include conclusions and implications
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>

        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={summarySettings.includeVisualDescriptions}
            onChange={() => handleCheckboxChange('includeVisualDescriptions')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Visual Descriptions</CheckboxTitle>
            <CheckboxDescription>
              Include descriptions of charts, graphs, and images
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      <FormGroup>
        <Label>Content-Type Specific Settings</Label>
        {Object.entries(summarySettings.contentTypeSpecific).map(([type, length]) => (
          <div key={type} style={{ marginBottom: '12px' }}>
            <Label style={{ fontSize: '14px', textTransform: 'capitalize', marginBottom: '4px' }}>
              {type} Content
            </Label>
            <Select
              value={length}
              onChange={(e) => handleContentTypeChange(type, e.target.value)}
              style={{ fontSize: '14px' }}
            >
              <option value="brief">Brief</option>
              <option value="medium">Medium</option>
              <option value="detailed">Detailed</option>
            </Select>
          </div>
        ))}
      </FormGroup>

      <FormGroup>
        <Label>Citation Style</Label>
        <Select
          value={summarySettings.citationStyle}
          onChange={(e) => handleSelectChange('citationStyle', e.target.value)}
        >
          <option value="apa">APA</option>
          <option value="mla">MLA</option>
          <option value="chicago">Chicago</option>
          <option value="ieee">IEEE</option>
        </Select>
      </FormGroup>

      <FormGroup>
        <CheckboxItem>
          <Checkbox
            type="checkbox"
            checked={summarySettings.enablePersonalization}
            onChange={() => handleCheckboxChange('enablePersonalization')}
          />
          <CheckboxLabel>
            <CheckboxTitle>Enable Personalization</CheckboxTitle>
            <CheckboxDescription>
              Adapt summaries based on your interests and reading history
            </CheckboxDescription>
          </CheckboxLabel>
        </CheckboxItem>
      </FormGroup>

      <PreviewContainer>
        <PreviewTitle>Summary Preview</PreviewTitle>
        <PreviewText>{getPreviewText()}</PreviewText>
      </PreviewContainer>

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

export default SummaryPreferences;