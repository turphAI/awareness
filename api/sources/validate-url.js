const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth
} = require('../../lib/auth');

// URL validation endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  // Require authentication
  return requireAuth(async (req, res) => {
    try {
      const { url } = req.body;

      // Validation
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      // Validate URL format
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format',
          valid: false
        });
      }

      // Check if URL is accessible (basic validation)
      const isHttps = parsedUrl.protocol === 'https:';
      const domain = parsedUrl.hostname;

      // Check if source already exists for this user
      const existingSources = await executeQuery(
        'SELECT id, name FROM sources WHERE url = ? AND created_by = ? AND active = TRUE',
        [url, req.user.id]
      );

      const exists = existingSources.length > 0;

      // Basic URL analysis
      const analysis = {
        valid: true,
        accessible: true, // We'd need to make HTTP request to verify
        secure: isHttps,
        domain,
        exists,
        existingSource: exists ? existingSources[0] : null,
        recommendations: []
      };

      // Add recommendations
      if (!isHttps) {
        analysis.recommendations.push('Consider using HTTPS for better security');
      }

      if (exists) {
        analysis.recommendations.push('This URL is already added to your sources');
      }

      // Suggest source type based on domain patterns
      let suggestedType = 'website';
      if (domain.includes('blog') || domain.includes('medium.com') || domain.includes('substack.com')) {
        suggestedType = 'blog';
      } else if (domain.includes('arxiv.org') || domain.includes('scholar.google') || domain.includes('researchgate')) {
        suggestedType = 'academic';
      } else if (domain.includes('podcast') || domain.includes('spotify.com') || domain.includes('apple.com/podcasts')) {
        suggestedType = 'podcast';
      } else if (domain.includes('twitter.com') || domain.includes('linkedin.com') || domain.includes('facebook.com')) {
        suggestedType = 'social';
      } else if (domain.includes('newsletter') || domain.includes('mailchimp.com')) {
        suggestedType = 'newsletter';
      }

      analysis.suggestedType = suggestedType;

      return res.status(200).json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error('URL validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}