-- PlanetScale MySQL Schema for AI Information Aggregator
-- Based on existing MongoDB structure

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role ENUM('user', 'admin', 'editor', 'moderator') DEFAULT 'user',
    
    -- Profile information
    bio TEXT,
    avatar VARCHAR(500),
    organization VARCHAR(255),
    job_title VARCHAR(255),
    location VARCHAR(255),
    website VARCHAR(500),
    
    -- Preferences (stored as JSON for flexibility)
    preferences JSON,
    notifications JSON,
    
    -- Authentication fields
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    
    -- Activity tracking
    last_login DATETIME,
    login_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_email_verified (email_verified)
);

-- Sources table
CREATE TABLE sources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    type ENUM('website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss') NOT NULL,
    categories JSON, -- Array of category strings
    tags JSON, -- Array of tag strings
    relevance_score DECIMAL(3,2) DEFAULT 0.50,
    check_frequency ENUM('hourly', 'daily', 'weekly', 'monthly') DEFAULT 'daily',
    last_checked DATETIME,
    last_updated DATETIME,
    requires_authentication BOOLEAN DEFAULT FALSE,
    credentials_encrypted TEXT,
    credentials_iv VARCHAR(255),
    discovered_from INT,
    discovery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    content_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    last_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (discovered_from) REFERENCES sources(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_created_by (created_by),
    INDEX idx_type (type),
    INDEX idx_active (active),
    INDEX idx_check_frequency (check_frequency),
    INDEX idx_relevance_score (relevance_score),
    INDEX idx_url_hash (url(255)) -- Index first 255 chars of URL
);

-- Content table
CREATE TABLE content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_id INT NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    publish_date DATETIME,
    discovery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    type ENUM('article', 'paper', 'podcast', 'video', 'social') NOT NULL,
    categories JSON, -- Array of category strings
    topics JSON, -- Array of topic strings
    relevance_score DECIMAL(3,2) DEFAULT 0.50,
    summary TEXT,
    key_insights JSON, -- Array of insight strings
    full_text LONGTEXT,
    visual_elements JSON, -- Array of visual element objects
    metadata JSON, -- Flexible metadata storage
    processed BOOLEAN DEFAULT FALSE,
    outdated BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_source_id (source_id),
    INDEX idx_type (type),
    INDEX idx_relevance_score (relevance_score),
    INDEX idx_publish_date (publish_date),
    INDEX idx_discovery_date (discovery_date),
    INDEX idx_processed (processed),
    INDEX idx_url_hash (url(255)) -- Index first 255 chars of URL
);

-- Collections table
CREATE TABLE collections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    public BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#3498db', -- Hex color
    icon VARCHAR(50) DEFAULT 'folder',
    tags JSON, -- Array of tag strings
    parent_id INT,
    sort_order INT DEFAULT 0,
    view_count INT DEFAULT 0,
    last_viewed DATETIME,
    metadata JSON,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_public_featured (public, featured),
    INDEX idx_parent_id (parent_id),
    UNIQUE KEY unique_user_collection (user_id, name)
);

-- Collection content junction table (many-to-many)
CREATE TABLE collection_content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    collection_id INT NOT NULL,
    content_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_collection_id (collection_id),
    INDEX idx_content_id (content_id),
    UNIQUE KEY unique_collection_content (collection_id, content_id)
);

-- Collection collaborators table
CREATE TABLE collection_collaborators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    collection_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('viewer', 'editor', 'admin') DEFAULT 'viewer',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_collection_id (collection_id),
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_collection_collaborator (collection_id, user_id)
);

