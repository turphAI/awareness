// Sources management endpoint for Vercel deployment
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // TODO: Add authentication middleware
    // const user = await authenticate(req);
    // if (!user) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    if (req.method === 'GET') {
      // Return mock sources for now
      const mockSources = [
        {
          id: 1,
          name: 'OpenAI Blog',
          url: 'https://openai.com/blog',
          category: 'AI Research',
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Anthropic News',
          url: 'https://www.anthropic.com/news',
          category: 'AI Research',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];

      return res.status(200).json({
        success: true,
        data: mockSources
      });
    }

    if (req.method === 'POST') {
      const { name, url, category } = req.body;

      // Basic validation
      if (!name || !url) {
        return res.status(400).json({
          success: false,
          error: 'Name and URL are required'
        });
      }

      // TODO: Save to database
      const newSource = {
        id: Date.now(), // Mock ID
        name,
        url,
        category: category || 'General',
        is_active: true,
        created_at: new Date().toISOString()
      };

      return res.status(201).json({
        success: true,
        data: newSource,
        message: 'Source created successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Sources API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}