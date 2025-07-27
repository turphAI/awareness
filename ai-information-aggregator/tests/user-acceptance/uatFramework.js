const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * User Acceptance Testing Framework
 * Provides tools for conducting and managing UAT sessions
 */

class UATFramework {
  constructor() {
    this.sessions = new Map();
    this.testScenarios = this.loadTestScenarios();
    this.resultsDir = path.join(__dirname, 'results');
    this.feedbackDir = path.join(__dirname, 'feedback');
    
    // Ensure directories exist
    [this.resultsDir, this.feedbackDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadTestScenarios() {
    return [
      {
        id: 'onboarding',
        name: 'New User Onboarding',
        description: 'Complete user registration and initial setup',
        estimatedTime: 5,
        priority: 'high',
        tasks: [
          {
            id: 'register',
            description: 'Register a new account',
            expectedTime: 2,
            successCriteria: 'Account created successfully'
          },
          {
            id: 'verify-email',
            description: 'Verify email address (if required)',
            expectedTime: 1,
            successCriteria: 'Email verified'
          },
          {
            id: 'initial-setup',
            description: 'Complete initial preferences setup',
            expectedTime: 2,
            successCriteria: 'Preferences saved and dashboard accessible'
          }
        ]
      },
      {
        id: 'source-management',
        name: 'Source Management',
        description: 'Add, edit, and manage information sources',
        estimatedTime: 8,
        priority: 'high',
        tasks: [
          {
            id: 'add-source',
            description: 'Add a new information source',
            expectedTime: 2,
            successCriteria: 'Source added and appears in list'
          },
          {
            id: 'categorize-source',
            description: 'Categorize the added source',
            expectedTime: 1,
            successCriteria: 'Source properly categorized'
          },
          {
            id: 'edit-source',
            description: 'Edit source details',
            expectedTime: 2,
            successCriteria: 'Changes saved successfully'
          },
          {
            id: 'remove-source',
            description: 'Remove a source',
            expectedTime: 1,
            successCriteria: 'Source removed from list'
          }
        ]
      },
      {
        id: 'content-consumption',
        name: 'Content Discovery and Consumption',
        description: 'Browse, read, and interact with content',
        estimatedTime: 10,
        priority: 'critical',
        tasks: [
          {
            id: 'browse-dashboard',
            description: 'Browse personalized dashboard',
            expectedTime: 3,
            successCriteria: 'Relevant content displayed'
          },
          {
            id: 'read-summary',
            description: 'Read content summaries',
            expectedTime: 2,
            successCriteria: 'Summaries are clear and helpful'
          },
          {
            id: 'view-full-content',
            description: 'View full content details',
            expectedTime: 3,
            successCriteria: 'Full content loads correctly'
          },
          {
            id: 'save-content',
            description: 'Save content to library',
            expectedTime: 1,
            successCriteria: 'Content saved successfully'
          },
          {
            id: 'rate-content',
            description: 'Rate content relevance',
            expectedTime: 1,
            successCriteria: 'Rating submitted'
          }
        ]
      },
      {
        id: 'search-library',
        name: 'Search and Library Management',
        description: 'Search content and manage personal library',
        estimatedTime: 8,
        priority: 'high',
        tasks: [
          {
            id: 'search-content',
            description: 'Search for specific content',
            expectedTime: 2,
            successCriteria: 'Relevant results returned'
          },
          {
            id: 'apply-filters',
            description: 'Apply search filters',
            expectedTime: 2,
            successCriteria: 'Filters work correctly'
          },
          {
            id: 'create-collection',
            description: 'Create a new collection',
            expectedTime: 2,
            successCriteria: 'Collection created'
          },
          {
            id: 'organize-content',
            description: 'Add content to collection',
            expectedTime: 2,
            successCriteria: 'Content organized in collection'
          }
        ]
      },
      {
        id: 'personalization',
        name: 'Personalization and Settings',
        description: 'Configure user preferences and personalization',
        estimatedTime: 6,
        priority: 'medium',
        tasks: [
          {
            id: 'update-interests',
            description: 'Update topic interests',
            expectedTime: 2,
            successCriteria: 'Interests updated'
          },
          {
            id: 'configure-notifications',
            description: 'Configure notification settings',
            expectedTime: 2,
            successCriteria: 'Notification preferences saved'
          },
          {
            id: 'adjust-content-volume',
            description: 'Adjust daily content volume',
            expectedTime: 1,
            successCriteria: 'Volume settings applied'
          },
          {
            id: 'set-digest-frequency',
            description: 'Set digest email frequency',
            expectedTime: 1,
            successCriteria: 'Digest frequency configured'
          }
        ]
      }
    ];
  }

  createUATSession(participantInfo) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      participant: participantInfo,
      startTime: new Date(),
      endTime: null,
      scenarios: [],
      feedback: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalTime: 0,
        averageTaskTime: 0
      },
      status: 'active'
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  startScenario(sessionId, scenarioId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const scenario = this.testScenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const scenarioExecution = {
      ...scenario,
      startTime: new Date(),
      endTime: null,
      tasks: scenario.tasks.map(task => ({
        ...task,
        status: 'pending',
        startTime: null,
        endTime: null,
        actualTime: 0,
        issues: [],
        userFeedback: null
      })),
      status: 'in-progress'
    };

    session.scenarios.push(scenarioExecution);
    this.sessions.set(sessionId, session);

    return scenarioExecution;
  }

  startTask(sessionId, scenarioId, taskId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const scenario = session.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const task = scenario.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    task.status = 'in-progress';
    task.startTime = new Date();

    this.sessions.set(sessionId, session);
    return task;
  }

  completeTask(sessionId, scenarioId, taskId, result) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const scenario = session.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const task = scenario.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    task.endTime = new Date();
    task.actualTime = (task.endTime - task.startTime) / 1000; // in seconds
    task.status = result.success ? 'completed' : 'failed';
    task.issues = result.issues || [];
    task.userFeedback = result.feedback || null;

    // Update session metrics
    session.metrics.totalTasks++;
    if (result.success) {
      session.metrics.completedTasks++;
    } else {
      session.metrics.failedTasks++;
    }

    this.sessions.set(sessionId, session);
    return task;
  }