-- References table (for content references)
CREATE TABLE references (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_id INT NOT NULL,
    referenced_content_id INT,
    external_url TEXT,
    title VARCHAR(500),
    type ENUM('internal', 'external', 'citation') NOT NULL,
    context TEXT, -- Context where reference appears
    confidence_score DECIMAL(3,2) DEFAULT 0.50,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (referenced_content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_content_id (content_id),
    INDEX idx_referenced_content_id (referenced_content_id),
    INDEX idx_type (type)
);

-- User interactions table (for tracking user behavior)
CREATE TABLE interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    content_id INT NOT NULL,
    type ENUM('view', 'like', 'save', 'share', 'comment', 'rate') NOT NULL,
    value VARCHAR(255), -- For ratings, comments, etc.
    duration INT, -- Time spent (in seconds)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_content_id (content_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

-- Content metadata table (for detailed metadata)
CREATE TABLE content_metadata (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_id INT NOT NULL,
    word_count INT,
    reading_time INT, -- Estimated reading time in minutes
    language VARCHAR(10),
    sentiment_score DECIMAL(3,2),
    complexity_score DECIMAL(3,2),
    quality_score DECIMAL(3,2),
    extracted_entities JSON, -- Named entities
    extracted_keywords JSON, -- Keywords
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_content_id (content_id),
    INDEX idx_language (language),
    INDEX idx_quality_score (quality_score)
);

-- Credentials table (for source authentication)
CREATE TABLE credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    source_id INT,
    service_name VARCHAR(100) NOT NULL,
    credential_type ENUM('api_key', 'oauth', 'basic_auth', 'token') NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(255) NOT NULL,
    expires_at DATETIME,
    last_used DATETIME,
    active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_source_id (source_id),
    INDEX idx_service_name (service_name),
    INDEX idx_active (active)
);

-- Categories table (for organizing sources and content)
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    color VARCHAR(7) DEFAULT '#3498db',
    icon VARCHAR(50),
    parent_id INT,
    sort_order INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_parent_id (parent_id),
    INDEX idx_name (name)
);

-- Podcasts table (for podcast-specific data)
CREATE TABLE podcasts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    host VARCHAR(255),
    rss_url TEXT,
    website_url TEXT,
    image_url TEXT,
    language VARCHAR(10),
    category VARCHAR(100),
    explicit BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_source_id (source_id),
    INDEX idx_category (category)
);

-- Episodes table (for podcast episodes)
CREATE TABLE episodes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    podcast_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    audio_url TEXT,
    duration INT, -- Duration in seconds
    episode_number INT,
    season_number INT,
    publish_date DATETIME,
    transcript_available BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_podcast_id (podcast_id),
    INDEX idx_publish_date (publish_date),
    INDEX idx_episode_number (episode_number)
);

-- Transcripts table (for podcast transcripts)
CREATE TABLE transcripts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    episode_id INT NOT NULL,
    content LONGTEXT NOT NULL,
    timestamps JSON, -- Array of timestamp objects
    confidence_score DECIMAL(3,2),
    language VARCHAR(10),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_episode_id (episode_id),
    FULLTEXT KEY ft_content (content)
);

-- User preferences tables (for detailed preference management)
CREATE TABLE topic_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    topic VARCHAR(100) NOT NULL,
    interest_level DECIMAL(3,2) DEFAULT 0.50,
    priority INT DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_topic (topic),
    UNIQUE KEY unique_user_topic (user_id, topic)
);

-- Content volume settings
CREATE TABLE content_volume_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    daily_limit INT DEFAULT 10,
    weekly_limit INT DEFAULT 70,
    priority_sources_only BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_settings (user_id)
);

-- Discovery settings
CREATE TABLE discovery_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    aggressiveness DECIMAL(3,2) DEFAULT 0.50,
    enable_related_content BOOLEAN DEFAULT TRUE,
    enable_trending_topics BOOLEAN DEFAULT TRUE,
    enable_similar_sources BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_discovery (user_id)
);

-- Summary preferences
CREATE TABLE summary_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    length ENUM('short', 'medium', 'long') DEFAULT 'medium',
    include_key_insights BOOLEAN DEFAULT TRUE,
    include_quotes BOOLEAN DEFAULT FALSE,
    include_statistics BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_summary (user_id)
);

-- Digest scheduling
CREATE TABLE digest_scheduling (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    frequency ENUM('daily', 'weekly', 'never') DEFAULT 'daily',
    time_of_day TIME DEFAULT '09:00:00',
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') DEFAULT 'monday',
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_sent DATETIME,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_digest (user_id)
);

-- Notification settings
CREATE TABLE notification_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    digest_enabled BOOLEAN DEFAULT TRUE,
    new_content_threshold INT DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_notifications (user_id)
);

-- Interest profiles (for personalization)
CREATE TABLE interest_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    topics JSON, -- Array of topic objects with weights
    sources JSON, -- Array of preferred source objects
    content_types JSON, -- Array of preferred content types
    reading_speed INT DEFAULT 200, -- Words per minute
    expertise_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_profile (user_id)
);