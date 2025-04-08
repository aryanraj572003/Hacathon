const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { predictNextWord, analyzeReadingData } = require('./ml');

const app = express();
const PORT = process.env.PORT || 5000;

// ML API URL (Flask server)
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// API for word prediction
app.post('/api/predict', async (req, res) => {
    const { partialWord } = req.body;
    if (!partialWord) {
        return res.status(400).json({ error: 'Partial word is required' });
    }
    
    try {
        // Forward request to ML API
        const response = await axios.post(`${ML_API_URL}/api/predict`, {
            partialWord
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error in predict endpoint:', error.message);
        res.status(500).json({ error: 'Failed to get word prediction' });
    }
});

// API for analyzing reading data
app.post('/api/analyze', async (req, res) => {
    const { 
        readingTime, 
        wpm, 
        difficultWords, 
        wordTimings,
        userId 
    } = req.body;
    
    if (!readingTime || !wpm) {
        return res.status(400).json({ error: 'Reading time and WPM are required' });
    }
    
    try {
        // Forward request to ML API
        const response = await axios.post(`${ML_API_URL}/api/analyze`, {
            readingTime,
            wpm,
            difficultWords,
            wordTimings,
            userId: userId || 'anonymous'
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error in analyze endpoint:', error.message);
        res.status(500).json({ 
            error: 'Failed to analyze reading data',
            // Return fallback recommendations if ML API fails
            recommendations: getFallbackRecommendations(wpm, difficultWords ? difficultWords.length : 0)
        });
    }
});

// API for getting paragraph recommendations for specific users
app.get('/api/recommendations/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Forward request to ML API
        const response = await axios.get(`${ML_API_URL}/api/recommendations/${userId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting recommendations:', error.message);
        res.status(500).json({ 
            error: 'Failed to get recommendations',
            topics: ["general", "basic vocabulary"]
        });
    }
});

// API for retrieving dyslexia-friendly paragraphs based on topics
app.get('/api/paragraphs', async (req, res) => {
    const { topics, count = 1 } = req.query;
    
    try {
        // Use topics to fetch appropriate paragraphs
        let paragraphs = [];
        
        if (topics) {
            // Try to get paragraphs related to the given topics using an external API
            const topicsArray = Array.isArray(topics) ? topics : [topics];
            paragraphs = await getDyslexiaFriendlyParagraphs(topicsArray, count);
        } else {
            // If no topics provided, get random paragraphs
            paragraphs = await getRandomParagraphs(count);
        }
        
        res.json({ paragraphs });
    } catch (error) {
        console.error('Error fetching paragraphs:', error.message);
        // Fallback to predefined paragraphs if API fails
        res.json({ 
            paragraphs: getFallbackParagraphs(count)
        });
    }
});

// Function to get dyslexia-friendly paragraphs based on topics
async function getDyslexiaFriendlyParagraphs(topics, count = 1) {
    try {
        // Try to use the Bacon Ipsum API for testing
        // In a real app, you'd use a more suitable API for educational content
        const response = await axios.get('https://baconipsum.com/api/', {
            params: {
                type: 'all-meat',
                paras: count,
                'start-with-lorem': 1
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching topic-based paragraphs:', error.message);
        return getFallbackParagraphs(count);
    }
}

// Function to get random paragraphs
async function getRandomParagraphs(count = 1) {
    try {
        // Use Bacon Ipsum API for testing
        const response = await axios.get('https://baconipsum.com/api/', {
            params: {
                type: 'all-meat',
                paras: count,
                'start-with-lorem': 1
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching random paragraphs:', error.message);
        return getFallbackParagraphs(count);
    }
}

// Fallback paragraphs if APIs fail
function getFallbackParagraphs(count = 1) {
    const paragraphs = [
        "The quick brown fox jumps over the lazy dog. This pangram contains all the letters of the English alphabet. It is widely used for touch-typing practice, testing typewriters and computer keyboards, displaying examples of fonts, and other applications involving text where the use of all letters in the alphabet is desired.",
        "Artificial intelligence is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. Leading AI textbooks define the field as the study of intelligent agents: any system that perceives its environment and takes actions that maximize its chance of achieving its goals.",
        "Climate change refers to significant changes in global temperature, precipitation, wind patterns, and other measures of climate that occur over several decades or longer. The scientific consensus is that climate change is occurring and that human activities, particularly the burning of fossil fuels, are the main driver.",
        "Neuroscience is the scientific study of the nervous system. It is a multidisciplinary science that combines physiology, anatomy, molecular biology, developmental biology, cytology, mathematical modeling, and psychology to understand the fundamental and emergent properties of neurons and neural circuits."
    ];
    
    // Return the requested number of paragraphs
    return paragraphs.slice(0, Math.min(count, paragraphs.length));
}

// Fallback recommendations if ML API fails
function getFallbackRecommendations(wpm, difficultWordsCount) {
    // Default recommendations for dyslexic readers
    const recommendations = {
        font_size: 20,
        letter_spacing: 2,
        background_color: '#fffacd', // Light yellow
        reading_speed: 1.0,
        highlight_difficult_words: true,
        font_family: 'OpenDyslexic',
        line_height: 1.8,
        profile: 'intermediate',
        explanation: 'Default dyslexia-friendly settings'
    };
    
    // Adjust based on reading speed
    if (wpm < 150) {
        recommendations.font_size = 22;
        recommendations.letter_spacing = 3;
        recommendations.reading_speed = 0.8;
        recommendations.profile = 'beginner';
        recommendations.explanation = 'Settings for slower reading speed';
    } else if (wpm > 250) {
        recommendations.font_size = 18;
        recommendations.letter_spacing = 1.5;
        recommendations.reading_speed = 1.0;
        recommendations.profile = 'advanced';
        recommendations.explanation = 'Settings for faster reading speed';
    }
    
    // Adjust based on difficulty
    if (difficultWordsCount > 5) {
        recommendations.letter_spacing += 0.5;
        recommendations.explanation += ' with additional spacing for difficult words';
    }
    
    return recommendations;
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; 