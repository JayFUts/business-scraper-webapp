// MongoDB initialization script
db = db.getSiblingDB('business-scraper');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'name'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Must be at least 6 characters'
        },
        name: {
          bsonType: 'string',
          minLength: 2,
          description: 'Must be at least 2 characters'
        },
        subscription: {
          enum: ['FREE', 'PREMIUM'],
          description: 'Must be either FREE or PREMIUM'
        },
        credits: {
          bsonType: 'int',
          minimum: 0,
          description: 'Must be a non-negative integer'
        }
      }
    }
  }
});

db.createCollection('searchjobs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['businessType', 'location', 'status'],
      properties: {
        businessType: {
          bsonType: 'string',
          minLength: 2,
          description: 'Must be at least 2 characters'
        },
        location: {
          bsonType: 'string',
          minLength: 2,
          description: 'Must be at least 2 characters'
        },
        status: {
          enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
          description: 'Must be a valid status'
        },
        resultsCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Must be a non-negative integer'
        }
      }
    }
  }
});

db.createCollection('businesses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['searchId', 'name', 'address', 'source'],
      properties: {
        searchId: {
          bsonType: 'string',
          description: 'Must be a valid search ID'
        },
        name: {
          bsonType: 'string',
          minLength: 1,
          description: 'Business name is required'
        },
        address: {
          bsonType: 'string',
          minLength: 1,
          description: 'Address is required'
        },
        source: {
          enum: ['GOOGLE_MAPS', 'WEBSITE_SCAN'],
          description: 'Must be a valid source'
        },
        emails: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
          },
          description: 'Must be an array of valid email addresses'
        }
      }
    }
  }
});

// Create indexes for performance
db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'createdAt': -1 });

db.searchjobs.createIndex({ 'createdAt': -1 });
db.searchjobs.createIndex({ 'status': 1, 'createdAt': -1 });
db.searchjobs.createIndex({ 'userId': 1, 'createdAt': -1 });

db.businesses.createIndex({ 'searchId': 1, 'createdAt': -1 });
db.businesses.createIndex({ 'name': 1 });
db.businesses.createIndex({ 'emails.0': 1 });
db.businesses.createIndex({ 'searchId': 1, 'name': 1, 'address': 1 }, { unique: true });

// Create demo user
db.users.insertOne({
  name: 'Demo User',
  email: 'demo@businessscraper.com',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8xjyqvXDqm', // demo123
  subscription: 'FREE',
  credits: 100,
  createdAt: new Date()
});

print('MongoDB initialization completed successfully!');