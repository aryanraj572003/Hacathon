// DOM Elements
const startReadingBtn = document.getElementById('startReading');
const stopReadingBtn = document.getElementById('stopReading');
const resumeReadingBtn = document.getElementById('resumeReading');
const readingArea = document.getElementById('readingArea');
const readingText = document.getElementById('readingText');
const wordTracker = document.getElementById('wordTracker');
const speechStatus = document.getElementById('speechStatus');
const currentWordElement = document.getElementById('currentWord');
const difficultWordsList = document.getElementById('difficultWordsList');
const statsArea = document.getElementById('statsArea');
const readingTimeElement = document.getElementById('readingTime');
const wpmElement = document.getElementById('wpm');
const difficultWordsElement = document.getElementById('difficultWords');
const avgPauseElement = document.getElementById('avgPause');
const getNewParagraphBtn = document.getElementById('getNewParagraph');
const progressGraph = document.getElementById('progressGraph');

// Reading settings elements
const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const letterSpacingSlider = document.getElementById('letterSpacing');
const letterSpacingValue = document.getElementById('letterSpacingValue');
const backgroundColorSelect = document.getElementById('backgroundColor');
const readingSpeedSlider = document.getElementById('readingSpeed');
const readingSpeedValue = document.getElementById('readingSpeedValue');

// Reading state variables
let startTime;
let endTime;
let readingDuration = 0;
let wordsRead = 0;
let difficultWords = [];
let pauseTimes = [];
let wordTimings = {};
let isReading = false;
let currentWordIndex = 0;
let words = [];
let lastWordTime = 0;
let recognizer = null;
let speechSynthesis = window.speechSynthesis;
let wordStuckTimeout = null;
let isTtsReading = false;

// Historical statistics tracking
let readingHistory = [];
let chart = null;

// Sample paragraphs for reading
const paragraphs = [
    "Reading is a fundamental skill that opens doors to new worlds of knowledge and imagination. When we read, our brains process written language, converting symbols into meaning. Regular practice improves comprehension, vocabulary, and critical thinking skills. The more diverse texts you encounter, the stronger your reading abilities become.",
    
    "Learning to read fluently involves recognizing patterns in words and understanding their context in sentences. Our brains form neural connections that become stronger with each reading session. Difficult words become familiar through repeated exposure. This cognitive process is fascinating—your brain actually rewires itself to become more efficient at decoding text.",
    
    "Education researchers have found that strong reading skills correlate with success across all academic subjects. Students who read regularly tend to perform better in science, mathematics, and social studies. This is because reading enhances vocabulary, improves focus, and develops analytical thinking abilities that transfer to other domains of knowledge.",
    
    "Digital literacy has become essential in today's information-rich environment. We must learn to navigate text on screens, evaluate online sources, and synthesize information from multiple media. Despite technological changes, the fundamental skills of reading—decoding, comprehension, and critical analysis—remain vital for success in education and professional life."
];

// Apply initial settings and initialize speech synthesis
function applyInitialSettings() {
    readingText.style.fontSize = `${fontSizeSlider.value}px`;
    readingText.style.letterSpacing = `${letterSpacingSlider.value}px`;
    readingArea.style.backgroundColor = backgroundColorSelect.value;
    document.body.style.backgroundColor = '#f5f5f5';
    document.querySelector('.container').style.backgroundColor = backgroundColorSelect.value;
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis = window.speechSynthesis;
        // Sometimes we need to "warm up" speech synthesis
        const utterance = new SpeechSynthesisUtterance('');
        speechSynthesis.speak(utterance);
    } else {
        console.error("Speech synthesis not supported in this browser");
        speechStatus.textContent = "Speech synthesis not supported. Try Chrome browser.";
    }
}

