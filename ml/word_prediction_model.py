# Word Prediction Model
# This script uses NLTK and a simple n-gram model to predict the next word

import nltk
import pickle
import numpy as np
from nltk.tokenize import word_tokenize
from nltk.lm import MLE
from nltk.lm.preprocessing import padded_everygram_pipeline
from nltk.corpus import brown
from collections import Counter

# Download required NLTK data
nltk.download('brown')
nltk.download('punkt')

class WordPredictionModel:
    def __init__(self, n=3):
        """Initialize the n-gram model for word prediction."""
        self.n = n
        self.model = None
        self.vocab = set()
    
    def train(self, corpus=None):
        """Train the model on a corpus."""
        if corpus is None:
            print("Using Brown corpus for training")
            corpus = brown.sents(categories=['news', 'science_fiction'])
        
        # Preprocess the corpus for n-grams
        train_data, padded_sents = padded_everygram_pipeline(self.n, corpus)
        
        # Create and train the model
        self.model = MLE(self.n)
        self.model.fit(train_data, padded_sents)
        
        # Create vocabulary set
        for sent in corpus:
            for word in sent:
                self.vocab.add(word.lower())
    
    def predict_next_word(self, context):
        """Predict the next word given the context."""
        if self.model is None:
            print("Model not trained. Training now...")
            self.train()
        
        # Convert input to lowercase
        context = context.lower()
        
        # Tokenize the context
        tokens = word_tokenize(context)
        
        # Get the last n-1 tokens as input
        if len(tokens) >= self.n - 1:
            input_tokens = tokens[-(self.n-1):]
        else:
            input_tokens = tokens
            # Pad if necessary
            input_tokens = ['<s>'] * (self.n - 1 - len(tokens)) + tokens
        
        # Get top possible next words
        next_word_probs = list(self.model.context_counts(input_tokens))
        
        if not next_word_probs:
            # If no prediction, try a smaller context
            if len(input_tokens) > 1:
                input_tokens = input_tokens[1:]
                next_word_probs = list(self.model.context_counts(input_tokens))
        
        # Return the most likely next word
        if next_word_probs:
            return sorted(next_word_probs, key=lambda x: x[1], reverse=True)[0][0]
        return ""
    
    def complete_partial_word(self, partial_word):
        """Complete a partial word based on vocabulary."""
        if not partial_word or len(partial_word) < 2:
            return ""
        
        partial_word = partial_word.lower()
        matches = [word for word in self.vocab if word.startswith(partial_word) and len(word) > len(partial_word)]
        
        if matches:
            # Count frequency of matches in Brown corpus
            word_freq = Counter()
            for sent in brown.sents(categories=['news', 'science_fiction']):
                for word in sent:
                    if word.lower() in matches:
                        word_freq[word.lower()] += 1
            
            # Return the most frequent match
            if word_freq:
                return max(word_freq.items(), key=lambda x: x[1])[0]
            
            # If no frequency data, return the first match
            return matches[0]
        
        return ""
    
    def save_model(self, filepath="word_prediction_model.pkl"):
        """Save the trained model to a file."""
        with open(filepath, 'wb') as f:
            pickle.dump((self.model, self.vocab), f)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath="word_prediction_model.pkl"):
        """Load a trained model from a file."""
        try:
            with open(filepath, 'rb') as f:
                self.model, self.vocab = pickle.load(f)
            print(f"Model loaded from {filepath}")
        except Exception as e:
            print(f"Error loading model: {e}")
            print("Training a new model instead...")
            self.train()

# Example usage
if __name__ == "__main__":
    # Create and train the model
    model = WordPredictionModel()
    model.train()
    
    # Test predictions
    test_contexts = [
        "the quick brown",
        "artificial intelligence is",
        "climate change refers to"
    ]
    
    for context in test_contexts:
        prediction = model.predict_next_word(context)
        print(f"Context: '{context}'")
        print(f"Predicted next word: '{prediction}'")
    
    # Test word completion
    test_partial_words = ["artif", "intel", "cli", "pred"]
    
    for partial in test_partial_words:
        completion = model.complete_partial_word(partial)
        print(f"Partial word: '{partial}'")
        print(f"Completed word: '{completion}'")
    
    # Save the model
    model.save_model() 