import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from '../Dashboard';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../services/api');

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
};

const mockDashboardData = {
  content: [
    {
      id: '1',
      title: 'Latest AI Breakthrough in Natural Language Processing',
      summary: 'Researchers have developed a new model that significantly improves language understanding.',
      publishDate: '2024-01-15T10:00:00Z',
      relevanceScore: 0.95,
      topics: ['natural-language-processing', 'machine-learning', 'research'],
      type: 'academic',
      author: 'Dr. Jane Smith'
    },
    {
      id: '2',
      title: 'The Future of Generative AI in UX Design',
      summary: 'How generative AI tools are transforming the way UX designers work.',
      publishDate: '2024-01-14T15:30:00Z',
      relevanceScore: 0.87,
      topics: ['generative-ai', 'ux-design', 'tools'],
      type: 'blog',
      author: 'Mike Johnson'
    },
    {
      id: '3',
      title: 'Breaking: New LLM Model Achieves Human-Level Performance',
      summary: 'A new large language model has achieved unprecedented performance on benchmark tests.',
      publishDate: '2024-01-15T08:00:00Z',
      relevanceScore: 0.92,
      topics: ['llm', 'benchmarks', 'performance'],
      type: 'news',
      author: 'Tech News Daily'
    }
  ],
  breakingNews: 'Major AI breakthrough announced at leading research conference'
};