  completeScenario(sessionId, scenarioId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const scenario = session.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    scenario.endTime = new Date();
    scenario.actualTime = (scenario.endTime - scenario.startTime) / 1000;
    
    const completedTasks = scenario.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = scenario.tasks.length;
    
    scenario.status = completedTasks === totalTasks ? 'completed' : 'partial';
    scenario.completionRate = (completedTasks / totalTasks) * 100;

    this.sessions.set(sessionId, session);
    return scenario;
  }

  addFeedback(sessionId, feedback) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const feedbackEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      type: feedback.type || 'general',
      rating: feedback.rating,
      comment: feedback.comment,
      category: feedback.category || 'usability',
      severity: feedback.severity || 'medium'
    };

    session.feedback.push(feedbackEntry);
    this.sessions.set(sessionId, session);

    return feedbackEntry;
  }

  completeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.endTime = new Date();
    session.status = 'completed';

    // Calculate final metrics
    const totalTime = (session.endTime - session.startTime) / 1000;
    session.metrics.totalTime = totalTime;
    session.metrics.averageTaskTime = session.metrics.totalTasks > 0 
      ? totalTime / session.metrics.totalTasks 
      : 0;

    // Calculate overall completion rate
    session.metrics.completionRate = session.metrics.totalTasks > 0
      ? (session.metrics.completedTasks / session.metrics.totalTasks) * 100
      : 0;

    // Calculate satisfaction score
    const satisfactionRatings = session.feedback
      .filter(f => f.rating !== undefined)
      .map(f => f.rating);
    
    session.metrics.averageSatisfaction = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((sum, rating) => sum + rating, 0) / satisfactionRatings.length
      : 0;

    this.sessions.set(sessionId, session);

    // Save session results
    this.saveSessionResults(session);

    return session;
  }

  saveSessionResults(session) {
    const filename = `uat-session-${session.id}-${Date.now()}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
    
    console.log(`UAT session results saved: ${filepath}`);
    return filepath;
  }

  generateUATReport(sessionIds = null) {
    const sessionsToAnalyze = sessionIds 
      ? sessionIds.map(id => this.sessions.get(id)).filter(Boolean)
      : Array.from(this.sessions.values());

    if (sessionsToAnalyze.length === 0) {
      throw new Error('No sessions found for report generation');
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.calculateSummaryMetrics(sessionsToAnalyze),
      scenarioAnalysis: this.analyzeScenarios(sessionsToAnalyze),
      userFeedback: this.analyzeFeedback(sessionsToAnalyze),
      recommendations: this.generateRecommendations(sessionsToAnalyze),
      sessions: sessionsToAnalyze.map(s => ({
        id: s.id,
        participant: s.participant,
        completionRate: s.metrics.completionRate,
        satisfaction: s.metrics.averageSatisfaction,
        totalTime: s.metrics.totalTime
      }))
    };

    // Save report
    const reportFilename = `uat-report-${Date.now()}.json`;
    const reportPath = path.join(this.resultsDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(this.resultsDir, `uat-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`UAT report generated: ${reportPath}`);
    console.log(`HTML report generated: ${htmlPath}`);

    return report;
  }

  calculateSummaryMetrics(sessions) {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    
    const allTasks = sessions.flatMap(s => 
      s.scenarios.flatMap(sc => sc.tasks)
    );
    
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const totalTasks = allTasks.length;
    
    const allFeedback = sessions.flatMap(s => s.feedback);
    const satisfactionRatings = allFeedback
      .filter(f => f.rating !== undefined)
      .map(f => f.rating);
    
    const averageSatisfaction = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((sum, rating) => sum + rating, 0) / satisfactionRatings.length
      : 0;

    return {
      totalSessions,
      completedSessions,
      sessionCompletionRate: (completedSessions / totalSessions) * 100,
      totalTasks,
      completedTasks,
      taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      averageSatisfaction,
      totalFeedbackItems: allFeedback.length
    };
  }

  analyzeScenarios(sessions) {
    const scenarioStats = {};
    
    sessions.forEach(session => {
      session.scenarios.forEach(scenario => {
        if (!scenarioStats[scenario.id]) {
          scenarioStats[scenario.id] = {
            name: scenario.name,
            attempts: 0,
            completions: 0,
            totalTime: 0,
            issues: []
          };
        }
        
        const stats = scenarioStats[scenario.id];
        stats.attempts++;
        
        if (scenario.status === 'completed') {
          stats.completions++;
        }
        
        stats.totalTime += scenario.actualTime || 0;
        
        // Collect issues from tasks
        scenario.tasks.forEach(task => {
          if (task.issues && task.issues.length > 0) {
            stats.issues.push(...task.issues);
          }
        });
      });
    });
    
    // Calculate completion rates and average times
    Object.values(scenarioStats).forEach(stats => {
      stats.completionRate = (stats.completions / stats.attempts) * 100;
      stats.averageTime = stats.attempts > 0 ? stats.totalTime / stats.attempts : 0;
    });
    
    return scenarioStats;
  }

  analyzeFeedback(sessions) {
    const allFeedback = sessions.flatMap(s => s.feedback);
    
    const feedbackByCategory = {};
    const feedbackBySeverity = {};
    const feedbackByType = {};
    
    allFeedback.forEach(feedback => {
      // By category
      if (!feedbackByCategory[feedback.category]) {
        feedbackByCategory[feedback.category] = [];
      }
      feedbackByCategory[feedback.category].push(feedback);
      
      // By severity
      if (!feedbackBySeverity[feedback.severity]) {
        feedbackBySeverity[feedback.severity] = [];
      }
      feedbackBySeverity[feedback.severity].push(feedback);
      
      // By type
      if (!feedbackByType[feedback.type]) {
        feedbackByType[feedback.type] = [];
      }
      feedbackByType[feedback.type].push(feedback);
    });
    
    return {
      total: allFeedback.length,
      byCategory: feedbackByCategory,
      bySeverity: feedbackBySeverity,
      byType: feedbackByType,
      commonIssues: this.identifyCommonIssues(allFeedback)
    };
  }

  identifyCommonIssues(feedback) {
    const issueFrequency = {};
    
    feedback.forEach(item => {
      if (item.comment) {
        // Simple keyword extraction (in real implementation, would use NLP)
        const keywords = item.comment.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3);
        
        keywords.forEach(keyword => {
          issueFrequency[keyword] = (issueFrequency[keyword] || 0) + 1;
        });
      }
    });
    
    // Return top issues
    return Object.entries(issueFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([keyword, frequency]) => ({ keyword, frequency }));
  }

  generateRecommendations(sessions) {
    const recommendations = [];
    const summary = this.calculateSummaryMetrics(sessions);
    const scenarioAnalysis = this.analyzeScenarios(sessions);
    
    // Task completion rate recommendations
    if (summary.taskCompletionRate < 90) {
      recommendations.push({
        priority: 'high',
        category: 'usability',
        issue: 'Low task completion rate',
        recommendation: 'Review failed tasks and improve user interface design',
        metric: `Current completion rate: ${summary.taskCompletionRate.toFixed(1)}%`
      });
    }
    
    // Satisfaction recommendations
    if (summary.averageSatisfaction < 4) {
      recommendations.push({
        priority: 'high',
        category: 'user-experience',
        issue: 'Low user satisfaction',
        recommendation: 'Conduct detailed user interviews to identify pain points',
        metric: `Current satisfaction: ${summary.averageSatisfaction.toFixed(1)}/5`
      });
    }
    
    // Scenario-specific recommendations
    Object.entries(scenarioAnalysis).forEach(([scenarioId, stats]) => {
      if (stats.completionRate < 80) {
        recommendations.push({
          priority: 'medium',
          category: 'functionality',
          issue: `Low completion rate for ${stats.name}`,
          recommendation: `Simplify workflow and improve guidance for ${stats.name}`,
          metric: `Completion rate: ${stats.completionRate.toFixed(1)}%`
        });
      }
      
      if (stats.averageTime > stats.expectedTime * 1.5) {
        recommendations.push({
          priority: 'medium',
          category: 'efficiency',
          issue: `${stats.name} takes longer than expected`,
          recommendation: `Optimize user flow and reduce steps in ${stats.name}`,
          metric: `Average time: ${stats.averageTime.toFixed(1)}s vs expected ${stats.expectedTime * 60}s`
        });
      }
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>User Acceptance Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #e9ecef; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .high-priority { border-left-color: #dc3545; }
        .medium-priority { border-left-color: #ffc107; }
        .low-priority { border-left-color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: #007bff; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="header">
        <h1>User Acceptance Testing Report</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Sessions Analyzed:</strong> ${report.summary.totalSessions}</p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="metric">
            <h3>Overall Completion Rate</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.summary.taskCompletionRate}%"></div>
            </div>
            <p>${report.summary.taskCompletionRate.toFixed(1)}%</p>
        </div>
        <div class="metric">
            <h3>User Satisfaction</h3>
            <p>${report.summary.averageSatisfaction.toFixed(1)}/5.0</p>
        </div>
        <div class="metric">
            <h3>Sessions Completed</h3>
            <p>${report.summary.completedSessions}/${report.summary.totalSessions}</p>
        </div>
    </div>

    <div class="section">
        <h2>Scenario Performance</h2>
        <table>
            <tr><th>Scenario</th><th>Attempts</th><th>Completions</th><th>Success Rate</th><th>Avg Time</th></tr>
            ${Object.entries(report.scenarioAnalysis).map(([id, stats]) => `
                <tr>
                    <td>${stats.name}</td>
                    <td>${stats.attempts}</td>
                    <td>${stats.completions}</td>
                    <td>${stats.completionRate.toFixed(1)}%</td>
                    <td>${stats.averageTime.toFixed(1)}s</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Key Recommendations</h2>
        ${report.recommendations.slice(0, 10).map(rec => `
            <div class="recommendation ${rec.priority}-priority">
                <h4>${rec.issue}</h4>
                <p><strong>Recommendation:</strong> ${rec.recommendation}</p>
                <p><strong>Metric:</strong> ${rec.metric}</p>
                <p><strong>Priority:</strong> ${rec.priority.toUpperCase()}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>User Feedback Summary</h2>
        <p><strong>Total Feedback Items:</strong> ${report.userFeedback.total}</p>
        <h3>Feedback by Severity</h3>
        <ul>
            ${Object.entries(report.userFeedback.bySeverity).map(([severity, items]) => 
                `<li><strong>${severity}:</strong> ${items.length} items</li>`
            ).join('')}
        </ul>
    </div>
</body>
</html>`;
  }
}

module.exports = UATFramework;