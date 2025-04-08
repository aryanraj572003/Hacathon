from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import logging
import requests
import json
from word_prediction_model import WordPredictionModel
from reading_analysis import ReadingAnalyzer
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize models
word_model = None
reading_analyzer = None

# Hugging Face API configuration
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/gpt2-large"
HUGGINGFACE_API_KEY = os.environ.get("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", "")  # Set this in your environment variables

def initialize_models():
    """Initialize and load the ML models."""
    global word_model, reading_analyzer
    
    try:
        # Initialize word prediction model
        logger.info("Initializing word prediction model...")
        word_model = WordPredictionModel()
        
        # Check if pre-trained model exists
        if os.path.exists("word_prediction_model.pkl"):
            word_model.load_model()
        else:
            logger.info("No pre-trained model found. Training new model...")
            word_model.train()
            word_model.save_model()
        
        # Initialize reading analyzer
        logger.info("Initializing reading analyzer...")
        reading_analyzer = ReadingAnalyzer()
        
        # Load history if available
        if os.path.exists("reading_history.json"):
            reading_analyzer.load_history()
            
        logger.info("Models initialized successfully.")
        return True
    
    except Exception as e:
        logger.error(f"Error initializing models: {str(e)}")
        return False

# Initialize models on startup
initialize_models()

def get_rhyming_words(word, limit=3):
    """Get words that rhyme with the given word using an external API."""
    try:
        # Using the Datamuse API to find rhyming words
        response = requests.get(f"https://api.datamuse.com/words?rel_rhy={word}&max={limit}")
        if response.status_code == 200:
            rhyming_words = [result["word"] for result in response.json()]
            return rhyming_words
        return []
    except Exception as e:
        logger.error(f"Error getting rhyming words: {str(e)}")
        return []

