const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'leadfinders.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        credits INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Purchases table
    db.run(`
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        credits INTEGER NOT NULL,
        amount REAL NOT NULL,
        stripe_session_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Usage history table
    db.run(`
      CREATE TABLE IF NOT EXISTS usage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        search_query TEXT NOT NULL,
        credits_used INTEGER NOT NULL,
        results_count INTEGER,
        session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    
    // Sent emails table
    db.run(`
      CREATE TABLE IF NOT EXISTS sent_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        recipient_email TEXT NOT NULL,
        business_name TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'sent',
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    console.log('✅ Database tables initialized');
  });
}

// User management functions
const userFunctions = {
  // Create new user
  createUser: async (email, password) => {
    return new Promise((resolve, reject) => {
      const passwordHash = bcrypt.hashSync(password, 10);
      
      db.run(
        'INSERT INTO users (email, password_hash, credits) VALUES (?, ?, ?)',
        [email, passwordHash, 0],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              email,
              credits: 0
            });
          }
        }
      );
    });
  },

  // Find user by email
  findUserByEmail: async (email) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, password_hash, credits FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  // Find user by ID
  findUserById: async (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, credits FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  // Verify password
  verifyPassword: (password, hash) => {
    return bcrypt.compareSync(password, hash);
  },

  // Update user credits
  updateCredits: async (userId, credits) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [credits, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  },

  // Add credits to user
  addCredits: async (userId, creditsToAdd) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [creditsToAdd, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  },

  // Deduct credits from user
  deductCredits: async (userId, creditsToDeduct) => {
    return new Promise((resolve, reject) => {
      // First check if user has enough credits
      db.get(
        'SELECT credits FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!row || row.credits < creditsToDeduct) {
            reject(new Error('Insufficient credits'));
            return;
          }
          
          // Deduct credits
          db.run(
            'UPDATE users SET credits = credits - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [creditsToDeduct, userId],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(row.credits - creditsToDeduct);
              }
            }
          );
        }
      );
    });
  }
};

// Purchase functions
const purchaseFunctions = {
  // Record purchase
  recordPurchase: async (userId, creditsBought, amountPaid, stripeSessionId) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO purchases (user_id, credits_bought, amount_paid, stripe_session_id, status) VALUES (?, ?, ?, ?, ?)',
        [userId, creditsBought, amountPaid, stripeSessionId, 'completed'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  },

  // Get purchase history
  getPurchaseHistory: async (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
};

// Usage tracking functions
const usageFunctions = {
  // Record usage
  recordUsage: async (userId, searchQuery, creditsUsed, resultsCount, sessionId) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO usage_history (user_id, search_query, credits_used, results_count, session_id) VALUES (?, ?, ?, ?, ?)',
        [userId, searchQuery, creditsUsed, resultsCount || 0, sessionId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  },

  // Get usage history
  getUsageHistory: async (userId, limit = 10) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM usage_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
};

// Initialize database on startup
initDatabase();

module.exports = {
  db,
  user: userFunctions,
  purchase: purchaseFunctions,
  usage: usageFunctions
};