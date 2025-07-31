-- AI Information Aggregator - MySQL Schema for PlanetScale
-- Converted from MongoDB schema to MySQL with proper relationships and indexes

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role ENUM('user', 'admin', 'editor', 'moderator') DEFAULT 'user',
    
    -- Preferences (JSON column for flexibility)
    preferences JSON DEFAULT NULL,
    notifications JSON DEFAULT NULL,
    profile JSON DEFAULT NULL,
    
    -- Authentication fields
    reset_password_token VARCHAR(255) DEFAULT NULL,
    reset_password_expire DATETIME DEFAULT NULL,
    email_verification_token VARCHAR(255) DEFAULT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    
    -- Account deletion fields
    account_deletion_scheduled DATETIME DEFAULT NULL,
    account_deleted BOOLEAN DEFAULT FALSE,
    account_deleted_at DATETIME DEFAULT NULL,
    
    -- Privacy and data retention (JSON columns)
    data_retention JSON DEFAULT NULL,
    privacy_settings JSON DEFAULT NULL,
    consents JSON DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_active (active),
    INDEX idx_account_deletion_scheduled (account_deletion_scheduled),
    INDEX idx_account_deleted (account_deleted)
);

-- Categories table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(200) DEFAULT NULL,
    color VARCHAR(7) DEFAULT '#3498db',
    parent_category_id INT DEFAULT NULL,
    created_by INT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    source_count INT DEFAULT 0,
    keywords JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_name (name),
    INDEX idx_created_by (created_by),
    INDEX idx_parent_category (parent_category_id),
    INDEX idx_is_system (is_system)
);

-- Sources table
CREATE TABLE sources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    type ENUM('website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss') NOT NULL,
    categories JSON DEFAULT NULL,
    tags JSON DEFAULT NULL,
    relevance_score DECIMAL(3,2) DEFAULT 0.50,
    check_frequency ENUM('hourly', 'daily', 'weekly', 'monthly') DEFAULT 'daily',
    last_checked DATETIME DEFAULT NULL,
    last_updated DATETIME DEFAULT NULL,
    requires_authentication BOOLEAN DEFAULT FALSE,
    
    -- Encrypted credentials
    credentials_encrypted TEXT DEFAULT NULL,
    credentials_iv VARCHAR(32) DEFAULT NULL,
    
    discovered_from INT DEFAULT NULL,
    discovery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    content_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    
    -- Error tracking
    last_error_message TEXT DEFAULT NULL,
    last_error_date DATETIME DEFAULT NULL,
    
    -- Metadata and type-specific fields (JSON for flexibility)
    metadata JSON DEFAULT NULL,
    rss_url TEXT DEFAULT NULL,
    podcast_author VARCHAR(255) DEFAULT NULL,
    podcast_language VARCHAR(10) DEFAULT NULL,
    academic_publisher VARCHAR(255) DEFAULT NULL,
    academic_domain VARCHAR(255) DEFAULT NULL,
    social_platform VARCHAR(50) DEFAULT NULL,
    social_username VARCHAR(100) DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (discovered_from) REFERENCES sources(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_url (url(255)),
    INDEX idx_type (type),
    INDEX idx_active (active),
    INDEX idx_created_by (created_by),
    INDEX idx_relevance_score (relevance_score DESC),
    INDEX idx_last_checked (last_checked),
    INDEX idx_check_frequency (check_frequency)
);

