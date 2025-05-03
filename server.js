const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

// Initialize express app
const app = express();
const port = process.env.PORT || 5000;

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