def generate_paragraph_with_huggingface(difficult_words, user_age=25):
    """Generate a paragraph using Hugging Face API based on difficult words and user age"""
    # Find related words for variety
    all_words = get_expanded_word_list(difficult_words)
    
    # Determine appropriate difficulty level based on age
    difficulty_level = determine_difficulty_level(user_age)
    
    # Create an age-appropriate prompt
    prompt = create_age_appropriate_prompt(all_words, user_age, difficulty_level)
    
    print(f"Generating paragraph with prompt: {prompt}")
    
    try:
        # Make request to Hugging Face API
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": 250,
                "temperature": 0.7,
                "top_p": 0.9,
                "do_sample": True
            }
        }
        
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        response = requests.post(HUGGINGFACE_API_URL, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            paragraph_text = result[0]['generated_text']
            
            # Clean up the paragraph to remove the prompt
            if paragraph_text.startswith(prompt):
                paragraph_text = paragraph_text[len(prompt):].strip()
            
            # Filter the paragraph for age appropriateness
            paragraph_text = filter_age_appropriate_content(paragraph_text, user_age)
            
            return {
                "paragraph": paragraph_text,
                "words_used": difficult_words
            }
        else:
            print(f"Hugging Face API error: {response.status_code}, {response.text}")
            return generate_fallback_paragraph(difficult_words, user_age)
    
    except Exception as e:
        print(f"Error in Hugging Face API request: {str(e)}")
        return generate_fallback_paragraph(difficult_words, user_age)

def create_age_appropriate_prompt(words, age, difficulty_level):
    """Create a prompt that's appropriate for the user's age"""
    # Base prompts for different age groups with sentence length guidance
    if age < 8:
        base_prompt = "Write a very simple, short paragraph (1-2 sentences only) for young children about"
    elif age < 12:
        base_prompt = "Write a simple paragraph (2-3 sentences) for elementary school children about"
    elif age < 16:
        base_prompt = "Write a moderate-length paragraph (3-4 sentences) for middle school students about"
    elif age < 20:
        base_prompt = "Write a standard paragraph (4-5 sentences) for high school students about"
    else:
        base_prompt = "Write a detailed paragraph (5-6 sentences) with complex structure and college-level vocabulary about"
    
    # Add the words to the prompt
    word_list = ", ".join(words)
    
    # Add specific instructions based on difficulty level and age-appropriate sentence length
    difficulty_instructions = {
        "beginner": "Use very simple words and short sentences (max 6 words per sentence). Explain any difficult concepts.",
        "elementary": "Use simple words and clear explanations. Keep sentences short (max 8 words per sentence). Focus on building vocabulary.",
        "intermediate": "Use moderate vocabulary with some challenging words. Keep sentences medium length (max 12 words per sentence). Include relevant examples.",
        "high_school": "Use academic vocabulary and proper sentences (10-15 words per sentence). Include deeper concepts.",
        "advanced": "Use sophisticated vocabulary and complex sentence structures (15+ words per sentence). Assume college-level knowledge."
    }
    
    instruction = difficulty_instructions.get(difficulty_level, "")
    
    # Complete prompt
    prompt = f"{base_prompt} {word_list}. {instruction}"
    
    return prompt

def filter_age_appropriate_content(text, age):
    """Filter content to ensure it's age-appropriate"""
    # For young children, simplify long sentences
    if age < 8:
        # Split long sentences
        sentences = text.split('. ')
        simplified = []
        for sentence in sentences:
            words = sentence.split()
            if len(words) > 12:
                # Try to break long sentences
                middle = len(words) // 2
                simplified.append(' '.join(words[:middle]) + '.')
                simplified.append(' '.join(words[middle:]) + '.')
            else:
                simplified.append(sentence + '.')
        return ' '.join(simplified)
    
    # For intermediate ages, just return as is
    return text

def generate_fallback_paragraph(words, user_age):
    """Generate a fallback paragraph if the API fails, adjusted for age appropriate length"""
    # Different templates based on age with appropriate length
    if user_age < 8:
        # Very short, 1-2 sentences for young children
        template = "Let's learn the word {word1}. {word1} is fun to say."
    elif user_age < 12:
        # Short, 2-3 sentences for elementary school
        template = "When we read, we learn words like {word1} and {word2}. These words help us understand more about the world. Try reading these words: {all_words}."
    elif user_age < 16:
        # Medium, 3-4 sentences for middle school
        template = "Reading helps us discover new words like {word1} and {word2}. These words build our vocabulary and knowledge. The more we practice saying these words, the better we become at reading. Let's practice these words: {all_words}."
    elif user_age < 20:
        # Standard, 4-5 sentences for high school
        template = "Expanding your vocabulary with words like {word1} and {word2} improves your reading comprehension. The more varied words you recognize quickly, the better your reading will become. Regular practice with challenging words strengthens neural pathways in the brain. This process enhances both reading speed and understanding. Practice these words: {all_words}."
    else:
        # Longer, 5-6 sentences with complex structure for adults
        template = "Fluent reading involves rapid word recognition for terms like {word1} and {word2}, which requires consistent practice and exposure. Developing automaticity with diverse vocabulary enhances comprehension and analytical thinking abilities. Research indicates that proficient readers process words as complete units rather than individual letters, a skill refined through repeated exposure to varied texts. Contextual understanding further facilitates word recognition, as semantic cues guide prediction and verification processes. This sophisticated cognitive interplay evolves through deliberate practice with challenging vocabulary. Consider these words for your practice: {all_words}."
    
    # Ensure we have at least two words
    if len(words) < 2:
        words = words + ["reading", "practice", "learning", "knowledge"]
    
    word1 = words[0]
    word2 = words[1]
    all_words = ", ".join(words)
    
    paragraph = template.format(word1=word1, word2=word2, all_words=all_words)
    
    return {
        "paragraph": paragraph,
        "words_used": words
    }

def get_expanded_word_list(difficult_words):
    """Expand the difficult words list with related words for variety"""
    all_words = []
    
    # Only process the first 5 difficult words to avoid overloading
    for word in difficult_words[:5]:
        all_words.append(word)
        
        # Add rhyming words
        rhyming_words = get_rhyming_words(word)
        if rhyming_words:
            all_words.extend(rhyming_words[:2])  # Add up to 2 rhyming words
        
        # Add synonyms if available
        synonyms = get_synonyms(word)
        if synonyms:
            all_words.extend(synonyms[:2])  # Add up to 2 synonyms
    
    # Remove duplicates while preserving order
    unique_words = []
    for word in all_words:
        if word not in unique_words:
            unique_words.append(word)
    
    return unique_words

def get_synonyms(word):
    """Get synonyms for a word using nltk WordNet"""
    try:
        from nltk.corpus import wordnet
        synonyms = []
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonym = lemma.name().replace('_', ' ')
                if synonym != word and synonym not in synonyms:
                    synonyms.append(synonym)
        return synonyms
    except:
        # If WordNet is not available, return empty list
        return []

def determine_difficulty_level(age):
    """Determine the appropriate reading difficulty level based on user age"""
    if age < 8:
        return "beginner"
    elif age < 12:
        return "elementary"
    elif age < 16:
        return "intermediate"
    elif age < 20:
        return "high_school"
    else:
        return "advanced"

@app.route('/api/recommend-paragraph', methods=['POST'])
def recommend_paragraph():
    """Endpoint to recommend a paragraph based on difficult words"""
    data = request.json
    
    # Check for required parameters
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Get user ID for tracking
    user_id = data.get('userId', 'anonymous')
    
    # Get difficult words, or use default educational terms if none provided
    difficult_words = data.get('difficultWords', [])
    
    if not difficult_words:
        # If no difficult words provided, try to get them from user history
        user_data = get_user_data(user_id)
        if user_data and 'difficult_words' in user_data and user_data['difficult_words']:
            difficult_words = list(user_data['difficult_words'].keys())
            print(f"Using {len(difficult_words)} difficult words from user history")
        
        # If still no difficult words, use educational defaults
        if not difficult_words:
            difficult_words = ["education", "reading", "knowledge", "literacy"]
    
    # Limit to top 5 difficult words to avoid overwhelming the model
    if len(difficult_words) > 5:
        difficult_words = difficult_words[:5]
    
    # Generate a paragraph using these words
    try:
        # Use difficult words to generate paragraph with Hugging Face API
        prompt = f"Write a clear educational paragraph using these words: {', '.join(difficult_words)}."
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": 250,
                "temperature": 0.7,
                "top_p": 0.9,
                "do_sample": True
            }
        }
        
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        response = requests.post(HUGGINGFACE_API_URL, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            paragraph_text = result[0]['generated_text']
            
            # Clean up the paragraph to remove the prompt
            if paragraph_text.startswith(prompt):
                paragraph_text = paragraph_text[len(prompt):].strip()
            
            # Update user data with this generation
            update_user_paragraph_history(user_id, {
                'paragraph': paragraph_text,
                'words_used': difficult_words,
                'timestamp': time.time()
            })
            
            return jsonify({
                "paragraph": paragraph_text,
                "words_used": difficult_words
            })
        else:
            print(f"Hugging Face API error: {response.status_code}, {response.text}")
            # Generate fallback paragraph
            return generate_fallback_response(difficult_words, user_id)
            
    except Exception as e:
        print(f"Error generating paragraph: {str(e)}")
        # Fall back to a simple paragraph
        return generate_fallback_response(difficult_words, user_id)

def generate_fallback_response(difficult_words, user_id):
    """Generate a fallback response when the API fails"""
    # Ensure we have at least two words
    if len(difficult_words) < 2:
        difficult_words = difficult_words + ["reading", "practice", "learning", "knowledge"]
    
    word1 = difficult_words[0]
    word2 = difficult_words[1]
    all_words = ", ".join(difficult_words)
    
    paragraph = (
        f"When we read, we discover new words like {word1} and {word2}. "
        f"These words help us understand more about the world. Regular practice "
        f"with challenging vocabulary enhances both reading speed and comprehension. "
        f"Try reading these words clearly: {all_words}."
    )
    
    # Update user data with this generation
    update_user_paragraph_history(user_id, {
        'paragraph': paragraph,
        'words_used': difficult_words,
        'timestamp': time.time()
    })
    
    return jsonify({
        "paragraph": paragraph,
        "words_used": difficult_words
    })

@app.route('/api/predict', methods=['POST'])
def predict_word():
    """API endpoint for word prediction."""
    try:
        data = request.get_json()
        
        if not data or 'partialWord' not in data:
            return jsonify({'error': 'Missing required parameter: partialWord'}), 400
            
        partial_word = data['partialWord']
        
        if len(partial_word) < 2:
            return jsonify({'prediction': ''}), 200
            
        # Get word completion prediction
        prediction = word_model.complete_partial_word(partial_word)
        
        return jsonify({'prediction': prediction}), 200
        
    except Exception as e:
        logger.error(f"Error in predict_word: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_reading():
    """API endpoint for reading analysis."""
    try:
        data = request.get_json()
        
        if not data or 'readingTime' not in data or 'wpm' not in data:
            return jsonify({'error': 'Missing required parameters: readingTime and wpm'}), 400
            
        # Extract parameters
        reading_time = data.get('readingTime')
        wpm = data.get('wpm')
        difficult_words = data.get('difficultWords', [])
        word_timings = data.get('wordTimings', {})
        user_id = data.get('userId', 'anonymous')
        
        # Analyze reading session
        recommendations = reading_analyzer.analyze_session(
            user_id=user_id,
            reading_time=reading_time,
            wpm=wpm,
            difficult_words=difficult_words,
            word_timings=word_timings
        )
        
        # Save updated history
        reading_analyzer.save_history()
        
        return jsonify({
            'recommendations': recommendations,
        }), 200
        
    except Exception as e:
        logger.error(f"Error in analyze_reading: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommendations/<user_id>', methods=['GET'])
def get_recommendations(user_id):
    """API endpoint for getting paragraph recommendations based on user's reading history."""
    try:
        # Get topic recommendations based on difficult words
        topics = reading_analyzer.get_syllable_recommendations(user_id)
        
        return jsonify({
            'topics': topics,
            'message': f"Recommended topics for user {user_id}"
        }), 200
    
    except Exception as e:
        logger.error(f"Error in get_recommendations: {str(e)}")
        return jsonify({'error': str(e), 'topics': ["general", "basic vocabulary"]}), 500

@app.route('/api/improvement', methods=['GET'])
def check_improvement():
    """API endpoint for checking user improvement."""
    try:
        user_id = request.args.get('userId', 'anonymous')
        
        # Analyze improvement
        improvement = reading_analyzer.analyze_improvement(user_id)
        
        return jsonify(improvement), 200
        
    except Exception as e:
        logger.error(f"Error in check_improvement: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """API endpoint for health check."""
    if word_model is not None and reading_analyzer is not None:
        return jsonify({'status': 'healthy', 'message': 'All models loaded successfully'}), 200
    else:
        return jsonify({'status': 'unhealthy', 'message': 'Models not initialized'}), 500

def update_user_paragraph_history(user_id, paragraph_data):
    """Update user history with generated paragraphs for tracking effectiveness"""
    user_data = get_user_data(user_id)
    
    if 'paragraph_history' not in user_data:
        user_data['paragraph_history'] = []
    
    # Add to history, limit to last 10 entries
    user_data['paragraph_history'].insert(0, paragraph_data)
    if len(user_data['paragraph_history']) > 10:
        user_data['paragraph_history'] = user_data['paragraph_history'][:10]
    
    save_user_data(user_id, user_data)
    return True

if __name__ == '__main__':
    # Run the Flask app
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True) 