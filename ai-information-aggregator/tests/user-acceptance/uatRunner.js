#!/usr/bin/env node

const UATFramework = require('./uatFramework');
const readline = require('readline');

/**
 * Interactive UAT Runner
 * Provides a command-line interface for conducting UAT sessions
 */

class UATRunner {
  constructor() {
    this.framework = new UATFramework();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.currentSession = null;
  }

  async start() {
    console.log('🧪 User Acceptance Testing Runner');
    console.log('=================================\n');
    
    try {
      await this.showMainMenu();
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      this.rl.close();
    }
  }

  async showMainMenu() {
    console.log('Main Menu:');
    console.log('1. Start New UAT Session');
    console.log('2. Resume Existing Session');
    console.log('3. Generate UAT Report');
    console.log('4. View Test Scenarios');
    console.log('5. Demo UAT Session');
    console.log('6. Exit');
    
    const choice = await this.askQuestion('\nSelect an option (1-6): ');
    
    switch (choice.trim()) {
      case '1':
        await this.startNewSession();
        break;
      case '2':
        await this.resumeSession();
        break;
      case '3':
        await this.generateReport();
        break;
      case '4':
        await this.viewScenarios();
        break;
      case '5':
        await this.runDemoSession();
        break;
      case '6':
        console.log('Goodbye!');
        return;
      default:
        console.log('Invalid option. Please try again.\n');
        await this.showMainMenu();
    }
  }

  async startNewSession() {
    console.log('\n📝 Starting New UAT Session');
    console.log('============================');
    
    const participantInfo = {
      name: await this.askQuestion('Participant name: '),
      email: await this.askQuestion('Participant email: '),
      role: await this.askQuestion('Role (e.g., UX Designer, Researcher): '),
      experience: await this.askQuestion('Experience level (Beginner/Intermediate/Advanced): '),
      device: await this.askQuestion('Testing device (Desktop/Mobile/Tablet): '),
      browser: await this.askQuestion('Browser (Chrome/Firefox/Safari/Edge): ')
    };
    
    const sessionId = this.framework.createUATSession(participantInfo);
    this.currentSession = sessionId;
    
    console.log(`\n✅ Session created: ${sessionId}`);
    console.log(`Participant: ${participantInfo.name} (${participantInfo.role})`);
    
    await this.runSessionMenu();
  }

  async runSessionMenu() {
    if (!this.currentSession) {
      console.log('No active session. Returning to main menu.\n');
      await this.showMainMenu();
      return;
    }
    
    console.log('\n📋 Session Menu:');
    console.log('1. Start Test Scenario');
    console.log('2. Add Feedback');
    console.log('3. View Session Status');
    console.log('4. Complete Session');
    console.log('5. Return to Main Menu');
    
    const choice = await this.askQuestion('\nSelect an option (1-5): ');
    
    switch (choice.trim()) {
      case '1':
        await this.selectScenario();
        break;
      case '2':
        await this.addFeedback();
        break;
      case '3':
        await this.viewSessionStatus();
        break;
      case '4':
        await this.completeSession();
        break;
      case '5':
        await this.showMainMenu();
        return;
      default:
        console.log('Invalid option. Please try again.');
        await this.runSessionMenu();
    }
  }

  async selectScenario() {
    console.log('\n🎯 Available Test Scenarios:');
    
    this.framework.testScenarios.forEach((scenario, index) => {
      console.log(`${index + 1}. ${scenario.name} (${scenario.estimatedTime} min)`);
      console.log(`   ${scenario.description}`);
    });
    
    const choice = await this.askQuestion('\nSelect scenario (1-5): ');
    const scenarioIndex = parseInt(choice) - 1;
    
    if (scenarioIndex >= 0 && scenarioIndex < this.framework.testScenarios.length) {
      const scenario = this.framework.testScenarios[scenarioIndex];
      await this.runScenario(scenario);
    } else {
      console.log('Invalid scenario selection.');
      await this.selectScenario();
    }
  }

