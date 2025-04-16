const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    ref: 'User'
  },
  recipient: {
    type: String,
    required: true,
    ref: 'User'
  },
  content: {
    type: String,
    required: true
  },
  encrypted: {
    type: Boolean,
    default: true
  },
  groupId: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'deleted'],
    default: 'sent'
  },
  deliveredAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: String,
    ref: 'User'
  },
  // For soft delete - message will be hidden but not removed from database
  isDeleted: {
    type: Boolean,
    default: false
  },
  // For group messages or broadcast messages
  recipients: [{
    userId: {
      type: String,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'deleted'],
      default: 'sent'
    },
    deliveredAt: Date,
    readAt: Date
  }]
});

// Index for faster queries
messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
messageSchema.index({ groupId: 1, timestamp: -1 });

// Method to soft delete a message
messageSchema.methods.softDelete = async function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.status = 'deleted';
  await this.save();
};

// Static method to get chat history
messageSchema.statics.getChatHistory = async function(userId1, userId2, limit = 50, skip = 0) {
  return this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 }
    ],
    isDeleted: false
  })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
};

// Static method to get undelivered messages for a user
messageSchema.statics.getUndeliveredMessages = async function(userId) {
  return this.find({
    recipient: userId,
    status: 'sent',
    isDeleted: false
  }).sort({ timestamp: 1 });
};

module.exports = mongoose.model('Message', messageSchema);