-- Content table
CREATE TABLE content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_id INT NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) DEFAULT NULL,
    publish_date DATETIME DEFAULT NULL,
    discovery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    type ENUM('article', 'paper', 'podcast', 'video', 'social', 'newsletter', 'book', 'course') NOT NULL,
    categories JSON DEFAULT NULL,
    topics JSON DEFAULT NULL,
    relevance_score DECIMAL(3,2) DEFAULT 0.50,
    summary TEXT DEFAULT NULL,
    key_insights JSON DEFAULT NULL,
    full_text LONGTEXT DEFAULT NULL,
    visual_elements JSON DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    processed BOOLEAN DEFAULT FALSE,
    outdated BOOLEAN DEFAULT FALSE,
    read_count INT DEFAULT 0,
    save_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    language VARCHAR(10) DEFAULT 'en',
    sentiment ENUM('positive', 'neutral', 'negative', 'mixed') DEFAULT 'neutral',
    sentiment_score DECIMAL(3,2) DEFAULT 0.00,
    reading_time INT DEFAULT NULL,
    word_count INT DEFAULT NULL,
    
    -- Type-specific fields
    article_section VARCHAR(255) DEFAULT NULL,
    paper_abstract TEXT DEFAULT NULL,
    paper_doi VARCHAR(255) DEFAULT NULL,
    paper_citations INT DEFAULT 0,
    paper_authors JSON DEFAULT NULL,
    podcast_episode_number INT DEFAULT NULL,
    podcast_duration INT DEFAULT NULL,
    podcast_transcript LONGTEXT DEFAULT NULL,
    video_duration INT DEFAULT NULL,
    video_transcript LONGTEXT DEFAULT NULL,
    social_platform VARCHAR(50) DEFAULT NULL,
    social_username VARCHAR(100) DEFAULT NULL,
    social_likes INT DEFAULT 0,
    social_shares INT DEFAULT 0,
    social_comments INT DEFAULT 0,
    
    -- Quality assessment
    quality_score DECIMAL(3,2) DEFAULT 0.50,
    quality_factors JSON DEFAULT NULL,
    
    -- Processing history
    processing_history JSON DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_source_url (source_id, url(255)),
    INDEX idx_type (type),
    INDEX idx_processed (processed),
    INDEX idx_outdated (outdated),
    INDEX idx_publish_date (publish_date DESC),
    INDEX idx_relevance_score (relevance_score DESC),
    INDEX idx_discovery_date (discovery_date DESC)
);

-- References table (for content relationships)
CREATE TABLE content_references (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_content_id INT NOT NULL,
    target_content_id INT NOT NULL,
    reference_type ENUM('citation', 'mention', 'related', 'follow_up') DEFAULT 'related',
    context TEXT DEFAULT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 0.50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_content_id) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (target_content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_reference (source_content_id, target_content_id, reference_type),
    INDEX idx_source_content (source_content_id),
    INDEX idx_target_content (target_content_id),
    INDEX idx_reference_type (reference_type)
);

-- Collections table
CREATE TABLE collections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    public BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#3498db',
    icon VARCHAR(50) DEFAULT 'folder',
    tags JSON DEFAULT NULL,
    parent_id INT DEFAULT NULL,
    sort_order INT DEFAULT 0,
    view_count INT DEFAULT 0,
    last_viewed DATETIME DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_user_collection (user_id, name),
    INDEX idx_user_id (user_id),
    INDEX idx_public_featured (public, featured),
    INDEX idx_parent_id (parent_id)
);

-- Collection content mapping table
CREATE TABLE collection_content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    collection_id INT NOT NULL,
    content_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_collection_content (collection_id, content_id),
    INDEX idx_collection_id (collection_id),
    INDEX idx_content_id (content_id)
);

-- Collection collaborators table
CREATE TABLE collection_collaborators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    collection_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('viewer', 'editor', 'admin') DEFAULT 'viewer',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_collection_collaborator (collection_id, user_id),
    INDEX idx_collection_id (collection_id),
    INDEX idx_user_id (user_id)
);

-- Interactions table
CREATE TABLE interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    content_id INT NOT NULL,
    type ENUM('view', 'save', 'share', 'dismiss', 'like', 'dislike', 'comment', 'highlight', 'note') NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration INT DEFAULT NULL,
    progress INT DEFAULT NULL,
    device VARCHAR(100) DEFAULT NULL,
    platform VARCHAR(100) DEFAULT NULL,
    location VARCHAR(255) DEFAULT NULL,
    referrer TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    
    -- Comment-specific fields
    comment_text TEXT DEFAULT NULL,
    comment_parent_id INT DEFAULT NULL,
    
    -- Highlight-specific fields
    highlight_text TEXT DEFAULT NULL,
    highlight_position JSON DEFAULT NULL,
    
    -- Note-specific fields
    note_text TEXT DEFAULT NULL,
    note_position VARCHAR(255) DEFAULT NULL,
    
    -- Share-specific fields
    share_method ENUM('email', 'twitter', 'facebook', 'linkedin', 'copy', 'other') DEFAULT 'other',
    share_recipients JSON DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_parent_id) REFERENCES interactions(id) ON DELETE CASCADE,
    
    INDEX idx_user_content_type (user_id, content_id, type),
    INDEX idx_content_type (content_id, type),
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_user_id (user_id),
    INDEX idx_content_id (content_id)
);