  async runScenario(scenario) {
    console.log(`\n🚀 Starting Scenario: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Estimated time: ${scenario.estimatedTime} minutes`);
    
    const scenarioExecution = this.framework.startScenario(this.currentSession, scenario.id);
    
    for (const task of scenarioExecution.tasks) {
      await this.runTask(scenario.id, task);
    }
    
    this.framework.completeScenario(this.currentSession, scenario.id);
    console.log(`\n✅ Scenario "${scenario.name}" completed!`);
    
    await this.runSessionMenu();
  }

  async runTask(scenarioId, task) {
    console.log(`\n📝 Task: ${task.description}`);
    console.log(`Expected time: ${task.expectedTime} minutes`);
    console.log(`Success criteria: ${task.successCriteria}`);
    
    await this.askQuestion('Press Enter when ready to start the task...');
    
    this.framework.startTask(this.currentSession, scenarioId, task.id);
    
    console.log('⏱️  Task started! Complete the task in the application...');
    
    const success = await this.askQuestion('Was the task completed successfully? (y/n): ');
    const isSuccess = success.toLowerCase().startsWith('y');
    
    let issues = [];
    let feedback = null;
    
    if (!isSuccess) {
      const issueDescription = await this.askQuestion('Describe the issue encountered: ');
      issues.push({
        description: issueDescription,
        severity: 'medium',
        timestamp: new Date()
      });
    }
    
    const userFeedback = await this.askQuestion('Any additional feedback for this task? (optional): ');
    if (userFeedback.trim()) {
      feedback = userFeedback;
    }
    
    this.framework.completeTask(this.currentSession, scenarioId, task.id, {
      success: isSuccess,
      issues,
      feedback
    });
    
    console.log(`${isSuccess ? '✅' : '❌'} Task ${isSuccess ? 'completed' : 'failed'}`);
  }

  async addFeedback() {
    console.log('\n💬 Add Feedback');
    console.log('================');
    
    const type = await this.askQuestion('Feedback type (bug/suggestion/praise/other): ');
    const category = await this.askQuestion('Category (usability/functionality/performance/design): ');
    const rating = await this.askQuestion('Rating (1-5, optional): ');
    const comment = await this.askQuestion('Comment: ');
    const severity = await this.askQuestion('Severity (low/medium/high): ');
    
    const feedback = {
      type: type || 'other',
      category: category || 'usability',
      rating: rating ? parseInt(rating) : undefined,
      comment,
      severity: severity || 'medium'
    };
    
    this.framework.addFeedback(this.currentSession, feedback);
    console.log('✅ Feedback added successfully!');
    
    await this.runSessionMenu();
  }

  async viewSessionStatus() {
    const session = this.framework.sessions.get(this.currentSession);
    if (!session) {
      console.log('Session not found.');
      return;
    }
    
    console.log('\n📊 Session Status');
    console.log('=================');
    console.log(`Participant: ${session.participant.name}`);
    console.log(`Start time: ${session.startTime.toLocaleString()}`);
    console.log(`Status: ${session.status}`);
    console.log(`Scenarios completed: ${session.scenarios.length}`);
    console.log(`Feedback items: ${session.feedback.length}`);
    console.log(`Tasks completed: ${session.metrics.completedTasks}/${session.metrics.totalTasks}`);
    
    if (session.scenarios.length > 0) {
      console.log('\nScenario Progress:');
      session.scenarios.forEach(scenario => {
        const completedTasks = scenario.tasks.filter(t => t.status === 'completed').length;
        console.log(`  ${scenario.name}: ${completedTasks}/${scenario.tasks.length} tasks (${scenario.status})`);
      });
    }
    
    await this.runSessionMenu();
  }

  async completeSession() {
    console.log('\n🏁 Completing UAT Session');
    
    const confirm = await this.askQuestion('Are you sure you want to complete this session? (y/n): ');
    if (!confirm.toLowerCase().startsWith('y')) {
      await this.runSessionMenu();
      return;
    }
    
    const session = this.framework.completeSession(this.currentSession);
    
    console.log('\n✅ Session completed successfully!');
    console.log('==================================');
    console.log(`Total time: ${(session.metrics.totalTime / 60).toFixed(1)} minutes`);
    console.log(`Completion rate: ${session.metrics.completionRate.toFixed(1)}%`);
    console.log(`Average satisfaction: ${session.metrics.averageSatisfaction.toFixed(1)}/5`);
    
    this.currentSession = null;
    await this.showMainMenu();
  }

