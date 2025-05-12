import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

dotenv.config();

// global error handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// set up email 
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendTemporaryPassword(email, tempPassword) {
  await transporter.sendMail({
    from: `"Chanjo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Temporary Password',
    html: `
      <p>Hello,</p>
      <p>Welcome to Chanjo! Here's your temporary password:</p>
      <p><strong>${tempPassword}</strong></p>
      <p>Please log in and reset your password within 15 minutes.</p>
      <p>Best,<br/>Chanjo</p>
    `,
  });
}

async function sendPasswordResetConfirmation(email) {
  await transporter.sendMail({
    from: `"Chanjo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your password has been changed',
    html: `
      <p>Hello,</p>
      <p>This is a confirmation that your password was successfully changed.</p>
      <p>If you did not perform this action, please contact support immediately.</p>
      <p>Regards,<br/>Chanjo</p>
    `,
  });
}

// Initialize express app
const app = express();
const port = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection setup
const { PGUSER, PGPASSWORD, PGHOST, PGPORT, POSTGRES_DB } = process.env;
const connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${POSTGRES_DB}`;

console.log(connectionString);
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Test DB connection
pool.connect()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.log('Error connecting to DB:', err));

// health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// respond on root
app.get("/", (_req, res) => {
  res.status(200).send("Chanjo chonjo backend is running");
});

// Enable graceful shutdown logs
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Signup Route
app.post('/api/signup', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists. Please log in.' });
    }

    // Generate a random password
    const rawPassword = crypto.randomBytes(8).toString('hex'); // 16-character password

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

    // Insert user into database
    const newUser = await pool.query(
      'INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id',
      [email, hashedPassword]
    );

    // Send the temporary password via email
    await sendTemporaryPassword(email, rawPassword);

    // Generate a short-lived token for password reset
    const token = jwt.sign({ userId: newUser.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.status(201).json({
      message: 'User registered successfully. A temporary password has been emailed.',
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// Reset Password Route
app.post('/api/reset-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { newPassword } = req.body;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    // Hash the new password
    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await pool.query(
      'UPDATE users SET hashed_password = $1, must_reset_password = false WHERE email = $2',
      [newHashedPassword, email]
    );

    // Send confirmation email
    await sendPasswordResetConfirmation(email);

    res.status(200).json({ message: 'Password updated and confirmation email sent' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }    
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Compare entered password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a long-lived token for general usage
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      userId: user.id,
      mustResetPassword: user.must_reset_password,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Middleware for JWT verification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  console.log('--- authHeader:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      console.error('JWT verify error:', err);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('--- JWT payload:', payload);
    req.user = payload;
    next();
  });
}

// Create/Update Profile Route
app.post('/api/profile', authenticateToken, async (req, res) => {
  const { fullName, phoneNumber, babyName, dateOfBirth, gender } = req.body;
  const userId = req.user.userId;

  const genderNormalized = gender.toLowerCase();
  const allowedGenders = ['male', 'female'];

  if (!allowedGenders.includes(genderNormalized)) {
    return res.status(400).json({ error: 'Invalid gender. Must be "Male" or "Female".' });
  }

  try {
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const parsedDate = new Date(dateOfBirth + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Check if mother exists
    const motherResult = await pool.query('SELECT id FROM mothers WHERE user_id = $1', [userId]);

    let motherId;
    if (motherResult.rows.length === 0) {
      const insertMother = await pool.query(
        `INSERT INTO mothers (user_id, full_name, phone_number)
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, fullName, phoneNumber]
      );
      motherId = insertMother.rows[0].id;
    } else {
      motherId = motherResult.rows[0].id;
      await pool.query(
        `UPDATE mothers SET full_name = $1, phone_number = $2
         WHERE user_id = $3`,
        [fullName, phoneNumber, userId]
      );
    }

    // Check if Baby exists
    const existingBaby = await pool.query(
      `SELECT id FROM babies WHERE mother_id = $1 AND baby_name = $2`,
      [motherId, babyName]
    );

    if (existingBaby.rows.length > 0) {
      return res.status(400).json({ error: 'Baby name already exists for this mother' });
    }

    // Always insert a new baby
    await pool.query(
      `INSERT INTO babies (mother_id, baby_name, date_of_birth, gender)
       VALUES ($1, $2, $3, $4)`,
      [motherId, babyName, parsedDate, genderNormalized]
    );

    res.status(200).json({ message: 'Profile saved successfully' });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error while saving profile' });
  }
});


