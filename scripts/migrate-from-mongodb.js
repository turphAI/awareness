#!/usr/bin/env node

/**
 * MongoDB to MySQL Migration Script
 * Migrates data from existing MongoDB database to PlanetScale MySQL
 */

require('dotenv').config();
const dbConnection = require('../database/connection');

/**
 * Migration utility class
 */
class MongoToMySQLMigrator {
  constructor() {
    this.batchSize = 100;
    this.stats = {
      users: 0,
      sources: 0,
      content: 0,
      collections: 0,
      interactions: 0,
      errors: 0
    };
  }

  /**
   * Main migration function
   */
  async migrate(mongoData) {
    console.log('🚀 Starting MongoDB to MySQL migration...\n');

    try {
      // Migrate in order due to foreign key dependencies
      await this.migrateUsers(mongoData.users || []);
      await this.migrateCategories(mongoData.categories || []);
      await this.migrateSources(mongoData.sources || []);
      await this.migrateContent(mongoData.content || []);
      await this.migrateCollections(mongoData.collections || []);
      await this.migrateInteractions(mongoData.interactions || []);
      await this.migrateSettings(mongoData.settings || {});

      console.log('\n🎉 Migration completed successfully!');
      this.printStats();

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Migrate users
   */
  async migrateUsers(users) {
    console.log(`📥 Migrating ${users.length} users...`);

    for (const user of users) {
      try {
        const userData = this.transformUser(user);
        await dbConnection.query(`
          INSERT INTO users (
            email, password_hash, name, role, preferences, notifications,
            profile, email_verified, last_login, active, data_retention,
            privacy_settings, consents, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userData.email,
          userData.password_hash,
          userData.name,
          userData.role,
          JSON.stringify(userData.preferences),
          JSON.stringify(userData.notifications),
          JSON.stringify(userData.profile),
          userData.email_verified,
          userData.last_login,
          userData.active,
          JSON.stringify(userData.data_retention),
          JSON.stringify(userData.privacy_settings),
          JSON.stringify(userData.consents),
          userData.created_at,
          userData.updated_at
        ]);

        this.stats.users++;
      } catch (error) {
        console.error(`Error migrating user ${user.email}:`, error.message);
        this.stats.errors++;
      }
    }

    console.log(`✅ Migrated ${this.stats.users} users`);
  }

  /**
   * Migrate categories
   */
  async migrateCategories(categories) {
    console.log(`📥 Migrating ${categories.length} categories...`);

    for (const category of categories) {
      try {
        const categoryData = this.transformCategory(category);
        await dbConnection.query(`
          INSERT INTO categories (
            name, description, color, parent_category_id, created_by,
            is_system, source_count, keywords, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          categoryData.name,
          categoryData.description,
          categoryData.color,
          categoryData.parent_category_id,
          categoryData.created_by,
          categoryData.is_system,
          categoryData.source_count,
          JSON.stringify(categoryData.keywords),
          categoryData.created_at,
          categoryData.updated_at
        ]);
      } catch (error) {
        console.error(`Error migrating category ${category.name}:`, error.message);
        this.stats.errors++;
      }
    }

    console.log(`✅ Migrated categories`);
  }

  /**
   * Migrate sources
   */
  async migrateSources(sources) {
    console.log(`📥 Migrating ${sources.length} sources...`);

    for (const source of sources) {
      try {
        const sourceData = this.transformSource(source);
        await dbConnection.query(`
          INSERT INTO sources (
            url, name, description, type, categories, tags, relevance_score,
            check_frequency, last_checked, last_updated, requires_authentication,
            discovered_from, discovery_date, active, created_by, content_count,
            error_count, last_error_message, last_error_date, metadata,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sourceData.url,
          sourceData.name,
          sourceData.description,
          sourceData.type,
          JSON.stringify(sourceData.categories),
          JSON.stringify(sourceData.tags),
          sourceData.relevance_score,
          sourceData.check_frequency,
          sourceData.last_checked,
          sourceData.last_updated,
          sourceData.requires_authentication,
          sourceData.discovered_from,
          sourceData.discovery_date,
          sourceData.active,
          sourceData.created_by,
          sourceData.content_count,
          sourceData.error_count,
          sourceData.last_error_message,
          sourceData.last_error_date,
          JSON.stringify(sourceData.metadata),
          sourceData.created_at,
          sourceData.updated_at
        ]);

        this.stats.sources++;
      } catch (error) {
        console.error(`Error migrating source ${source.name}:`, error.message);
        this.stats.errors++;
      }
    }

    console.log(`✅ Migrated ${this.stats.sources} sources`);
  }

  /**
   * Migrate content
   */
  async migrateContent(content) {
    console.log(`📥 Migrating ${content.length} content items...`);

    for (const item of content) {
      try {
        const contentData = this.transformContent(item);
        await dbConnection.query(`
          INSERT INTO content (
            source_id, url, title, author, publish_date, discovery_date,
            type, categories, topics, relevance_score, summary, key_insights,
            full_text, visual_elements, metadata, processed, outdated,
            read_count, save_count, share_count, language, sentiment,
            sentiment_score, reading_time, word_count, quality_score,
            quality_factors, processing_history, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contentData.source_id,
          contentData.url,
          contentData.title,
          contentData.author,
          contentData.publish_date,
          contentData.discovery_date,
          contentData.type,
          JSON.stringify(contentData.categories),
          JSON.stringify(contentData.topics),
          contentData.relevance_score,
          contentData.summary,
          JSON.stringify(contentData.key_insights),
          contentData.full_text,
          JSON.stringify(contentData.visual_elements),
          JSON.stringify(contentData.metadata),
          contentData.processed,
          contentData.outdated,
          contentData.read_count,
          contentData.save_count,
          contentData.share_count,
          contentData.language,
          contentData.sentiment,
          contentData.sentiment_score,
          contentData.reading_time,
          contentData.word_count,
          contentData.quality_score,
          JSON.stringify(contentData.quality_factors),
          JSON.stringify(contentData.processing_history),
          contentData.created_at,
          contentData.updated_at
        ]);

        this.stats.content++;
      } catch (error) {
        console.error(`Error migrating content ${item.title}:`, error.message);
        this.stats.errors++;
      }
    }

    console.log(`✅ Migrated ${this.stats.content} content items`);
  }

  /**
   * Transform MongoDB user to MySQL format
   */
  transformUser(user) {
    return {
      email: user.email,
      password_hash: user.passwordHash,
      name: user.name,
      role: user.role || 'user',
      preferences: user.preferences || {},
      notifications: user.notifications || {},
      profile: user.profile || {},
      email_verified: user.emailVerified || false,
      last_login: user.lastLogin || new Date(),
      active: user.active !== false,
      data_retention: user.dataRetention || {},
      privacy_settings: user.privacySettings || {},
      consents: user.consents || [],
      created_at: user.createdAt || user.created || new Date(),
      updated_at: user.updatedAt || user.updated || new Date()
    };
  }

  /**
   * Transform MongoDB category to MySQL format
   */
  transformCategory(category) {
    return {
      name: category.name,
      description: category.description,
      color: category.color || '#3498db',
      parent_category_id: this.convertObjectId(category.parentCategory),
      created_by: this.convertObjectId(category.createdBy),
      is_system: category.isSystem || false,
      source_count: category.sourceCount || 0,
      keywords: category.keywords || [],
      created_at: category.createdAt || category.created || new Date(),
      updated_at: category.updatedAt || category.updated || new Date()
    };
  }

  /**
   * Transform MongoDB source to MySQL format
   */
  transformSource(source) {
    return {
      url: source.url,
      name: source.name,
      description: source.description,
      type: source.type,
      categories: source.categories || [],
      tags: source.tags || [],
      relevance_score: source.relevanceScore || 0.5,
      check_frequency: source.checkFrequency || 'daily',
      last_checked: source.lastChecked,
      last_updated: source.lastUpdated,
      requires_authentication: source.requiresAuthentication || false,
      discovered_from: this.convertObjectId(source.discoveredFrom),
      discovery_date: source.discoveryDate || new Date(),
      active: source.active !== false,
      created_by: this.convertObjectId(source.createdBy),
      content_count: source.contentCount || 0,
      error_count: source.errorCount || 0,
      last_error_message: source.lastError?.message,
      last_error_date: source.lastError?.date,
      metadata: source.metadata || {},
      created_at: source.createdAt || source.created || new Date(),
      updated_at: source.updatedAt || source.updated || new Date()
    };
  }

  /**
   * Transform MongoDB content to MySQL format
   */
  transformContent(content) {
    return {
      source_id: this.convertObjectId(content.sourceId),
      url: content.url,
      title: content.title,
      author: content.author,
      publish_date: content.publishDate,
      discovery_date: content.discoveryDate || new Date(),
      type: content.type,
      categories: content.categories || [],
      topics: content.topics || [],
      relevance_score: content.relevanceScore || 0.5,
      summary: content.summary,
      key_insights: content.keyInsights || [],
      full_text: content.fullText,
      visual_elements: content.visualElements || [],
      metadata: content.metadata || {},
      processed: content.processed || false,
      outdated: content.outdated || false,
      read_count: content.readCount || 0,
      save_count: content.saveCount || 0,
      share_count: content.shareCount || 0,
      language: content.language || 'en',
      sentiment: content.sentiment || 'neutral',
      sentiment_score: content.sentimentScore || 0,
      reading_time: content.readingTime,
      word_count: content.wordCount,
      quality_score: content.qualityScore || 0.5,
      quality_factors: content.qualityFactors || {},
      processing_history: content.processingHistory || [],
      created_at: content.createdAt || content.created || new Date(),
      updated_at: content.updatedAt || content.updated || new Date()
    };
  }

  /**
   * Convert MongoDB ObjectId to MySQL integer
   * In a real migration, you'd need a mapping table
   */
  convertObjectId(objectId) {
    if (!objectId) return null;
    
    // This is a simplified conversion - in practice you'd need
    // to maintain a mapping between ObjectIds and MySQL IDs
    if (typeof objectId === 'string') {
      // Convert ObjectId string to a hash-based integer
      let hash = 0;
      for (let i = 0; i < objectId.length; i++) {
        const char = objectId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }
    
    return null;
  }

  /**
   * Print migration statistics
   */
  printStats() {
    console.log('\n📊 Migration Statistics:');
    console.log('========================');
    Object.entries(this.stats).forEach(([key, value]) => {
      console.log(`${key.padEnd(15)}: ${value}`);
    });
  }
}

/**
 * Example usage with sample data
 */
async function runMigration() {
  const migrator = new MongoToMySQLMigrator();
  
  // Sample data structure - replace with actual MongoDB export
  const sampleData = {
    users: [
      {
        email: 'user@example.com',
        passwordHash: 'hashed_password',
        name: 'Sample User',
        role: 'user',
        preferences: { topics: ['technology', 'science'] },
        emailVerified: true,
        createdAt: new Date()
      }
    ],
    categories: [
      {
        name: 'Technology',
        description: 'Technology related content',
        isSystem: true,
        createdBy: 'system'
      }
    ],
    sources: [],
    content: [],
    collections: [],
    interactions: [],
    settings: {}
  };

  try {
    await migrator.migrate(sampleData);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dbConnection.close();
  }
}

// Export for use as module
module.exports = { MongoToMySQLMigrator };

// Run if called directly
if (require.main === module) {
  console.log('MongoDB to MySQL Migration Tool');
  console.log('================================\n');
  
  console.log('⚠️  This is a sample migration script.');
  console.log('   Modify the sampleData object with your actual MongoDB export.\n');
  
  runMigration();
}