-- Digest scheduling table
CREATE TABLE digest_scheduling (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    frequency ENUM('daily', 'weekly', 'bi-weekly', 'monthly') DEFAULT 'daily',
    delivery_time JSON NOT NULL DEFAULT ('{"hour": 8, "minute": 0, "timezone": "UTC"}'),
    weekly_settings JSON DEFAULT NULL,
    monthly_settings JSON DEFAULT NULL,
    content_selection JSON DEFAULT NULL,
    formatting JSON DEFAULT NULL,
    delivery_method JSON DEFAULT NULL,
    last_delivery DATETIME DEFAULT NULL,
    next_delivery DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_enabled_next_delivery (enabled, next_delivery)
);

-- Content volume settings table
CREATE TABLE content_volume_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    max_daily_items INT DEFAULT 20,
    max_weekly_items INT DEFAULT 100,
    priority_threshold DECIMAL(3,2) DEFAULT 0.70,
    content_type_limits JSON DEFAULT NULL,
    source_limits JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id)
);

-- Discovery settings table
CREATE TABLE discovery_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    aggressiveness DECIMAL(3,2) DEFAULT 0.50,
    discovery_methods JSON DEFAULT NULL,
    content_filters JSON DEFAULT NULL,
    source_expansion JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id)
);

-- Summary preferences table
CREATE TABLE summary_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    default_length ENUM('short', 'medium', 'long') DEFAULT 'medium',
    include_key_insights BOOLEAN DEFAULT TRUE,
    include_quotes BOOLEAN DEFAULT TRUE,
    include_statistics BOOLEAN DEFAULT TRUE,
    content_type_preferences JSON DEFAULT NULL,
    language_preferences JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id)
);

-- Topic preferences table
CREATE TABLE topic_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    interest_level DECIMAL(3,2) DEFAULT 0.50,
    keywords JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_topic (user_id, topic),
    INDEX idx_user_id (user_id),
    INDEX idx_topic (topic),
    INDEX idx_interest_level (interest_level DESC)
);

-- Notification settings table
CREATE TABLE notification_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    digest_notifications BOOLEAN DEFAULT TRUE,
    breaking_news_notifications BOOLEAN DEFAULT TRUE,
    notification_frequency JSON DEFAULT NULL,
    quiet_hours JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id)
);

-- Interest profiles table (for personalization)
CREATE TABLE interest_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    topic_interests JSON DEFAULT NULL,
    category_interests JSON DEFAULT NULL,
    source_type_interests JSON DEFAULT NULL,
    interaction_patterns JSON DEFAULT NULL,
    learning_rate DECIMAL(3,2) DEFAULT 0.10,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_last_updated (last_updated)
);

-- Credentials table (for external service authentication)
CREATE TABLE credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_type ENUM('rss', 'api', 'oauth', 'basic_auth') NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    expires_at DATETIME DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_service (user_id, service_name),
    INDEX idx_user_id (user_id),
    INDEX idx_service_name (service_name),
    INDEX idx_active (active)
);

-- Podcast-specific tables
CREATE TABLE podcasts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT DEFAULT NULL,
    author VARCHAR(255) DEFAULT NULL,
    language VARCHAR(10) DEFAULT 'en',
    category VARCHAR(100) DEFAULT NULL,
    image_url TEXT DEFAULT NULL,
    website_url TEXT DEFAULT NULL,
    rss_url TEXT NOT NULL,
    last_build_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    
    INDEX idx_source_id (source_id),
    INDEX idx_author (author),
    INDEX idx_category (category)
);

CREATE TABLE podcast_episodes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    podcast_id INT NOT NULL,
    content_id INT NOT NULL,
    episode_number INT DEFAULT NULL,
    season_number INT DEFAULT NULL,
    guid VARCHAR(255) UNIQUE NOT NULL,
    duration INT DEFAULT NULL,
    file_url TEXT DEFAULT NULL,
    file_size BIGINT DEFAULT NULL,
    file_type VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    INDEX idx_podcast_id (podcast_id),
    INDEX idx_content_id (content_id),
    INDEX idx_episode_number (episode_number)
);

CREATE TABLE podcast_transcripts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    episode_id INT NOT NULL,
    transcript_text LONGTEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    confidence_score DECIMAL(3,2) DEFAULT NULL,
    timestamps JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (episode_id) REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    
    INDEX idx_episode_id (episode_id),
    INDEX idx_language (language)
);