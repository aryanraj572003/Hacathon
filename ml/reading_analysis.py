import json
import os
import time
from collections import defaultdict

class ReadingAnalyzer:
    """
    A class to analyze reading behavior and provide personalized recommendations
    for improving reading experience, with emphasis on dyslexia-friendly adaptations.
    """
    
    def __init__(self):
        """Initialize the reading analyzer with default parameters."""
        # Default parameters for different reading abilities
        self.reading_profiles = {
            'beginner': {
                'wpm_range': (0, 150),
                'font_size': 22,
                'letter_spacing': 3,
                'background_color': '#fffacd',  # Light yellow
                'reading_speed': 0.8
            },
            'intermediate': {
                'wpm_range': (150, 250),
                'font_size': 20,
                'letter_spacing': 2,
                'background_color': '#fffacd',  # Light yellow
                'reading_speed': 0.9
            },
            'advanced': {
                'wpm_range': (250, float('inf')),
                'font_size': 18,
                'letter_spacing': 1.5,
                'background_color': '#fffacd',  # Light yellow
                'reading_speed': 1.0
            }
        }
        
        # Dyslexia-specific reading adjustments
        self.dyslexia_adjustments = {
            'font_family': 'OpenDyslexic',
            'line_height': 1.8,
            'paragraph_spacing': 1.5,
            'preferred_colors': ['#fffacd', '#e0f7fa', '#f9fbe7', '#f0f0f0']
        }
        
        # User history
        self.user_history = defaultdict(list)
        
        # Track difficult words by frequency across all users
        self.common_difficult_words = defaultdict(int)
        
        self.reading_history = {}
    
    def analyze_session(self, user_id, reading_time, wpm, difficult_words, word_timings):
        """Analyze a reading session and update user history."""
        if user_id not in self.reading_history:
            self.reading_history[user_id] = {
                "sessions": [],
                "difficult_words": set(),
                "average_wpm": 0
            }
        
        # Update difficult words
        for word in difficult_words:
            self.reading_history[user_id]["difficult_words"].add(word)
        
        # Add session data
        session = {
            "timestamp": time.time(),
            "reading_time": reading_time,
            "wpm": wpm,
            "difficult_words": difficult_words,
            "word_timings": word_timings
        }
        
        self.reading_history[user_id]["sessions"].append(session)
        
        # Update average WPM
        total_wpm = sum(s["wpm"] for s in self.reading_history[user_id]["sessions"])
        sessions_count = len(self.reading_history[user_id]["sessions"])
        self.reading_history[user_id]["average_wpm"] = total_wpm / sessions_count
        
        # Generate recommendations based on difficult words
        recommendations = self.get_syllable_recommendations(user_id)
        
        return recommendations
    
    def analyze_improvement(self, user_id):
        """Analyze user's reading improvement over time."""
        if user_id not in self.reading_history:
            return {"improvement": False, "message": "Not enough data to analyze improvement."}
        
        sessions = self.reading_history[user_id]["sessions"]
        if len(sessions) < 2:
            return {"improvement": False, "message": "Need at least two reading sessions to measure improvement."}
        
        # Sort sessions by timestamp
        sorted_sessions = sorted(sessions, key=lambda s: s["timestamp"])
        
        # Compare first and last session
        first_session = sorted_sessions[0]
        last_session = sorted_sessions[-1]
        
        # Calculate WPM improvement
        wpm_improvement = last_session["wpm"] - first_session["wpm"]
        
        # Calculate reduction in difficult words
        first_difficult_count = len(first_session["difficult_words"])
        last_difficult_count = len(last_session["difficult_words"])
        if first_difficult_count == 0:
            difficult_improvement = 0
        else:
            difficult_improvement = (first_difficult_count - last_difficult_count) / first_difficult_count * 100
        
        # Overall improvement metric
        has_improved = wpm_improvement > 0 or difficult_improvement > 0
        
        return {
            "improvement": has_improved,
            "wpm_change": wpm_improvement,
            "difficult_words_change_percent": difficult_improvement,
            "sessions_analyzed": len(sessions),
            "message": "Good progress! Your reading is improving." if has_improved else "Keep practicing to improve your reading."
        }
    
    def get_syllable_recommendations(self, user_id):
        """Generate topic recommendations based on syllable patterns in difficult words."""
        if user_id not in self.reading_history or not self.reading_history[user_id]["difficult_words"]:
            return ["general", "basic vocabulary"]
        
        # Get the difficult words for this user
        difficult_words = list(self.reading_history[user_id]["difficult_words"])
        
        # In a more sophisticated implementation, we would analyze syllable patterns
        # For simplicity, we'll use word length as a proxy for complexity
        
        # Group words by length
        word_lengths = {}
        for word in difficult_words:
            length = len(word)
            if length not in word_lengths:
                word_lengths[length] = []
            word_lengths[length].append(word)
        
        # Find the most common word lengths
        common_lengths = sorted(word_lengths.keys(), key=lambda k: len(word_lengths[k]), reverse=True)
        
        # Generate recommendations
        recommendations = []
        for length in common_lengths[:3]:  # Take top 3 common lengths
            # Add a sample word from this length group
            sample_words = word_lengths[length][:3]  # Take up to 3 sample words
            length_category = "short" if length <= 4 else "medium" if length <= 7 else "long"
            recommendations.append(f"{length_category} words ({', '.join(sample_words)})")
        
        return recommendations
    
    def get_difficult_words_for_user(self, user_id, limit=10):
        """Get the difficult words for a specific user."""
        if user_id not in self.reading_history:
            return []
        
        # Convert set to list for JSON serialization
        difficult_words = list(self.reading_history[user_id].get("difficult_words", set()))
        
        # Sort by frequency if we track that in the future
        # For now, just return the most recent difficult words up to the limit
        return difficult_words[:limit]
    
    def save_history(self, file_path="reading_history.json"):
        """Save reading history to a JSON file."""
        with open(file_path, 'w') as f:
            json.dump(self.reading_history, f)
    
    def load_history(self, file_path="reading_history.json"):
        """Load reading history from a JSON file."""
        try:
            with open(file_path, 'r') as f:
                self.reading_history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.reading_history = {}
    
    def _get_reading_profile(self, wpm):
        """Determine the reading profile based on WPM."""
        for profile, details in self.reading_profiles.items():
            min_wpm, max_wpm = details['wpm_range']
            if min_wpm <= wpm < max_wpm:
                return profile
        
        # Default to intermediate if no match
        return 'intermediate'

# Example usage
if __name__ == "__main__":
    analyzer = ReadingAnalyzer()
    
    # Simulate a reading session
    recommendations = analyzer.analyze_session(
        user_id="user123",
        reading_time=120,  # 2 minutes
        wpm=140,
        difficult_words=["artificial", "intelligence", "precipitation", "environment", "technology"],
        word_timings={"artificial": 6.5, "intelligence": 5.2, "precipitation": 7.0, "environment": 4.5, "technology": 3.2}
    )
    
    print("Reading Analysis Results:")
    print(json.dumps(recommendations, indent=2))
    
    # Get syllable recommendations
    topics = analyzer.get_syllable_recommendations("user123")
    print("\nRecommended Topics for Future Paragraphs:")
    print(topics)
    
    # Save history
    analyzer.save_history() 