  async generateReport() {
    console.log('\n📊 Generating UAT Report');
    console.log('========================');
    
    try {
      const report = this.framework.generateUATReport();
      
      console.log('✅ Report generated successfully!');
      console.log(`Sessions analyzed: ${report.summary.totalSessions}`);
      console.log(`Overall completion rate: ${report.summary.taskCompletionRate.toFixed(1)}%`);
      console.log(`Average satisfaction: ${report.summary.averageSatisfaction.toFixed(1)}/5`);
      console.log(`Recommendations: ${report.recommendations.length}`);
      
    } catch (error) {
      console.log(`❌ Error generating report: ${error.message}`);
    }
    
    await this.showMainMenu();
  }

  async viewScenarios() {
    console.log('\n📋 Test Scenarios');
    console.log('=================');
    
    this.framework.testScenarios.forEach((scenario, index) => {
      console.log(`\n${index + 1}. ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Estimated time: ${scenario.estimatedTime} minutes`);
      console.log(`   Priority: ${scenario.priority}`);
      console.log(`   Tasks: ${scenario.tasks.length}`);
      
      scenario.tasks.forEach((task, taskIndex) => {
        console.log(`     ${taskIndex + 1}. ${task.description} (${task.expectedTime} min)`);
      });
    });
    
    await this.showMainMenu();
  }

  async runDemoSession() {
    console.log('\n🎭 Running Demo UAT Session');
    console.log('===========================');
    
    // Create demo participant
    const demoParticipant = {
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'UX Designer',
      experience: 'Intermediate',
      device: 'Desktop',
      browser: 'Chrome'
    };
    
    const sessionId = this.framework.createUATSession(demoParticipant);
    console.log(`Demo session created: ${sessionId}`);
    
    // Run first scenario with simulated results
    const scenario = this.framework.testScenarios[0]; // Onboarding
    const scenarioExecution = this.framework.startScenario(sessionId, scenario.id);
    
    console.log(`\nRunning scenario: ${scenario.name}`);
    
    // Simulate task completion
    for (let i = 0; i < scenario.tasks.length; i++) {
      const task = scenario.tasks[i];
      console.log(`  Executing task: ${task.description}`);
      
      this.framework.startTask(sessionId, scenario.id, task.id);
      
      // Simulate task execution time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure (90% success rate)
      const success = Math.random() > 0.1;
      
      this.framework.completeTask(sessionId, scenario.id, task.id, {
        success,
        issues: success ? [] : [{ description: 'Simulated issue', severity: 'low' }],
        feedback: success ? null : 'Could be more intuitive'
      });
      
      console.log(`    ${success ? '✅' : '❌'} Task ${success ? 'completed' : 'failed'}`);
    }
    
    this.framework.completeScenario(sessionId, scenario.id);
    
    // Add some demo feedback
    this.framework.addFeedback(sessionId, {
      type: 'suggestion',
      category: 'usability',
      rating: 4,
      comment: 'Overall good experience, but could use better guidance',
      severity: 'low'
    });
    
    // Complete session
    const session = this.framework.completeSession(sessionId);
    
    console.log('\n✅ Demo session completed!');
    console.log(`Completion rate: ${session.metrics.completionRate.toFixed(1)}%`);
    console.log(`Session duration: ${(session.metrics.totalTime / 60).toFixed(1)} minutes`);
    
    // Generate demo report
    const report = this.framework.generateUATReport([sessionId]);
    console.log('\n📊 Demo report generated with sample data');
    
    await this.showMainMenu();
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Run the UAT Runner if called directly
if (require.main === module) {
  const runner = new UATRunner();
  runner.start().catch(console.error);
}

module.exports = UATRunner;