const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for Excel file uploads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database
const db = require('./db/database');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/student', require('./routes/student'));

// Serve static files (if needed later for production, but we use Vite dev server for now)
// app.use(express.static(path.join(__dirname, '../client/dist')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
