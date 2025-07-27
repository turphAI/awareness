import api from './api';

const configurationService = {
  // Topic Preferences
  getTopicPreferences: async () => {
    const response = await api.get('/configuration/topic-preferences');
    return response.data;
  },

  updateTopicPreferences: async (preferences) => {
    const response = await api.put('/configuration/topic-preferences', preferences);
    return response.data;
  },

  // Notification Settings
  getNotificationSettings: async () => {
    const response = await api.get('/configuration/notification-settings');
    return response.data;
  },

  updateNotificationSettings: async (settings) => {
    const response = await api.put('/configuration/notification-settings', settings);
    return response.data;
  },

  // Content Volume Settings
  getContentVolumeSettings: async () => {
    const response = await api.get('/configuration/content-volume');
    return response.data;
  },

  updateContentVolumeSettings: async (settings) => {
    const response = await api.put('/configuration/content-volume', settings);
    return response.data;
  },

  // Discovery Settings
  getDiscoverySettings: async () => {
    const response = await api.get('/configuration/discovery-settings');
    return response.data;
  },

  updateDiscoverySettings: async (settings) => {
    const response = await api.put('/configuration/discovery-settings', settings);
    return response.data;
  },

  // Summary Preferences
  getSummaryPreferences: async () => {
    const response = await api.get('/configuration/summary-preferences');
    return response.data;
  },

  updateSummaryPreferences: async (preferences) => {
    const response = await api.put('/configuration/summary-preferences', preferences);
    return response.data;
  },

  // Digest Scheduling
  getDigestScheduling: async () => {
    const response = await api.get('/configuration/digest-scheduling');
    return response.data;
  },

  updateDigestScheduling: async (scheduling) => {
    const response = await api.put('/configuration/digest-scheduling', scheduling);
    return response.data;
  },

  // Get all configuration settings
  getAllSettings: async () => {
    const [
      topicPreferences,
      notificationSettings,
      contentVolumeSettings,
      discoverySettings,
      summaryPreferences,
      digestScheduling
    ] = await Promise.all([
      configurationService.getTopicPreferences(),
      configurationService.getNotificationSettings(),
      configurationService.getContentVolumeSettings(),
      configurationService.getDiscoverySettings(),
      configurationService.getSummaryPreferences(),
      configurationService.getDigestScheduling()
    ]);

    return {
      topicPreferences,
      notificationSettings,
      contentVolumeSettings,
      discoverySettings,
      summaryPreferences,
      digestScheduling
    };
  }
};

export default configurationService;