const natural = require('natural');
const { NlpManager } = require('node-nlp');

// Initialize the NLP manager
const manager = new NlpManager({ languages: ['en'] });

// Dictionary for word prediction
const dictionary = {
    'artif': 'artificial',
    'intel': 'intelligence',
    'envi': 'environment',
    'temp': 'temperature',
    'prec': 'precipitation',
    'cli': 'climate',
    'chan': 'change',
    'sci': 'scientific',
    'cons': 'consensus',
    'hum': 'human',
    'acti': 'activities',
    'neur': 'neuroscience',
    'stud': 'study',
    'syst': 'system',
    'biol': 'biology',
    'devel': 'development',
    'prop': 'properties',
    'phy': 'physics',
    'chem': 'chemistry',
    'math': 'mathematics',
    'comp': 'computer',
    'prog': 'programming',
    'alg': 'algorithm',
    'func': 'function',
    'var': 'variable',
    'tech': 'technology',
    'inno': 'innovation',
    'edu': 'education',
    'learn': 'learning',
    'mach': 'machine',
    'deep': 'deep',
    'neur': 'neural',
    'netw': 'network'
};

// Function to predict next word
function predictNextWord(partialWord) {
    if (!partialWord || partialWord.length < 3) {
        return '';
    }
    
    // Simple dictionary-based prediction
    const lowerPartial = partialWord.toLowerCase();
    
    // Check if we have an exact match in our dictionary
    if (dictionary[lowerPartial]) {
        return dictionary[lowerPartial];
    }
    
    // Fuzzy match using Levenshtein distance
    let bestMatch = '';
    let bestScore = Infinity;
    
    for (const key of Object.keys(dictionary)) {
        // Only check keys that are at most the same length as the partial word
        if (key.length <= lowerPartial.length) {
            continue;
        }
        
        // Check if the key starts with the partial word
        if (key.startsWith(lowerPartial.substring(0, Math.min(3, lowerPartial.length)))) {
            const distance = natural.LevenshteinDistance(key.substring(0, lowerPartial.length), lowerPartial);
            
            if (distance < bestScore) {
                bestScore = distance;
                bestMatch = dictionary[key];
            }
        }
    }
    
    // Return the best match if it's reasonably close (distance <= 2)
    return bestScore <= 2 ? bestMatch : '';
}

// Function to analyze reading data and provide recommendations
function analyzeReadingData(readingTime, wpm, difficultWords = [], wordTimings = {}) {
    // Default recommendations
    const recommendations = {
        fontSize: 16,
        letterSpacing: 0,
        textColor: 'black',
        backgroundColor: 'white',
        readingSpeed: 1.0,
        highlightDifficultWords: false,
        explanation: 'Default settings'
    };
    
    // Analyze reading speed (WPM)
    if (wpm < 150) {
        // Slow reader
        recommendations.fontSize = 18;
        recommendations.letterSpacing = 1;
        recommendations.readingSpeed = 0.8;
        recommendations.explanation = 'Adjusted for slower reading speed';
    } else if (wpm > 300) {
        // Fast reader
        recommendations.fontSize = 14;
        recommendations.letterSpacing = 0;
        recommendations.readingSpeed = 1.2;
        recommendations.explanation = 'Adjusted for faster reading speed';
    }
    
    // Analyze difficulty (number of difficult words)
    if (difficultWords && difficultWords.length > 0) {
        const difficultyRatio = difficultWords.length / (wpm * (readingTime / 60));
        
        if (difficultyRatio > 0.1) {
            // Reader struggled with many words
            recommendations.letterSpacing = 2;
            recommendations.backgroundColor = 'lightyellow';
            recommendations.highlightDifficultWords = true;
            recommendations.explanation += ', high difficulty words detected';
        }
        
        // Analyze time spent on difficult words
        if (wordTimings && Object.keys(wordTimings).length > 0) {
            let totalTimeOnDifficultWords = 0;
            
            for (const word in wordTimings) {
                totalTimeOnDifficultWords += wordTimings[word];
            }
            
            const avgTimePerDifficultWord = totalTimeOnDifficultWords / Object.keys(wordTimings).length;
            
            if (avgTimePerDifficultWord > 2) {
                // Reader spent significant time on difficult words
                recommendations.letterSpacing += 1;
                recommendations.readingSpeed = Math.max(0.5, recommendations.readingSpeed - 0.2);
                recommendations.explanation += ', significant time spent on difficult words';
            }
        }
    }
    
    return {
        stats: {
            readingTime,
            wpm,
            difficultWordsCount: difficultWords ? difficultWords.length : 0,
        },
        recommendations
    };
}

// Function to train a simple NLP model for understanding reading topics
async function trainNlpModel() {
    // Add some entities and intents for our model
    manager.addDocument('en', 'I find this word difficult', 'difficult.word');
    manager.addDocument('en', 'I don\'t understand this word', 'difficult.word');
    manager.addDocument('en', 'What does this mean', 'difficult.word');
    manager.addDocument('en', 'I can\'t read this', 'difficult.word');
    
    manager.addDocument('en', 'This is too fast', 'reading.speed');
    manager.addDocument('en', 'I need more time', 'reading.speed');
    manager.addDocument('en', 'Slow down', 'reading.speed');
    
    manager.addDocument('en', 'The text is too small', 'visual.size');
    manager.addDocument('en', 'I can\'t see properly', 'visual.size');
    manager.addDocument('en', 'Make it bigger', 'visual.size');
    
    manager.addDocument('en', 'The colors are hard to read', 'visual.color');
    manager.addDocument('en', 'I need better contrast', 'visual.color');
    manager.addDocument('en', 'The text color is not good', 'visual.color');
    
    // Train the model
    await manager.train();
    console.log('NLP Model trained');
}

// Function to interpret user feedback about reading experience
async function interpretUserFeedback(feedback) {
    if (!feedback) {
        return { intent: 'unknown', score: 0 };
    }
    
    // Process the feedback through our NLP model
    const result = await manager.process('en', feedback);
    
    return {
        intent: result.intent,
        score: result.score,
        entities: result.entities
    };
}

// Train the model when the module is loaded
// trainNlpModel().catch(console.error);

module.exports = {
    predictNextWord,
    analyzeReadingData,
    interpretUserFeedback
}; 