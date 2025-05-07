const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// set up email 
const nodemailer = require('nodemailer');

async function sendTestEmail(to, password) {
  const testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const info = await transporter.sendMail({
    from: '"Vaccination Tracker" <no-reply@vtracker.com>',
    to,
    subject: 'Your Temporary Password',
    text: `Welcome to the Vaccination Tracker.\n\nYour temporary password is: ${password}`,
  });

  console.log("Email sent! Preview it here:", nodemailer.getTestMessageUrl(info));
}


// Initialize express app
const app = express();
const port = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection setup
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test DB connection
pool.connect()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.log('Error connecting to DB:', err));

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
    await sendTestEmail(email, rawPassword);

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

    res.status(200).json({ message: 'Password updated successfully' });
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
  const token = authHeader?.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
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
    // Check if mother exists
    const motherResult = await pool.query('SELECT id FROM mothers WHERE user_id = $1', [userId]);

    let motherId;
    if (motherResult.rows.length === 0) {
      // Insert new mother
      const insertMother = await pool.query(
        `INSERT INTO mothers (user_id, full_name, phone_number)
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, fullName, phoneNumber]
      );
      motherId = insertMother.rows[0].id;
    } else {
      // Update existing mother
      motherId = motherResult.rows[0].id;
      await pool.query(
        `UPDATE mothers SET full_name = $1, phone_number = $2
         WHERE user_id = $3`,
        [fullName, phoneNumber, userId]
      );
    }

    // Check if a baby already exists for this mother
    const babyResult = await pool.query('SELECT id FROM babies WHERE mother_id = $1', [motherId]);

    if (babyResult.rows.length === 0) {
      // Insert baby
      await pool.query(
        `INSERT INTO babies (mother_id, baby_name, date_of_birth, gender)
         VALUES ($1, $2, $3, $4)`,
        [motherId, babyName, dateOfBirth, genderNormalized]
      );
    } else {
      // Update existing baby
      await pool.query(
        `UPDATE babies SET baby_name = $1, date_of_birth = $2, gender = $3
         WHERE mother_id = $4`,
        [babyName, dateOfBirth, genderNormalized, motherId]
      );
    }

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
    // Get user data
    const userResult = await pool.query('SELECT must_reset_password FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Get mother's profile
    const motherResult = await pool.query(
      'SELECT id, full_name, phone_number FROM mothers WHERE user_id = $1',
      [userId]
    );

    if (motherResult.rows.length === 0) {
      return res.status(200).json({
        mustResetPassword: user.must_reset_password,
        profileComplete: false,
        mother: null,
        baby: null,
      });
    }

    const mother = motherResult.rows[0];

    // Get baby profile
    const babyResult = await pool.query(
      'SELECT baby_name, date_of_birth, gender FROM babies WHERE mother_id = $1',
      [mother.id]
    );

    const baby = babyResult.rows[0] || null;

    res.status(200).json({
      mustResetPassword: user.must_reset_password,
      profileComplete: !!(mother.full_name && mother.phone_number && baby?.baby_name && baby?.date_of_birth && baby?.gender),
      mother,
      baby,
    });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Error fetching profile' });
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

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
