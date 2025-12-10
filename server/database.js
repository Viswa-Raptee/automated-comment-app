const { Sequelize, DataTypes } = require('sequelize');
// Ensure you have a utils/crypto.js file or remove encryption if not needed
// const { encrypt, decrypt } = require('./utils/crypto'); 

// Simple mock crypto if you don't have the utils file
const encrypt = (text) => Buffer.from(text).toString('base64');
const decrypt = (hash) => Buffer.from(hash, 'base64').toString('ascii');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './unified.sqlite',
  logging: false
});

// --- 1. USER ---
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' }
});

const Account = sequelize.define('Account', {
  platform: { type: DataTypes.ENUM('youtube', 'instagram', 'whatsapp'), allowNull: false },
  name: { type: DataTypes.STRING },
  identifier: { type: DataTypes.STRING, unique: true },

  accessToken: {
    type: DataTypes.TEXT,
    get() { return this.getDataValue('accessToken') ? decrypt(this.getDataValue('accessToken')) : ''; },
    set(value) { this.setDataValue('accessToken', encrypt(value)); }
  },
  secondaryToken: {
    type: DataTypes.TEXT,
    get() { return this.getDataValue('secondaryToken') ? decrypt(this.getDataValue('secondaryToken')) : ''; },
    set(value) { this.setDataValue('secondaryToken', encrypt(value)); }
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

// --- 3. POST (Video/Media with Statistics) ---
const Post = sequelize.define('Post', {
  accountId: { type: DataTypes.INTEGER, allowNull: false },
  platform: { type: DataTypes.ENUM('youtube', 'instagram', 'whatsapp') },

  // Post Identifiers
  postId: { type: DataTypes.STRING, unique: true },  // External ID (YouTube videoId, Instagram media_id)
  postTitle: { type: DataTypes.STRING },
  mediaUrl: { type: DataTypes.TEXT },                 // Thumbnail URL
  embedUrl: { type: DataTypes.TEXT },                 // Full embed URL for iframe

  // Video/Post Statistics (from API)
  viewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  likeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  commentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  shareCount: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Published date
  publishedAt: { type: DataTypes.DATE },

  // Last synced timestamp
  lastSyncedAt: { type: DataTypes.DATE }
});

const Message = sequelize.define('Message', {
  platform: { type: DataTypes.ENUM('youtube', 'instagram', 'whatsapp') },
  accountId: { type: DataTypes.INTEGER },

  // IDs
  externalId: { type: DataTypes.STRING, unique: true }, // Comment ID

  // === FIELDS FOR MASTER-DETAIL VIEW ===
  postId: { type: DataTypes.STRING },      // ID of the Video/Post
  postTitle: { type: DataTypes.STRING },   // Title of the Video/Post
  mediaUrl: { type: DataTypes.TEXT },      // Thumbnail or Video URL
  // ========================================

  threadId: { type: DataTypes.STRING },    // For nested replies
  authorName: { type: DataTypes.STRING },
  authorId: { type: DataTypes.STRING },
  content: { type: DataTypes.TEXT },

  // RAG Data
  intent: { type: DataTypes.STRING },
  aiDraft: { type: DataTypes.TEXT },

  // Workflow
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'posted'), defaultValue: 'pending' },

  // Accountability
  approvedBy: { type: DataTypes.STRING },
  postedAt: { type: DataTypes.DATE },

  // === NEW: Comment Actions ===
  isImportant: { type: DataTypes.BOOLEAN, defaultValue: false },
  markedImportantBy: { type: DataTypes.STRING },
  assignedTo: { type: DataTypes.STRING },
  assignedBy: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  notesAddedBy: { type: DataTypes.STRING }
});

// --- 4. NOTIFICATION ---
const Notification = sequelize.define('Notification', {
  userId: { type: DataTypes.INTEGER, allowNull: false },      // Who should see this
  type: { type: DataTypes.ENUM('assignment', 'complaint', 'question', 'important'), allowNull: false },
  messageId: { type: DataTypes.INTEGER },                     // Related message
  accountId: { type: DataTypes.INTEGER },                     // Related account
  postId: { type: DataTypes.STRING },                         // Related post
  content: { type: DataTypes.TEXT },                          // Notification text
  fromUser: { type: DataTypes.STRING },                       // Who triggered this
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Relationships
Account.hasMany(Post, { foreignKey: 'accountId' });
Post.belongsTo(Account, { foreignKey: 'accountId' });

Account.hasMany(Message, { foreignKey: 'accountId' });
Message.belongsTo(Account, { foreignKey: 'accountId' });

User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

Notification.belongsTo(Message, { foreignKey: 'messageId' });

// Sync - manually add columns for SQLite compatibility
async function syncDatabase() {
  try {
    // First, sync to create tables that don't exist
    await sequelize.sync();

    // Manually add missing columns to existing tables (SQLite doesn't support full ALTER)
    const columnsToAdd = [
      // Message table
      { table: 'Messages', column: 'isImportant', type: 'INTEGER DEFAULT 0' },
      { table: 'Messages', column: 'markedImportantBy', type: 'TEXT' },
      { table: 'Messages', column: 'assignedTo', type: 'TEXT' },
      { table: 'Messages', column: 'assignedBy', type: 'TEXT' },
      { table: 'Messages', column: 'notes', type: 'TEXT' },
      { table: 'Messages', column: 'notesAddedBy', type: 'TEXT' },
      // Post table
      { table: 'Posts', column: 'viewCount', type: 'INTEGER DEFAULT 0' },
      { table: 'Posts', column: 'likeCount', type: 'INTEGER DEFAULT 0' },
      { table: 'Posts', column: 'commentCount', type: 'INTEGER DEFAULT 0' },
      { table: 'Posts', column: 'shareCount', type: 'INTEGER DEFAULT 0' },
      { table: 'Posts', column: 'embedUrl', type: 'TEXT' },
      { table: 'Posts', column: 'publishedAt', type: 'DATETIME' },
      { table: 'Posts', column: 'lastSyncedAt', type: 'DATETIME' },
    ];

    for (const { table, column, type } of columnsToAdd) {
      try {
        await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
        console.log(`✅ Added column ${column} to ${table}`);
      } catch (err) {
        // Column already exists - this is fine
        if (!err.message.includes('duplicate column')) {
          // Only log if it's not a duplicate column error
        }
      }
    }

    console.log("✅ Database Synced & Schema Updated");
  } catch (err) {
    console.error("❌ Database Sync Error:", err.message);
  }
}

syncDatabase();

module.exports = { sequelize, User, Account, Post, Message, Notification };