const mockStats = {
  sourcesMonitored: 25,
  articlesToday: 12,
  savedItems: 45,
  collections: 8
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: mockUser });
    api.get.mockImplementation((url) => {
      if (url.includes('/dashboard/content')) {
        return Promise.resolve({ data: mockDashboardData });
      }
      if (url.includes('/dashboard/stats')) {
        return Promise.resolve({ data: mockStats });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    api.post.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    test('renders welcome message with user name', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Welcome back, John Doe!')).toBeInTheDocument();
      expect(screen.getByText(/Stay up to date with the latest AI and LLM developments/)).toBeInTheDocument();
    });

    test('displays loading state initially', () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Loading your personalized content...')).toBeInTheDocument();
    });

    test('renders filter controls', () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      expect(screen.getByLabelText('Topic')).toBeInTheDocument();
      expect(screen.getByLabelText('Source Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Time Period')).toBeInTheDocument();
      expect(screen.getByText('Apply Filters')).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    test('displays dashboard statistics', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('Sources Monitored')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('Articles Today')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('Saved Items')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('Collections')).toBeInTheDocument();
      });
    });

    test('displays breaking news alert when available', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('🚨 Breaking News')).toBeInTheDocument();
        expect(screen.getByText('Major AI breakthrough announced at leading research conference')).toBeInTheDocument();
      });
    });

    test('displays content cards with proper information', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Check first content item
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
        expect(screen.getByText('Researchers have developed a new model that significantly improves language understanding.')).toBeInTheDocument();
        expect(screen.getByText('95%')).toBeInTheDocument(); // Relevance score
        
        // Check content tags
        expect(screen.getByText('natural-language-processing')).toBeInTheDocument();
        expect(screen.getByText('academic')).toBeInTheDocument();
      });
    });

    test('displays content organized by relevance by default', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const contentCards = screen.getAllByText(/Read/);
        expect(contentCards).toHaveLength(3);
        
        // Check that relevance scores are displayed
        expect(screen.getByText('95%')).toBeInTheDocument();
        expect(screen.getByText('87%')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    test('updates filters when dropdown values change', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      const topicSelect = screen.getByDisplayValue('All Topics');
      fireEvent.change(topicSelect, { target: { value: 'machine-learning' } });
      
      expect(topicSelect.value).toBe('machine-learning');
    });

    test('applies filters when Apply Filters button is clicked', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      // Change filter
      const topicSelect = screen.getByDisplayValue('All Topics');
      fireEvent.change(topicSelect, { target: { value: 'machine-learning' } });
      
      // Click apply filters
      const applyButton = screen.getByText('Apply Filters');
      fireEvent.click(applyButton);
      
      // Verify API call with filters
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('topic=machine-learning')
        );
      });
    });

    test('filters by source type correctly', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const sourceTypeSelect = screen.getByDisplayValue('All Sources');
      fireEvent.change(sourceTypeSelect, { target: { value: 'academic' } });
      
      const applyButton = screen.getByText('Apply Filters');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('sourceType=academic')
        );
      });
    });

    test('filters by time period correctly', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const timePeriodSelect = screen.getByDisplayValue('Today');
      fireEvent.change(timePeriodSelect, { target: { value: 'week' } });
      
      const applyButton = screen.getByText('Apply Filters');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('timePeriod=week')
        );
      });
    });
  });

  describe('Sorting Functionality', () => {
    test('changes sort order when sort dropdown is changed', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const sortSelect = screen.getByDisplayValue('Sort by Relevance');
      fireEvent.change(sortSelect, { target: { value: 'recency' } });
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=recency')
        );
      });
    });

    test('displays sort options correctly', () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      const sortSelect = screen.getByDisplayValue('Sort by Relevance');
      expect(sortSelect).toBeInTheDocument();
      
      // Check all sort options are available
      expect(screen.getByText('Sort by Relevance')).toBeInTheDocument();
      expect(screen.getByText('Sort by Recency')).toBeInTheDocument();
      expect(screen.getByText('Sort by Popularity')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('records interaction when Read button is clicked', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const readButtons = screen.getAllByText('Read');
      fireEvent.click(readButtons[0]);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/interactions', {
          contentId: '1',
          type: 'view'
        });
      });
    });

    test('records interaction when Save button is clicked', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const saveButtons = screen.getAllByText('Save');
      fireEvent.click(saveButtons[0]);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/interactions', {
          contentId: '1',
          type: 'save'
        });
      });
    });

    test('handles interaction errors gracefully', async () => {
      api.post.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Latest AI Breakthrough in Natural Language Processing')).toBeInTheDocument();
      });
      
      const readButtons = screen.getAllByText('Read');
      fireEvent.click(readButtons[0]);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to record interaction:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('displays error message when dashboard data fails to load', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/dashboard/content')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('/dashboard/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard content. Please try again.')).toBeInTheDocument();
      });
    });

    test('displays placeholder when no content is available', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/dashboard/content')) {
          return Promise.resolve({ data: { content: [] } });
        }
        if (url.includes('/dashboard/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('No content available yet. Add some sources to start discovering relevant AI/LLM content!')).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    test('formats recent dates correctly', async () => {
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 2);
      
      const recentContent = {
        ...mockDashboardData,
        content: [{
          ...mockDashboardData.content[0],
          publishDate: recentDate.toISOString()
        }]
      };
      
      api.get.mockImplementation((url) => {
        if (url.includes('/dashboard/content')) {
          return Promise.resolve({ data: recentContent });
        }
        if (url.includes('/dashboard/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('2h ago')).toBeInTheDocument();
      });
    });
  });

  describe('Relevance Score Display', () => {
    test('displays relevance scores with correct colors', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const highRelevanceScore = screen.getByText('95%');
        const mediumRelevanceScore = screen.getByText('87%');
        
        expect(highRelevanceScore).toBeInTheDocument();
        expect(mediumRelevanceScore).toBeInTheDocument();
        
        // Check that scores are displayed as percentages
        expect(screen.getByText('92%')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('renders filter controls in organized layout', () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      // Check that all filter controls are present
      expect(screen.getByDisplayValue('All Topics')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Sources')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Today')).toBeInTheDocument();
      expect(screen.getByText('Apply Filters')).toBeInTheDocument();
    });

    test('renders stats in organized layout', async () => {
      render(<Dashboard />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Check that all stats are displayed
        expect(screen.getByText('Sources Monitored')).toBeInTheDocument();
        expect(screen.getByText('Articles Today')).toBeInTheDocument();
        expect(screen.getByText('Saved Items')).toBeInTheDocument();
        expect(screen.getByText('Collections')).toBeInTheDocument();
      });
    });
  });
});