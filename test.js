import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import csv from 'csv-parser';
import morgan from 'morgan';
import Fuse from 'fuse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '192.168.1.3'; // Use environment variable for flexibility

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev')); // Logs requests for debugging

const questionsAndAnswers = [];
const csvFilePath = path.join(__dirname, 'data.csv');

// Load data from CSV before starting server
const loadCSV = async () => {
    try {
        const data = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => data.push(row))
                .on('end', () => {
                    console.log('✅ CSV file successfully processed');
                    resolve(data);
                })
                .on('error', (error) => reject(error));
        });
    } catch (error) {
        console.error('❌ Error loading CSV:', error);
        throw error;
    }
};

// Initialize CSV data
(async () => {
    try {
        const data = await loadCSV();
        questionsAndAnswers.push(...data);
        updateFuseIndex();
    } catch (err) {
        console.error('❌ Failed to load CSV:', err);
    }
})();

// Fuzzy search setup
const fuseOptions = {
    keys: ['question'],
    threshold: 0.4, // Adjust for better matching
};
let fuse = new Fuse(questionsAndAnswers, fuseOptions);

// Refresh Fuse index when CSV data is updated
const updateFuseIndex = () => {
    fuse = new Fuse(questionsAndAnswers, fuseOptions);
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple greeting endpoint
app.get('/message', (req, res) => {
    const name = req.query.name || 'Guest';
    res.json({ message: `Hello, ${name}! 🤖` });
});

// Fetch all questions and answers
app.get('/questions', (req, res) => {
    if (!questionsAndAnswers.length) {
        return res.status(503).json({ error: 'Data is still loading, please try again later!' });
    }
    res.json(questionsAndAnswers);
});

// Fetch answer for a specific question with fuzzy matching
app.get('/answer', (req, res) => {
    const query = req.query.question;
    if (!query) {
        return res.status(400).json({ error: 'Please provide a question parameter!' });
    }

    const results = fuse.search(query);
    if (results.length > 0) {
        const bestMatch = results[0].item;
        return res.json({ question: bestMatch.question, answer: bestMatch.answer });
    }

    res.status(404).json({ error: 'No matching question found!' });
});

// Live reload endpoint (useful for development)
app.get('/reload', async (req, res) => {
    try {
        questionsAndAnswers.length = 0; // Clear current data
        const data = await loadCSV();
        questionsAndAnswers.push(...data);
        updateFuseIndex();
        res.json({ message: 'CSV data reloaded successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reload CSV data!' });
    }
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`✅ Server running at http://${HOST}:${PORT}/`);
});
