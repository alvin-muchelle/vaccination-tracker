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
    await pool.query(
      'INSERT INTO users (email, hashed_password) VALUES ($1, $2)',
      [email, hashedPassword]
    );

    // Send the temporary password via email
    await sendTestEmail(email, rawPassword);

    res.status(201).json({
      message: 'User registered successfully. A temporary password has been emailed.',
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

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      userId: user.id,
      mustResetPassword: user.must_reset_password, // <-- ✅ Include this line
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});


// Baby and Vaccination Routes
app.get('/api/babies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM babies');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching babies' });
  }
});

app.get('/api/vaccinations/:baby_id', async (req, res) => {
  const { baby_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM vaccinations WHERE baby_id = $1', [baby_id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching vaccinations' });
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
