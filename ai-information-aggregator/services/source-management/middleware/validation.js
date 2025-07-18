const Joi = require('joi');

// Validate source data
exports.validateSource = (req, res, next) => {
  const schema = Joi.object({
    url: Joi.string().uri().required(),
    name: Joi.string().required(),
    type: Joi.string().valid('website', 'blog', 'academic', 'podcast', 'social').required(),
    categories: Joi.array().items(Joi.string()),
    relevanceScore: Joi.number().min(0).max(1),
    checkFrequency: Joi.string(),
    requiresAuthentication: Joi.boolean(),
    credentials: Joi.object({
      encrypted: Joi.string().allow(null)
    }),
    discoveredFrom: Joi.string().allow(null),
    active: Joi.boolean()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  next();
};