// Function to fetch a paragraph from the API, or use sample paragraphs if API fails
async function fetchRandomParagraph() {
    try {
        speechStatus.textContent = "Generating a new paragraph...";
        
        // Get a unique user ID (using localStorage to maintain consistency)
        const userId = localStorage.getItem('userId') || ('user-' + Date.now());
        localStorage.setItem('userId', userId);
        
        // First priority: Generate paragraph based on current difficult words
        if (difficultWords.length > 0) {
            console.log("Using difficult words for paragraph generation:", difficultWords);
            
            // Call the Hugging Face paragraph generation API directly
            const response = await fetch('/api/recommend-paragraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    difficultWords: difficultWords,
                    userId: userId
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log("Generated paragraph using difficult words:", data);
                
                // Add a note about the paragraph focusing on difficult words
                const wordsUsed = data.words_used.join(', ');
                return `Practice paragraph based on words you struggled with: ${wordsUsed}\n\n${data.paragraph}`;
            } else {
                console.warn("Failed to generate paragraph with difficult words:", await response.text());
            }
        }
        
        // Second priority: Use topics from previous reading
        const recommendedTopics = localStorage.getItem('recommendedTopics');
        if (recommendedTopics) {
            const topics = JSON.parse(recommendedTopics);
            console.log("Using recommended topics for paragraph generation:", topics);
            
            // Use Hugging Face API to generate paragraph with these topics
            const response = await fetch('/api/recommend-paragraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Create "difficult words" from the topics
                    difficultWords: topics.map(topic => topic.split(' ')[0]),
                    userId: userId
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Clear the topics after using them once
                localStorage.removeItem('recommendedTopics');
                
                return `This paragraph focuses on words similar to ones you found difficult: ${topics.join(', ')}.\n\n${data.paragraph}`;
            }
        }
        
        // Third priority: Generate a general educational paragraph
        try {
            const generalTopics = ["reading", "education", "learning", "knowledge", "comprehension"];
            const randomTopics = generalTopics.sort(() => 0.5 - Math.random()).slice(0, 2);
            
            const response = await fetch('/api/recommend-paragraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    difficultWords: randomTopics,
                    userId: userId
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.paragraph;
            }
        } catch (error) {
            console.warn("Error generating general paragraph:", error);
        }
        
        // Final fallback: Use one of our sample paragraphs
        const randomIndex = Math.floor(Math.random() * paragraphs.length);
        return paragraphs[randomIndex];
        
    } catch (error) {
        console.error('Error fetching paragraph:', error);
        // Use fallback paragraphs if API fails
        const randomIndex = Math.floor(Math.random() * paragraphs.length);
        return paragraphs[randomIndex];
    }
}

// Function to initialize and display a paragraph
async function initializeParagraph() {
    // Clear any previous reading session
    resetReadingSession();
    
    // Get a random paragraph
    const paragraph = await fetchRandomParagraph();
    
    // Display the paragraph
    readingText.textContent = paragraph;
    
    // Split paragraph into words for tracking
    words = paragraph.match(/\b(\w+)\b/g);
    
    // Apply current settings
    applyInitialSettings();
    
    speechStatus.textContent = "Ready to read! Click 'Start Reading' to begin.";
    currentWordElement.textContent = "";
    
    // Reset state for new paragraph
    currentWordIndex = 0;
    difficultWords = [];
    wordTimings = {};
    difficultWordsList.innerHTML = '';
}

// Function to initialize speech recognition
function initializeSpeechRecognition() {
    try {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech recognition not supported in this browser");
            speechStatus.textContent = "Speech recognition not supported. Try Chrome browser.";
            return false;
        }
        
        // Create recognizer with optimized settings
        recognizer = new SpeechRecognition();
        recognizer.continuous = true;
        recognizer.interimResults = true;  // Get faster interim results
        recognizer.maxAlternatives = 3;    // Consider multiple alternatives to improve accuracy
        
        // Set shorter phrases for faster processing
        recognizer.lang = 'en-US';
        
        // Handle results with reduced latency
        recognizer.onresult = handleSpeechResult;
        
        // Handle errors
        recognizer.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            
            if (event.error === 'no-speech') {
                // Don't show this error to the user, just restart recognition
                if (isReading) {
                    try {
                        recognizer.stop();
                        setTimeout(() => {
                            if (isReading) recognizer.start();
                        }, 100);
                    } catch (e) {
                        console.error("Error restarting recognizer:", e);
                    }
                }
                return;
            }
            
            speechStatus.textContent = `Recognition error: ${event.error}. Try again.`;
            
            // Restart recognition if it's still active
            if (isReading) {
                try {
                    recognizer.stop();
                    setTimeout(() => {
                        if (isReading) recognizer.start();
                    }, 100);
                } catch (e) {
                    console.error("Error restarting recognizer:", e);
                }
            }
        };
        
        return true;
    } catch (error) {
        console.error("Error initializing speech recognition:", error);
        speechStatus.textContent = "Could not initialize speech recognition.";
        return false;
    }
}

