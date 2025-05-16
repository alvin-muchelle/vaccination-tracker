db = db.getSiblingDB('vaccination_tracker');

// ----------------------------------------------------------------------------
// 1. Create 'mothers' collection with schema validation
// ----------------------------------------------------------------------------
db.createCollection("mothers", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user", "full_name", "phone_number"],
      properties: {
        "user.email": {
          bsonType: "string",
          pattern: "^.+@.+\\..+$",
          description: "Must be a valid email and is required"
        },
        "user.hashed_password": {
          bsonType: "string",
          minLength: 8,
          description: "Password hash must be at least 8 characters"
        },
        "user.created_at": {
          bsonType: "date",
          description: "Account creation timestamp"
        },
        "user.must_reset_password": {
          bsonType: "bool",
          description: "Password reset flag"
        },
        "full_name": {
          bsonType: "string",
          minLength: 2,
          description: "Mother's full name"
        },
        "phone_number": {
          bsonType: "string",
          pattern: "^\\+?[0-9]{8,15}$",
          description: "Optional phone number"
        },
        "babies": {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["name", "date_of_birth"],
            properties: {
              "baby_id": {
                bsonType: "int",
                description: "Original PostgreSQL baby ID"
              },
              "name": {
                bsonType: "string",
                minLength: 1,
                description: "Baby's name"
              },
              "date_of_birth": {
                bsonType: "date",
                description: "Baby's birth date"
              },
              "gender": {
                enum: ["male", "female"],
                description: "Allowed gender values"
              }
            }
          }
        }
      }
    }
  }
});

// Indexes for mothers
db.mothers.createIndex({ "user.email": 1 }, { unique: true });
db.mothers.createIndex({ "phone_number": 1 }, { unique: true });
db.mothers.createIndex({ "babies.baby_id": 1 });

// ----------------------------------------------------------------------------
// 2. Create 'vaccination_schedules' collection
// ----------------------------------------------------------------------------
db.createCollection("vaccination_schedules", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["age", "vaccine", "protection_against"],
      properties: {
        age: { bsonType: "string" },
        vaccine: { bsonType: "string" },
        protection_against: { bsonType: "string" }
      }
    }
  }
});

// Unique compound index
db.vaccination_schedules.createIndex(
  { age: 1, vaccine: 1 },
  { unique: true, name: "unique_age_vaccine" }
);

// ----------------------------------------------------------------------------
// 3. Create 'reminders' collection with schema validation
// ----------------------------------------------------------------------------
db.createCollection("reminders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "mother_id", "vaccine", "vaccination_date", "scheduled_at"],
      properties: {
        type: { enum: ["daily", "weekly"] },
        mother_id: { bsonType: "objectId" },
        baby_id: { bsonType: "int" },
        vaccine: { bsonType: "string" },
        vaccination_date: { bsonType: "date" },
        scheduled_at: { bsonType: "date" },
        sent: { bsonType: "bool" }
      }
    }
  }
});

// Indexes for reminders
db.reminders.createIndex(
  { scheduled_at: 1, sent: 1 },
  { name: "pending_reminders" }
);

db.reminders.createIndex(
  { mother_id: 1, baby_id: 1, vaccine: 1, vaccination_date: 1, type: 1 },
  { 
    unique: true,
    partialFilterExpression: { sent: false },
    name: "unique_unsent_reminder" 
  }
);

print("Schema setup completed successfully!");