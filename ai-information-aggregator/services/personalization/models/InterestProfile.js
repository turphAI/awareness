const mongoose = require('mongoose');

const topicInterestSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  interactionCount: {
    type: Number,
    default: 0
  }
});

const categoryInterestSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  interactionCount: {
    type: Number,
    default: 0
  }
});

const sourceTypeInterestSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    required: true,
    enum: ['website', 'blog', 'academic', 'podcast', 'social']
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  interactionCount: {
    type: Number,
    default: 0
  }
});

const interestProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  topics: [topicInterestSchema],
  categories: [categoryInterestSchema],
  sourceTypes: [sourceTypeInterestSchema],
  explicitPreferences: {
    topics: [String],
    categories: [String],
    sourceTypes: [String]
  },
  adaptiveWeights: {
    explicitWeight: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1
    },
    implicitWeight: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1
    }
  },
  learningRate: {
    type: Number,
    default: 0.1,
    min: 0.01,
    max: 0.5
  },
  decayRate: {
    type: Number,
    default: 0.95,
    min: 0.8,
    max: 0.99
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

// Update the updated timestamp on save
interestProfileSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Methods for interest profile management
interestProfileSchema.methods.updateTopicInterest = function(topic, interactionType, strength = 1) {
  const existingTopic = this.topics.find(t => t.topic === topic);
  
  if (existingTopic) {
    // Update existing topic interest
    const adjustment = this.learningRate * strength * (interactionType === 'positive' ? 1 : -1);
    existingTopic.weight = Math.max(0, Math.min(1, existingTopic.weight + adjustment));
    existingTopic.interactionCount += 1;
    existingTopic.lastUpdated = new Date();
  } else {
    // Add new topic interest
    const initialWeight = interactionType === 'positive' ? 0.6 : 0.4;
    this.topics.push({
      topic,
      weight: initialWeight,
      interactionCount: 1,
      lastUpdated: new Date()
    });
  }
};

interestProfileSchema.methods.updateCategoryInterest = function(category, interactionType, strength = 1) {
  const existingCategory = this.categories.find(c => c.category === category);
  
  if (existingCategory) {
    const adjustment = this.learningRate * strength * (interactionType === 'positive' ? 1 : -1);
    existingCategory.weight = Math.max(0, Math.min(1, existingCategory.weight + adjustment));
    existingCategory.interactionCount += 1;
    existingCategory.lastUpdated = new Date();
  } else {
    const initialWeight = interactionType === 'positive' ? 0.6 : 0.4;
    this.categories.push({
      category,
      weight: initialWeight,
      interactionCount: 1,
      lastUpdated: new Date()
    });
  }
};

interestProfileSchema.methods.updateSourceTypeInterest = function(sourceType, interactionType, strength = 1) {
  const existingSourceType = this.sourceTypes.find(st => st.sourceType === sourceType);
  
  if (existingSourceType) {
    const adjustment = this.learningRate * strength * (interactionType === 'positive' ? 1 : -1);
    existingSourceType.weight = Math.max(0, Math.min(1, existingSourceType.weight + adjustment));
    existingSourceType.interactionCount += 1;
    existingSourceType.lastUpdated = new Date();
  } else {
    const initialWeight = interactionType === 'positive' ? 0.6 : 0.4;
    this.sourceTypes.push({
      sourceType,
      weight: initialWeight,
      interactionCount: 1,
      lastUpdated: new Date()
    });
  }
};

interestProfileSchema.methods.applyDecay = function() {
  // Apply time-based decay to all interests
  const now = new Date();
  const daysSinceUpdate = (interest) => {
    return (now - interest.lastUpdated) / (1000 * 60 * 60 * 24);
  };

  this.topics.forEach(topic => {
    const days = daysSinceUpdate(topic);
    if (days > 7) { // Apply decay after a week
      topic.weight *= Math.pow(this.decayRate, Math.floor(days / 7));
      topic.weight = Math.max(0.1, topic.weight); // Minimum weight
    }
  });

  this.categories.forEach(category => {
    const days = daysSinceUpdate(category);
    if (days > 7) {
      category.weight *= Math.pow(this.decayRate, Math.floor(days / 7));
      category.weight = Math.max(0.1, category.weight);
    }
  });

  this.sourceTypes.forEach(sourceType => {
    const days = daysSinceUpdate(sourceType);
    if (days > 7) {
      sourceType.weight *= Math.pow(this.decayRate, Math.floor(days / 7));
      sourceType.weight = Math.max(0.1, sourceType.weight);
    }
  });
};

interestProfileSchema.methods.getTopInterests = function(type = 'topics', limit = 10) {
  const interests = this[type] || [];
  return interests
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(interest => ({
      name: interest.topic || interest.category || interest.sourceType,
      weight: interest.weight,
      interactionCount: interest.interactionCount
    }));
};

module.exports = mongoose.model('InterestProfile', interestProfileSchema);