// Function to start reading
function startReading() {
    if (!recognizer && !initializeSpeechRecognition()) {
        return;
    }
    
    // Reset variables for a new reading session
    difficultWords = [];
    pauseTimes = [];
    wordTimings = {};
    wordsRead = 0;
    currentWordIndex = 0;
    lastWordTime = Date.now(); // Initialize to current time
    
    // Clear difficult words display
    difficultWordsList.innerHTML = '';
    
    // Start speech recognition
    try {
        recognizer.start();
        console.log("Started speech recognition");
        
        // Update UI
        startReadingBtn.textContent = 'Stop Reading';
        stopReadingBtn.disabled = false;
        resumeReadingBtn.disabled = true;
        
        // Highlight first word
        updateHighlightedWord();
        
        // Start checking if user gets stuck on words
        startWordStuckChecker();
        
        // Set reading state and start time
        isReading = true;
        startTime = Date.now();
        speechStatus.textContent = "Listening to your reading...";
    } catch (e) {
        console.error("Error starting speech recognition:", e);
        speechStatus.textContent = "Error starting speech recognition. Try again.";
    }
}

// Function to stop reading 
function stopReading() {
    if (!isReading) return;
    
    isReading = false;
    isTtsReading = false;
    
    // Stop speech recognition
    if (recognizer) {
        try {
            recognizer.stop();
            console.log("Speech recognition stopped");
        } catch (error) {
            console.error("Error stopping speech recognition:", error);
        }
    }
    
    // Clear any stuck word checker
    if (wordStuckTimeout) {
        clearTimeout(wordStuckTimeout);
        wordStuckTimeout = null;
    }
    
    // Stop any ongoing speech
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // Calculate and display reading stats
    endTime = Date.now();
    readingDuration = (endTime - startTime) / 1000;
    calculateReadingStats();
    
    // Update UI
    startReadingBtn.textContent = 'Start Reading';
    startReadingBtn.disabled = false;
    stopReadingBtn.disabled = true;
    resumeReadingBtn.disabled = true;
    
    speechStatus.textContent = "Reading session ended. Your stats are below.";
    
    // Reset for a new session
    currentWordIndex = 0;
    
    // Request next paragraph based on difficult words
    if (difficultWords.length > 0) {
        requestNextParagraphWithSimilarWords();
    }
}

// Function to pause reading
function pauseReading() {
    if (!isReading) return;
    
    isReading = false;
    
    // Stop speech recognition
    if (recognizer) {
        try {
            recognizer.stop();
            console.log("Speech recognition paused at word:", words[currentWordIndex]);
        } catch (error) {
            console.error("Error stopping speech recognition:", error);
        }
    }
    
    // Update UI
    stopReadingBtn.disabled = true;
    resumeReadingBtn.disabled = true;
    
    // Track when we paused
    pauseStartTime = Date.now();
    
    // Clear any stuck word checker
    if (wordStuckTimeout) {
        clearTimeout(wordStuckTimeout);
        wordStuckTimeout = null;
    }
    
    speechStatus.textContent = "Reading paused. Press 'Resume Reading' to continue from this word.";
}

// Function to resume reading from where the user left off
function resumeReading() {
    if (isReading) return;
    
    // Reset time for the current word
    lastWordTime = Date.now();
    
    // Start speech recognition
    if (recognizer) {
        try {
            recognizer.start();
            console.log("Speech recognition resumed at word:", words[currentWordIndex]);
            speechStatus.textContent = "Resumed listening...";
            isReading = true;
            
            // If we had paused, record the pause duration
            if (pauseStartTime) {
                const pauseDuration = (Date.now() - pauseStartTime) / 1000;
                pauseTimes.push(pauseDuration);
                pauseStartTime = null;
                console.log(`Recorded pause duration: ${pauseDuration.toFixed(1)}s`);
            }
            
            // Start checking if user gets stuck on words
            startWordStuckChecker();
            
            // Ensure the current word is highlighted
            updateHighlightedWord();
            
            // Update UI
            resumeReadingBtn.disabled = false;
        } catch (error) {
            console.error("Error resuming speech recognition:", error);
            speechStatus.textContent = "Error resuming recognition. Please try again.";
        }
    }
}

