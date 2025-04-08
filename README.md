# Adaptive Reading Assistant for Dyslexia

A specialized reading assistance tool that adapts to users with dyslexia, tracking reading performance and automatically adjusting text display settings to improve readability.

## Features

1. **Speech Recognition**: Tracks user's reading aloud, identifying difficult words and hesitations
2. **Automatic Word Assistance**: When a user pauses for >5 seconds on a word, the system reads it aloud
3. **OpenDyslexic Font**: Uses the specialized dyslexia-friendly font to improve readability
4. **Personalized Reading Settings**: Adjusts font size, letter spacing, colors, and reading speed
5. **Adaptive Learning**: Recommends content with similar syllable patterns for practice

## Project Structure

- **Frontend**: HTML/CSS/JavaScript for the user interface with speech recognition
- **Backend**: Node.js/Express API server for data processing and content delivery
- **ML Models**: Python models for reading analysis and word prediction

## Setup Instructions

### Frontend

1. Open `frontend/index.html` in a web browser (Chrome recommended for speech recognition)

### Backend

1. Install dependencies:
   ```
   cd backend
   npm install
   npm start
   ```

### ML Component

1. Install Python dependencies:
   ```
   cd ml
   pip install -r requirements.txt
   python api.py
   ```

## How It Works

1. **Initial Reading**: The user reads a paragraph aloud while the system listens using speech recognition
2. **Real-time Assistance**: If the user gets stuck on a word for more than 5 seconds, the system automatically pronounces it
3. **Reading Analysis**: The system analyzes reading speed, pauses, and difficult words
4. **Automatic Adjustments**: Based on analysis, the system adjusts text settings (font size, spacing, colors)
5. **Personalized Content**: For future reading sessions, the system provides content containing similar syllables to those the user found difficult

## Technologies Used

- **Frontend**: Speech recognition API, Web Speech API for text-to-speech
- **Backend**: Node.js, Express, Axios for API communication
- **ML**: Python, Flask, NLTK for language processing
- **Font**: OpenDyslexic specialized font

## APIs Used

- **Web Speech API**: For speech recognition and text-to-speech
- **Bacon Ipsum API**: For generating sample paragraphs (free)

This project is designed to help people with dyslexia improve their reading skills through adaptive technology. 