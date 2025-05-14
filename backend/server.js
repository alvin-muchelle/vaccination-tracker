import express from 'express';
import { ObjectId } from 'mongodb';
import { connectDB, getDB } from './db.js';
import cors from 'cors';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Global error handlers (should be first)
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Email setup (non-DB dependent)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Async server startup
const startServer = async () => {
  try {
    // Initialize database connection
    await connectDB();
    const db = getDB();

    // Create Express app after DB connection
    const app = express();
    const port = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Routes
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });

    app.get("/", (_req, res) => {
      res.status(200).send("Chanjo chonjo backend is running");
    });

    // JWT Authentication Middleware
    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) {
          console.error('JWT verify error:', err);
          return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = payload;
        next();
      });
    };

    // Signup Route
    app.post('/api/signup', async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const existingUser = await db.collection('mothers').findOne({ "user.email": email });
        if (existingUser) return res.status(409).json({ message: 'User exists' });

        const rawPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const newMother = {
          user: {
            email,
            hashed_password: hashedPassword,
            created_at: new Date(),
            must_reset_password: true
          },
          full_name: '',
          phone_number: '',
          babies: []
        };

        const result = await db.collection('mothers').insertOne(newMother);
        await sendTemporaryPassword(email, rawPassword);
        
        const token = jwt.sign(
          { userId: result.insertedId.toString(), email },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        res.status(201).json({ message: 'User registered', token });
      } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Reset Password Route
    app.post('/api/reset-password', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const { newPassword } = req.body;

        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = new ObjectId(decoded.userId);

        const newHashedPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('mothers').updateOne(
          { _id: userId },
          { $set: { 
            "user.hashed_password": newHashedPassword,
            "user.must_reset_password": false 
          } }
        );

        await sendPasswordResetConfirmation(decoded.email);
        res.status(200).json({ message: 'Password updated' });
      } catch (error) {
        console.error('Reset error:', error);
        res.status(401).json({ error: 'Invalid token' });
      }
    });

    // Login Route
    app.post('/api/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const mother = await db.collection('mothers').findOne({ "user.email": email });

        if (!mother) return res.status(400).json({ error: 'User not found' });
        if (!await bcrypt.compare(password, mother.user.hashed_password)) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { userId: mother._id.toString(), email: mother.user.email },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
          message: 'Login successful',
          token,
          userId: mother._id.toString(),
          mustResetPassword: mother.user.must_reset_password
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Profile Routes
    app.post('/api/profile', authenticateToken, async (req, res) => {
      try {
        const userId = new ObjectId(req.user.userId);
        const { fullName, phoneNumber, babyName, dateOfBirth, gender } = req.body;

        await db.collection('mothers').updateOne(
          { _id: userId },
          { $set: { full_name: fullName, phone_number: phoneNumber } }
        );

        if (babyName && dateOfBirth && gender) {
          const newBaby = {
            baby_id: new ObjectId(),
            name: babyName,
            date_of_birth: new Date(dateOfBirth),
            gender: gender.toLowerCase()
          };

          await db.collection('mothers').updateOne(
            { _id: userId },
            { $push: { babies: newBaby } }
          );
        }

        res.status(200).json({ message: 'Profile updated' });
      } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/profile', authenticateToken, async (req, res) => {
      try {
        const userId = new ObjectId(req.user.userId);
        const mother = await db.collection('mothers').findOne(
          { _id: userId },
          { projection: { "user.must_reset_password": 1, full_name: 1, phone_number: 1, babies: 1 } }
        );

        if (!mother) return res.status(404).json({ error: 'Profile not found' });

        const formattedBabies = mother.babies.map(baby => ({
          id: baby.baby_id.toString(),
          baby_name: baby.name,
          date_of_birth: baby.date_of_birth.toISOString().split('T')[0],
          gender: baby.gender
        }));

        res.json({
          mustResetPassword: mother.user.must_reset_password,
          profileComplete: !!mother.full_name && !!mother.phone_number && mother.babies.length > 0,
          mother: {
            full_name: mother.full_name,
            phone_number: mother.phone_number
          },
          babies: formattedBabies
        });
      } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Vaccination Schedule Routes
    app.get('/api/vaccination-schedule', async (_req, res) => {
      try {
        const schedules = await db.collection('vaccination_schedules')
          .find()
          .sort({ _id: 1 })
          .toArray();
        res.json(schedules);
      } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/vaccination-schedule/:age', async (req, res) => {
      try {
        const schedules = await db.collection('vaccination_schedules')
          .find({ age: req.params.age })
          .toArray();
        res.json(schedules);
      } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Reminder Management
    function parseAgeToDays(ageStr) {
    ageStr = ageStr.trim().toLowerCase();
    if (ageStr === 'birth') return 0;

    // map units to days
    const unitMap = {
        week: 7,
        weeks: 7,
        month: 30,
        months: 30,
        year: 365,
        years: 365,
    };

    // range like "15–18 months"
    const rangeRegex = /^(\d+)[–-](\d+)\s*(\w+)$/;
    const singleRegex = /^(\d+)\s*(\w+)$/;

    let match = ageStr.match(rangeRegex);
    if (match) {
        const [, start, end, unit] = match;
        const avg = (parseInt(start, 10) + parseInt(end, 10)) / 2;
        return avg * (unitMap[unit] || 0);
    }
    match = ageStr.match(singleRegex);
    if (match) {
        const [, num, unit] = match;
        return parseInt(num, 10) * (unitMap[unit] || 0);
    }
    // fallback: 0 days
    return 0;
    }

    app.post('/api/reminder/:babyId', authenticateToken, async (req, res) => {
        try {
            // Parse and validate babyId as integer
            const userId = new ObjectId(req.user.userId);
            const babyIdParam = req.params.babyId;
            const babyId = parseInt(babyIdParam, 10);
            if (Number.isNaN(babyId)) {
            return res.status(400).json({ error: 'Invalid babyId parameter' });
            }

            // Fetch mother document
            const mother = await db.collection('mothers').findOne({ _id: userId });
            if (!mother) {
            return res.status(404).json({ error: 'User not found' });
            }

            // Find the specified baby by integer baby_id
            const baby = mother.babies.find(b => b.baby_id === babyId);
            if (!baby) {
            return res.status(404).json({ error: 'Baby not found' });
            }
            const dob = new Date(baby.date_of_birth);

            // Remove any existing reminders for this baby
            await db.collection('reminders').deleteMany({ mother_id: userId, baby_id: babyId });

            // Fetch the vaccination schedule
            const schedule = await db.collection('vaccination_schedules').find().toArray();
            const now = new Date();
            const remindersToInsert = [];

            // Compute reminder entries
            for (let { age, vaccine } of schedule) {
            const daysOffset = parseAgeToDays(age);
            const vaccinationDate = new Date(dob);
            vaccinationDate.setDate(dob.getDate() + daysOffset);
            if (vaccinationDate <= now) continue;

            // One week before at 14:00
            const oneWeekBefore = new Date(vaccinationDate);
            oneWeekBefore.setDate(vaccinationDate.getDate() - 7);
            oneWeekBefore.setHours(14, 0, 0, 0);

            // One day before at 14:00
            const oneDayBefore = new Date(vaccinationDate);
            oneDayBefore.setDate(vaccinationDate.getDate() - 1);
            oneDayBefore.setHours(14, 0, 0, 0);

            // Queue weekly reminder
            remindersToInsert.push({
                type: 'weekly',
                mother_id: userId,
                baby_id: babyId,
                vaccine,
                vaccination_date: vaccinationDate,
                scheduled_at: oneWeekBefore,
                sent: false
            });

            // Queue daily reminder
            remindersToInsert.push({
                type: 'daily',
                mother_id: userId,
                baby_id: babyId,
                vaccine,
                vaccination_date: vaccinationDate,
                scheduled_at: oneDayBefore,
                sent: false
            });
            }

            // Bulk insert new reminders
            if (remindersToInsert.length) {
            await db.collection('reminders').insertMany(remindersToInsert);
            }

            return res.status(201).json({ message: 'Reminders regenerated successfully' });
        } catch (error) {
            console.error('Reminder error:', error);
            return res.status(500).json({ error: 'Server error while creating reminders' });
        }
    });

    // Cron Jobs
    async function sendCombinedReminderEmail(email, fullName, reminders) {
        const vaccinationDate = reminders[0].vaccination_date;
        const formattedDate = vaccinationDate.toDateString();

        const reminderList = reminders.map(reminder => `
            <li><strong>${reminder.vaccine}</strong></li>
        `).join('');

        await transporter.sendMail({
            from: `"Chanjo" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Vaccinations Required Next Week',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <p>Dear ${fullName},</p>
                <p>Here are your baby's vaccinations due on ${formattedDate}:</p>
                <ul>${reminderList}</ul>
                <p>Regards,<br/>Chanjo Team</p>
            </div>
            `
        });
    }

    // weekly job at 14:00 every day
    cron.schedule('0 14 * * *', async () => {
    try {
        const now = new Date();

        // Find all due, unsent weekly reminders and pull in mother info
        const weeklyReminders = await db
        .collection('reminders')
        .aggregate([
            { $match: { type: 'weekly', sent: false, scheduled_at: { $lte: now } } },
            {
            $lookup: {
                from: 'mothers',
                localField: 'mother_id',
                foreignField: '_id',
                as: 'mother'
            }
            },
            { $unwind: '$mother' },
            {
            $project: {
                _id: 1,
                vaccine: 1,
                vaccination_date: 1,
                full_name: '$mother.full_name',
                email: '$mother.user.email'
            }
            }
        ])
        .toArray();

        if (weeklyReminders.length === 0) return;

        // send one combined email for the batch
        await sendCombinedReminderEmail(
        weeklyReminders[0].email,
        weeklyReminders[0].full_name,
        weeklyReminders
        );

        // mark them all sent
        const ids = weeklyReminders.map(r => r._id);
        await db
        .collection('reminders')
        .updateMany(
            { _id: { $in: ids } },
            { $set: { sent: true } }
        );
    } catch (err) {
        console.error('Weekly cron error:', err);
    }
    });

    // daily job at 14:00 every day
    cron.schedule('0 14 * * *', async () => {
    try {
        const now = new Date();

        // Find all due, unsent daily reminders
        const dailyReminders = await db
        .collection('reminders')
        .aggregate([
            { $match: { type: 'daily', sent: false, scheduled_at: { $lte: now } } },
            {
            $lookup: {
                from: 'mothers',
                localField: 'mother_id',
                foreignField: '_id',
                as: 'mother'
            }
            },
            { $unwind: '$mother' },
            {
            $project: {
                _id: 1,
                vaccine: 1,
                vaccination_date: 1,
                full_name: '$mother.full_name',
                email: '$mother.user.email'
            }
            }
        ])
        .toArray();

        if (dailyReminders.length === 0) return;

        // send combined daily reminders
        await sendCombinedReminderEmail(
        dailyReminders[0].email,
        dailyReminders[0].full_name,
        dailyReminders
        );

        // mark them sent
        const ids = dailyReminders.map(r => r._id);
        await db
        .collection('reminders')
        .updateMany(
            { _id: { $in: ids } },
            { $set: { sent: true } }
        );
    } catch (err) {
        console.error('Daily cron error:', err);
    }
    });

    // Start server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Email helper functions (non-DB dependent)
async function sendTemporaryPassword(email, tempPassword) {
  await transporter.sendMail({
    from: `"Chanjo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Temporary Password',
    html: `...`
  });
}

async function sendPasswordResetConfirmation(email) {
  await transporter.sendMail({
    from: `"Chanjo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Changed',
    html: `...`
  });
}