// Function to request the next paragraph with similar words
async function requestNextParagraphWithSimilarWords() {
    try {
        // Get a unique user ID (using localStorage to maintain consistency)
        const userId = localStorage.getItem('userId') || ('user-' + Date.now());
        localStorage.setItem('userId', userId);
        
        // First try the Hugging Face API with current difficult words
        if (difficultWords.length > 0) {
            try {
                const response = await fetch('/api/recommend-paragraph', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        difficultWords: difficultWords,
                        userId: userId
                    }),
                });
                
                if (response.ok) {
                    // Successfully generated a paragraph - no need to get recommendations
                    console.log("Successfully generated next paragraph using Hugging Face");
                    return;
                }
            } catch (error) {
                console.warn("Error generating paragraph with Hugging Face:", error);
            }
        }
        
        // Fallback to getting topic recommendations for the next reading
        const response = await fetch(`/api/recommendations/${userId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.topics && data.topics.length > 0) {
                // Store recommended topics for the next paragraph
                localStorage.setItem('recommendedTopics', JSON.stringify(data.topics));
                console.log("Received topic recommendations:", data.topics);
            }
        } else {
            console.warn("Failed to get topic recommendations");
        }
    } catch (error) {
        console.error("Error requesting next paragraph:", error);
    }
}

// Function to calculate reading statistics
function calculateReadingStats() {
    endTime = Date.now();
    readingDuration = (endTime - startTime) / 1000; // in seconds
    
    // Calculate words per minute (WPM)
    const wpm = Math.round((wordsRead / readingDuration) * 60);
    
    // Calculate average pause time
    let avgPause = 0;
    if (pauseTimes.length > 0) {
        avgPause = pauseTimes.reduce((sum, time) => sum + time, 0) / pauseTimes.length;
    }
    
    // Update statistics display
    readingTimeElement.textContent = readingDuration.toFixed(1);
    wpmElement.textContent = wpm;
    difficultWordsElement.textContent = difficultWords.length;
    avgPauseElement.textContent = avgPause.toFixed(1);
    
    // Create statistics object for this session
    const sessionStats = {
        timestamp: new Date().toISOString(),
        readingTime: readingDuration.toFixed(1),
        wpm: wpm,
        difficultWords: difficultWords.length,
        avgPause: avgPause.toFixed(1)
    };
    
    // Add to reading history and save
    saveReadingStats(sessionStats);
    
    // Show statistics area with animation
    statsArea.classList.remove('hidden');
    
    // Add animation class to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('animate-in');
        }, index * 100);
    });
    
    // Update the historical stats display
    displayReadingHistory();
    
    // Send reading data to server for analysis
    sendReadingDataToServer(readingDuration, wpm, difficultWords, wordTimings);
}

// Function to save reading stats to localStorage
function saveReadingStats(stats) {
    // Get existing history from localStorage
    const historyJson = localStorage.getItem('readingHistory');
    let history = historyJson ? JSON.parse(historyJson) : [];
    
    // Add new session stats
    history.push(stats);
    
    // Keep only the last 10 sessions
    if (history.length > 10) {
        history = history.slice(history.length - 10);
    }
    
    // Update global variable
    readingHistory = history;
    
    // Save back to localStorage
    localStorage.setItem('readingHistory', JSON.stringify(history));
    
    console.log("Saved reading stats:", stats);
}

// Function to display reading history as table and graph
function displayReadingHistory() {
    // Get history from localStorage if not already loaded
    if (readingHistory.length === 0) {
        const historyJson = localStorage.getItem('readingHistory');
        if (historyJson) {
            readingHistory = JSON.parse(historyJson);
        }
    }
    
    // Only display if we have sessions
    if (readingHistory.length === 0) {
        return;
    }
    
    // Display in graph
    displayHistoryGraph();
}

// Function to display reading history in graph
function displayHistoryGraph() {
    // Get canvas context
    const ctx = progressGraph.getContext('2d');
    
    // Clear existing chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Get last 4 sessions (or fewer if less available)
    const recentSessions = readingHistory.slice(-4);
    
    // Extract data for each metric
    const labels = recentSessions.map((_, index) => `Session ${index + 1}`);
    const wpmData = recentSessions.map(session => session.wpm);
    const difficultWordsData = recentSessions.map(session => session.difficultWords);
    const avgPauseData = recentSessions.map(session => parseFloat(session.avgPause));
    
    // Create the chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Words Per Minute',
                    data: wpmData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Difficult Words',
                    data: difficultWordsData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Avg Pause (s)',
                    data: avgPauseData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Reading Performance Over Time'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Improved function to handle speech recognition results with faster response
function handleSpeechResult(event) {
    if (!isReading) return;
    
    const results = event.results;
    
    // Process each result as it comes in
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        // Check both final and interim results for faster response
        if (result.isFinal || (currentWordIndex < words.length && i === results.length - 1)) {
            const transcript = result[0].transcript.trim().toLowerCase();
            
            // Split into words and process immediately
            const spokenWords = transcript.match(/\b(\w+)\b/g) || [];
            
            if (spokenWords.length > 0) {
                // Get all words from current index to end of paragraph
                const remainingWords = words.slice(currentWordIndex).map(w => w.toLowerCase());
                let wordsMatched = 0;
                
                // Check how many consecutive words were matched (faster algorithm)
                const maxCheck = Math.min(spokenWords.length, remainingWords.length);
                for (let j = 0; j < maxCheck; j++) {
                    // Allow partial matches to improve responsiveness
                    if (remainingWords[j].includes(spokenWords[j]) || 
                        spokenWords[j].includes(remainingWords[j])) {
                        wordsMatched++;
                    } else {
                        break;
                    }
                }
                
                if (wordsMatched > 0) {
                    // Move forward by the number of matched words immediately
                    console.log(`Matched ${wordsMatched} consecutive words`);
                    
                    // Move forward for each matched word
                    for (let j = 0; j < wordsMatched; j++) {
                        moveToNextWord(true); // Each word was read correctly
                    }
                } else {
                    // Try to match current word with any word in the transcript
                    const currentWord = words[currentWordIndex].toLowerCase();
                    
                    for (let j = 0; j < spokenWords.length; j++) {
                        // Allow more flexible matching for better user experience
                        if (spokenWords[j] === currentWord || 
                            spokenWords[j].includes(currentWord) || 
                            currentWord.includes(spokenWords[j])) {
                            moveToNextWord(true);
                            break;
                        }
                    }
                }
            }
        }
    }
}

// Function to move to the next word after successful recognition
function moveToNextWord(isCorrect) {
    // Record time spent on this word
    const currentTime = Date.now();
    const currentWord = words[currentWordIndex].toLowerCase();
    
    if (lastWordTime > 0) {
        const timeSpent = (currentTime - lastWordTime) / 1000; // in seconds
        wordTimings[currentWord] = timeSpent;
        
        // Check if user was stuck on this word
        if (timeSpent > 3 && !isCorrect) {
            pauseTimes.push(timeSpent);
        }
    }
    
    // Update timing and move to next word
    lastWordTime = currentTime;
    currentWordIndex++;
    wordsRead++;
    
    // Update UI to show progress
    if (currentWordIndex < words.length) {
        // Use the improved highlighting function
        updateHighlightedWord();
    } else {
        // End of paragraph reached
        completeParagraph();
    }
}

// Function to track the current word being read
function trackWord(index) {
    if (index >= words.length) return;
    
    const currentWord = words[index];
    currentWordElement.textContent = currentWord;
    currentWordElement.classList.remove('difficult-word'); // Reset difficult word styling
    
    // Clear any previous highlighting from all words
    const plainText = readingText.textContent;
    readingText.innerHTML = plainText;
    
    // Highlight the current word in the paragraph
    const textContent = readingText.textContent;
    const wordIndex = findWordPositionInText(textContent, currentWord, index);
    
    if (wordIndex !== -1) {
        const highlightedText = 
            textContent.substring(0, wordIndex) + 
            `<span class="speaking">${currentWord}</span>` + 
            textContent.substring(wordIndex + currentWord.length);
        
        readingText.innerHTML = highlightedText;
        
        // Update word tracker width to show progress
        const progress = (index / words.length) * 100;
        wordTracker.style.width = `${progress}%`;
    }
}

// Function to find the position of a word in text, considering the word order
function findWordPositionInText(text, word, expectedIndex) {
    const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
    let count = 0;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
        if (count === expectedIndex) {
            return match.index;
        }
        count++;
    }
    
    // If we can't find the exact index, just find the first occurrence
    const simpleIndex = text.toLowerCase().indexOf(word.toLowerCase());
    return simpleIndex;
}

// Timer to regularly check if the user is stuck on a word
function startWordStuckChecker() {
    // Clear any existing timeout
    if (wordStuckTimeout) {
        clearTimeout(wordStuckTimeout);
    }
    
    // Set a recurring checker that runs more frequently for better responsiveness
    wordStuckTimeout = setInterval(() => {
        if (!isReading || isTtsReading) return;
        
        const currentTime = Date.now();
        const currentWord = words[currentWordIndex];
        
        // Calculate time spent on current word
        const timeOnCurrentWord = (currentTime - lastWordTime) / 1000;
        
        // If user hasn't moved from this word in exactly 3 seconds, read it for them
        if (timeOnCurrentWord > 3) {
            console.log(`User stuck on word "${currentWord}" for ${timeOnCurrentWord.toFixed(1)} seconds - reading it for them`);
            
            // Set flag to prevent multiple readings of the same word
            isTtsReading = true;
            
            // Help the user by speaking the word
            handleStuckOnWord(currentWord);
        }
    }, 100); // Check every 100ms for more precise timing around the 3-second mark
}

// Function to handle when a user is stuck on a word
function handleStuckOnWord(word) {
    // Prevent handling the same word twice in quick succession
    const currentTime = Date.now();
    const lastHandledTime = parseInt(localStorage.getItem(`lastHandled_${word}`) || '0');
    
    // Only handle if it's been at least 3 seconds since last handling this word
    if (currentTime - lastHandledTime < 3000) {
        console.log(`Already handled "${word}" recently, skipping`);
        isTtsReading = false; // Reset flag so we can check again
        return;
    }
    
    // Record that we've handled this word
    localStorage.setItem(`lastHandled_${word}`, currentTime.toString());
    
    // Add to difficult words list if not already there
    if (!difficultWords.includes(word)) {
        difficultWords.push(word);
        
        // Create and style the list item for the difficult word
        const li = document.createElement('li');
        li.textContent = word;
        li.classList.add('computer-assisted'); // Add a special class for words read by the computer
        li.title = "Computer assisted with this word";
        
        // Add animation class
        li.classList.add('word-appear');
        
        // Add to the list
        difficultWordsList.appendChild(li);
        
        // Record time spent on this word for analysis
        wordTimings[word] = (currentTime - lastWordTime) / 1000; // in seconds
    }
    
    // Update UI to indicate the difficult word
    speechStatus.textContent = `Reading word for you: "${word}"`;
    currentWordElement.textContent = word;
    currentWordElement.classList.add('difficult-word');
    
    // Add a pulse effect to the current word
    currentWordElement.classList.add('pulse-animation');
    
    // Speak the word using text-to-speech
    speakWord(word);
    
    console.log(`Added "${word}" to difficult words list and speaking it`);
}

// Function to speak a word using text-to-speech
function speakWord(word) {
    if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported");
        isTtsReading = false;
        return;
    }
    
    try {
        // Cancel any current speech
        window.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = parseFloat(readingSpeedSlider.value);
        utterance.volume = 1.0; // Ensure maximum volume
        
        // Debug
        console.log("Speaking word:", word);
        
        // Speak the word
        window.speechSynthesis.speak(utterance);
        
        // Set a flag to track if the user continues after assistance
        const wordIndex = currentWordIndex;
        
        // After speaking the word, automatically move to the next word
        utterance.onend = () => {
            console.log("Finished speaking word");
            
            // Reset the TTS reading flag
            isTtsReading = false;
            
            // Remove the pulse animation after speaking
            currentWordElement.classList.remove('pulse-animation');
            
            // Only move to next word if we're still on the same word
            // (to prevent issues if user already moved forward)
            if (isReading && currentWordIndex === wordIndex) {
                // Small delay to let the user process the word
                setTimeout(() => {
                    // Move to the next word
                    moveToNextWord(false); // Pass false since this was computer-assisted
                }, 1000); // Give user a full second to process the word after hearing it
            }
        };
    } catch (error) {
        console.error("Error with speech synthesis:", error);
        isTtsReading = false;
    }
}

// Function to send reading data to the server
async function sendReadingDataToServer(readingTime, wpm, difficultWords, wordTimings) {
    try {
        // Get a unique user ID (using localStorage to maintain consistency)
        const userId = localStorage.getItem('userId') || ('user-' + Date.now());
        localStorage.setItem('userId', userId);
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                readingTime,
                wpm,
                difficultWords,
                wordTimings,
                userId
            }),
        });
        
        if (!response.ok) {
            throw new Error('Server response was not ok');
        }
        
        const data = await response.json();
        
        // Apply recommended settings
        if (data.recommendations) {
            applyRecommendedSettings(data.recommendations);
        }
    } catch (error) {
        console.error('Error sending reading data:', error);
        // Continue even if the server is not available
    }
}

// Function to apply recommended settings
function applyRecommendedSettings(recommendations) {
    if (recommendations.fontSize) {
        fontSizeSlider.value = recommendations.fontSize;
        fontSizeValue.textContent = `${recommendations.fontSize}px`;
        readingText.style.fontSize = `${recommendations.fontSize}px`;
    }
    
    if (recommendations.letterSpacing !== undefined) {
        letterSpacingSlider.value = recommendations.letterSpacing;
        letterSpacingValue.textContent = `${recommendations.letterSpacing}px`;
        readingText.style.letterSpacing = `${recommendations.letterSpacing}px`;
    }
    
    if (recommendations.backgroundColor) {
        // Find closest match in the select options
        const options = Array.from(backgroundColorSelect.options);
        const closest = options.reduce((prev, curr) => {
            return (curr.value === recommendations.backgroundColor) ? curr : prev;
        }, options[0]);
        
        backgroundColorSelect.value = closest.value;
        readingArea.style.backgroundColor = closest.value;
        document.querySelector('.container').style.backgroundColor = closest.value;
    }
    
    if (recommendations.readingSpeed) {
        readingSpeedSlider.value = recommendations.readingSpeed;
        readingSpeedValue.textContent = `${recommendations.readingSpeed}x`;
    }
}

// Function to reset the reading session
function resetReadingSession() {
    try {
        // Clear any previous timeouts
        if (wordStuckTimeout) {
            clearTimeout(wordStuckTimeout);
            wordStuckTimeout = null;
        }
        
        // Stop any ongoing speech synthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        // Reset states
        isReading = false;
        isTtsReading = false;
        
        // Stop speech recognition if active
        if (recognizer) {
            try {
                recognizer.stop();
            } catch (e) {
                // Ignore errors when stopping recognition that might not be active
                console.log("Error stopping recognizer:", e);
            }
        }
        
        // Reset UI elements
        wordTracker.style.width = '0%';
        currentWordElement.textContent = '';
        currentWordElement.classList.remove('difficult-word');
        difficultWordsList.innerHTML = '';
        
        // Update buttons
        startReadingBtn.disabled = false;
        stopReadingBtn.disabled = true;
        resumeReadingBtn.disabled = true;
    } catch (error) {
        console.error("Error resetting reading session:", error);
    }
}

// Event Listeners
startReadingBtn.addEventListener('click', () => {
    if (isReading) {
        stopReading();
    } else {
        startReading();
    }
});

stopReadingBtn.addEventListener('click', stopReading);
resumeReadingBtn.addEventListener('click', resumeReading);
getNewParagraphBtn.addEventListener('click', initializeParagraph);

// Font size slider listener
fontSizeSlider.addEventListener('input', () => {
    fontSizeValue.textContent = `${fontSizeSlider.value}px`;
    readingText.style.fontSize = `${fontSizeSlider.value}px`;
});

// Letter spacing slider listener
letterSpacingSlider.addEventListener('input', () => {
    letterSpacingValue.textContent = `${letterSpacingSlider.value}px`;
    readingText.style.letterSpacing = `${letterSpacingSlider.value}px`;
});

// Background color listener
backgroundColorSelect.addEventListener('change', () => {
    readingArea.style.backgroundColor = backgroundColorSelect.value;
    document.querySelector('.container').style.backgroundColor = backgroundColorSelect.value;
});

// Reading speed slider listener
readingSpeedSlider.addEventListener('input', () => {
    readingSpeedValue.textContent = `${readingSpeedSlider.value}x`;
});

// Function to check browser compatibility
function checkBrowserCompatibility() {
    let compatibilityIssues = [];
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        compatibilityIssues.push("Speech recognition is not supported in this browser.");
        startReadingBtn.disabled = true;
        startReadingBtn.title = "Speech recognition not supported";
    }
    
    if (!('speechSynthesis' in window)) {
        compatibilityIssues.push("Text-to-speech is not supported in this browser.");
    }
    
    if (compatibilityIssues.length > 0) {
        const message = "Browser compatibility issues detected:\n- " + 
                       compatibilityIssues.join("\n- ") + 
                       "\n\nPlease use Google Chrome for the best experience.";
        alert(message);
        speechStatus.textContent = "Limited functionality. Please use Chrome.";
        return false;
    }
    
    return true;
}

// Initialize the page with a paragraph and check compatibility
document.addEventListener('DOMContentLoaded', () => {
    console.log("Page loaded, initializing application");
    checkBrowserCompatibility();
    
    // Initialize UI buttons
    startReadingBtn.textContent = 'Start Reading';
    stopReadingBtn.disabled = true;
    resumeReadingBtn.disabled = true;
    
    // Initialize with a new paragraph right away
    initializeParagraph();
    
    // Load reading history
    const historyJson = localStorage.getItem('readingHistory');
    if (historyJson) {
        readingHistory = JSON.parse(historyJson);
        console.log("Loaded reading history:", readingHistory.length, "sessions");
        
        // Display reading history if available
        if (readingHistory.length > 0) {
            displayReadingHistory();
        }
    }
});

// Function to update the highlighted word in the reading area
function updateHighlightedWord() {
    if (currentWordIndex >= words.length) return;
    
    const currentWord = words[currentWordIndex];
    
    // Update the current word display
    currentWordElement.textContent = currentWord;
    
    // Highlight the current word in the reading text
    const paragraphText = readingText.textContent;
    const wordPosition = findWordPositionInText(paragraphText, currentWord, currentWordIndex);
    
    if (wordPosition !== -1) {
        // Create HTML with the highlighted word
        const highlightedText = 
            paragraphText.substring(0, wordPosition) + 
            `<span class="speaking">${currentWord}</span>` + 
            paragraphText.substring(wordPosition + currentWord.length);
        
        // Apply the highlighted text
        readingText.innerHTML = highlightedText;
        
        // Update progress bar
        const progress = (currentWordIndex / words.length) * 100;
        wordTracker.style.width = `${progress}%`;
        
        // Scroll to ensure the word is visible
        const highlightedWord = readingText.querySelector('.speaking');
        if (highlightedWord) {
            highlightedWord.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
}

// Handle paragraph completion when all words are read
function completeParagraph() {
    // We've reached the end of the paragraph
    isReading = false;
    
    // Stop speech recognition
    if (recognizer) {
        try {
            recognizer.stop();
            console.log("Reading completed");
        } catch (error) {
            console.error("Error stopping speech recognition:", error);
        }
    }
    
    // Calculate and display reading stats
    endTime = Date.now();
    readingDuration = (endTime - startTime) / 1000;
    calculateReadingStats();
    
    // Update UI
    startReadingBtn.textContent = 'Start Reading';
    startReadingBtn.disabled = false;
    stopReadingBtn.disabled = true;
    resumeReadingBtn.disabled = true;
    
    speechStatus.textContent = "Congratulations! You've finished reading this paragraph.";
    
    // Request a new paragraph with similar words for next time
    requestNextParagraphWithSimilarWords();
} 