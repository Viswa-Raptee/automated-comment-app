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

// --- 2. ACCOUNT ---
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

const Message = sequelize.define('Message', {
  platform: { type: DataTypes.ENUM('youtube', 'instagram', 'whatsapp') },
  accountId: { type: DataTypes.INTEGER },
  
  // IDs
  externalId: { type: DataTypes.STRING, unique: true }, // Comment ID
  
  // === NEW FIELDS FOR MASTER-DETAIL VIEW ===
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
  postedAt: { type: DataTypes.DATE }
});

// Relationships
Account.hasMany(Message, { foreignKey: 'accountId' });
Message.belongsTo(Account, { foreignKey: 'accountId' });

// Sync
sequelize.sync().then(() => console.log("✅ Database Synced & Schema Updated"));

module.exports = { sequelize, User, Account, Message };