// Get Profile Route
app.get('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Fetch user
    const userRes = await pool.query(
      'SELECT must_reset_password FROM users WHERE id = $1',
      [userId]
    );
    const mustResetPassword = userRes.rows[0].must_reset_password;

    // Fetch mother
    const motherRes = await pool.query(
      'SELECT id, full_name, phone_number FROM mothers WHERE user_id = $1',
      [userId]
    );
    if (!motherRes.rows.length) {
      return res.json({ mustResetPassword, profileComplete: false, mother: null, babies: [] });
    }
    const mother = motherRes.rows[0];

    // Fetch all babies for this mother
    const babiesRes = await pool.query(
      'SELECT id, baby_name, date_of_birth, gender FROM babies WHERE mother_id = $1',
      [mother.id]
    );

    // Format dates and shape
    const babies = babiesRes.rows.map(b => ({
      id: b.id,
      baby_name: b.baby_name,
      gender: b.gender,
      date_of_birth: b.date_of_birth
      ? (() => {
        const d = b.date_of_birth;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
      })()
      : null
    }));

    const profileComplete = !!(
      mother.full_name &&
      mother.phone_number &&
      babies.length > 0
    );

    res.json({ mustResetPassword, profileComplete, mother, babies });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Update Baby's Date of Birth
app.put('/api/baby/:id/birth-date', authenticateToken, async (req, res) => {
  const motherUserId = req.user.userId;
  const babyId = parseInt(req.params.id, 10);
  const { birthDate } = req.body;

  if (!birthDate) {
    return res.status(400).json({ error: 'birthDate is required' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    // Parse as UTC date to avoid timezone issues
    const parsedDate = new Date(birthDate + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // ensure this baby belongs to the authenticated user's mother record
    const m = await pool.query(
      `SELECT b.id
       FROM babies b
       JOIN mothers m ON m.id = b.mother_id
       WHERE b.id = $1 AND m.user_id = $2`,
      [babyId, motherUserId]
    );
    
    if (m.rows.length === 0) {
      return res.status(404).json({ error: 'Baby not found or unauthorized' });
    }

    // perform the update with the parsed date
    await pool.query(
      'UPDATE babies SET date_of_birth = $1 WHERE id = $2',
      [parsedDate, babyId]
    );

    res.json({ 
      message: 'Date of birth updated',
      date_of_birth: birthDate
    });
  } catch (err) {
    console.error('PUT /api/baby/:id/birth-date error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch the full vaccination schedule
app.get('/api/vaccination-schedule', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vaccination_schedule ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching vaccination schedule' });
  }
});

// Fetch by age group
app.get('/api/vaccination-schedule/:age', async (req, res) => {
  const { age } = req.params;
  try {
    const result = await pool.query('SELECT * FROM vaccination_schedule WHERE age = $1', [age]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching schedule for given age' });
  }
});

// Helper: parse an age string into days
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
  const userId   = req.user.userId;
  const babyId   = parseInt(req.params.babyId, 10);

  if (Number.isNaN(babyId)) {
    return res.status(400).json({ error: "Invalid babyId parameter" });
  }
  
  try {
    // verify baby belongs to this user
    const vb = await pool.query(
      `SELECT b.date_of_birth
         FROM babies b
         JOIN mothers m ON m.id = b.mother_id
        WHERE b.id = $1 AND m.user_id = $2`,
      [babyId, userId]
    );
    if (!vb.rows.length) return res.status(404).json({ error: 'Baby not found' });

    const dob = new Date(vb.rows[0].date_of_birth);

    // remove any existing reminders for this baby
    await pool.query('DELETE FROM weekly_reminders WHERE mother_id = (SELECT id FROM mothers WHERE user_id=$1) AND baby_id=$2', [userId, babyId]);

    await pool.query('DELETE FROM daily_reminders WHERE mother_id = (SELECT id FROM mothers WHERE user_id=$1) AND baby_id=$2', [userId, babyId]);

    // re‑compute and insert
    const sched = await pool.query('SELECT age, vaccine FROM vaccination_schedule');
    const now   = new Date();

    for (let { age, vaccine } of sched.rows) {
      const daysOffset     = parseAgeToDays(age);
      const vaccinationDate= new Date(dob);
      vaccinationDate.setDate(dob.getDate() + daysOffset);
      if (vaccinationDate <= now) continue;

      const oneWeekBefore  = new Date(vaccinationDate);
      oneWeekBefore.setDate(vaccinationDate.getDate() - 7);
      oneWeekBefore.setHours(14,0,0,0);

      const oneDayBefore   = new Date(vaccinationDate);
      oneDayBefore.setDate(vaccinationDate.getDate() - 1);
      oneDayBefore.setHours(14,0,0,0);

      await pool.query(
        `INSERT INTO weekly_reminders(mother_id,baby_id,vaccine,vaccination_date,scheduled_at,sent)
               VALUES(
                 (SELECT id FROM mothers WHERE user_id=$1),
                 $2,$3,$4,$5,false
               )`,
        [userId,babyId,vaccine,vaccinationDate,oneWeekBefore]
      );
      await pool.query(
        `INSERT INTO daily_reminders(mother_id,baby_id,vaccine,vaccination_date,scheduled_at,sent)
               VALUES(
                 (SELECT id FROM mothers WHERE user_id=$1),
                 $2,$3,$4,$5,false
               )`,
        [userId,babyId,vaccine,vaccinationDate,oneDayBefore]
      );
    }

    res.status(201).json({ message: 'Reminders regenerated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while creating reminders' });
  }
});


// helper to actually send a reminder email
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

// weekly job at 1400hrs every day
cron.schedule('0 14 * * *', async () => {
  const now = new Date();
  const res = await pool.query(
    `SELECT r.id, r.vaccine, r.vaccination_date, m.full_name, u.email
       FROM weekly_reminders r
       JOIN mothers m ON m.id = r.mother_id
       JOIN users u   ON u.id = m.user_id
      WHERE r.sent = false AND r.scheduled_at <= $1
    `, [now]
  );

  const reminders = res.rows;
  if (reminders.length === 0) return;

  // send one combined email for the entire batch
  await sendCombinedReminderEmail(
    reminders[0].email,
    reminders[0].full_name,
    reminders
  );

  // mark them all sent in a single UPDATE
  const ids = reminders.map(r => r.id);
  await pool.query(
    `UPDATE weekly_reminders SET sent = true WHERE id = ANY($1)`,
    [ids]
  );
});

// daily job at 14:00 every day
cron.schedule('0 14 * * *', async () => {
  const now = new Date();
  const res = await pool.query(
    `SELECT r.id, r.vaccine, r.vaccination_date, m.full_name, u.email
       FROM daily_reminders r
       JOIN mothers m ON m.id = r.mother_id
       JOIN users u   ON u.id = m.user_id
      WHERE r.sent = false AND r.scheduled_at <= $1
    `, [now]
  );

  const reminders = res.rows;
  if (reminders.length === 0) return;

  await sendCombinedReminderEmail(
    reminders[0].email,
    reminders[0].full_name,
    reminders
  );

  const ids = reminders.map(r => r.id);
  await pool.query(
    `UPDATE daily_reminders SET sent = true WHERE id = ANY($1)`,
    [ids]
  );
});

// Start the server
app.listen(port, '::', () => {
    console.log(`Server running on [::]${port}`);
});