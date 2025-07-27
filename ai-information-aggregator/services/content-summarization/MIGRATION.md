# Migration Guide: OpenAI to Anthropic Claude

## Overview
The current implementation uses OpenAI GPT-3.5-turbo for AI-based text summarization. For production deployment, this needs to be migrated to Anthropic Claude API.

## Required Changes

### 1. Dependencies
Replace OpenAI dependency with Anthropic:
```bash
npm uninstall openai
npm install @anthropic-ai/sdk
```

### 2. Environment Variables
Update environment configuration:
- Remove: `OPENAI_API_KEY`
- Add: `ANTHROPIC_API_KEY`

### 3. Code Changes in `textSummarizer.js`

#### Import Statement
```javascript
// Replace
const { OpenAI } = require('openai');

// With
const Anthropic = require('@anthropic-ai/sdk');
```

#### Constructor
```javascript
// Replace
this.openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// With
this.anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

#### API Call
```javascript
// Replace OpenAI call
const response = await this.openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content: 'You are an expert at creating concise, accurate summaries...'
    },
    {
      role: 'user',
      content: prompt
    }
  ],
  max_tokens: options.maxTokens,
  temperature: options.temperature,
  // ... other options
});

// With Anthropic call
const response = await this.anthropic.messages.create({
  model: 'claude-3-sonnet-20240229', // or claude-3-haiku-20240307 for faster/cheaper
  max_tokens: options.maxTokens,
  temperature: options.temperature,
  messages: [
    {
      role: 'user',
      content: `You are an expert at creating concise, accurate summaries of technical content, particularly in AI/ML and technology domains.\n\n${prompt}`
    }
  ]
});
```

#### Response Parsing
```javascript
// Replace
return response.choices[0]?.message?.content?.trim();

// With
return response.content[0]?.text?.trim();
```

### 4. Model Selection
Recommended Claude models:
- **claude-3-sonnet-20240229**: Balanced performance and cost
- **claude-3-haiku-20240307**: Faster and more cost-effective
- **claude-3-opus-20240229**: Highest quality (most expensive)

### 5. Testing Updates
Update test mocks in `textSummarizer.test.js`:
```javascript
// Replace OpenAI mock
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

// With Anthropic mock
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }));
});
```

### 6. Configuration Updates
Update health check and configuration logic to reference Anthropic instead of OpenAI.

## Benefits of Migration
- **Better Performance**: Claude models often provide higher quality summaries
- **Cost Efficiency**: Potentially lower costs depending on usage patterns
- **Rate Limits**: Different rate limiting structure
- **Context Length**: Claude models support longer context windows

## Testing Strategy
1. Run existing test suite with mocked Anthropic responses
2. Perform integration testing with actual Anthropic API
3. Compare summary quality between OpenAI and Claude outputs
4. Validate all configuration options work correctly

## Rollback Plan
All TODO comments in the code mark the exact locations that need to be reverted if rollback is needed. The current OpenAI implementation remains functional until migration is complete.