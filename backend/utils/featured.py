"""
Featured themes and their daily angles.

The home screen has six theme buttons. Each one is a broad subject, but the
puzzle behind it changes its angle every day ("History" might be about Ancient
Egypt today and the Vikings tomorrow), so regular players get fresh words and
learn specific facts. Everyone gets the same angle on the same day, and each
featured puzzle is still made only once a day.

To add a theme: add it here AND to FEATURED_THEMES in
frontend/src/config.ts (a test checks they match). To add angles: add lines
to its list; the order of the days changes, which is fine.
"""
import random
from datetime import date
from typing import Dict, List, Optional

ANGLES: Dict[str, List[str]] = {
    "History": [
        "Ancient Egypt", "Ancient Rome", "Ancient Greece", "The Vikings",
        "Medieval castles", "The Aztecs", "The Renaissance", "The Industrial Revolution",
        "The Wild West", "The Silk Road", "Great explorers", "The Tudors",
        "Samurai Japan", "The French Revolution", "The Inca Empire", "Ancient China",
        "Pirates", "The ancient Olympics", "Great inventions", "The Moon landing",
        "The Maya", "Knights and armour",
    ],
    "Space": [
        "The Moon", "Mars", "The Sun", "The planets", "Stars and constellations",
        "Black holes", "Astronauts", "Rockets", "Comets and asteroids", "Galaxies",
        "The space station", "Jupiter and its moons", "Saturn and its rings",
        "Telescopes", "Eclipses", "The Big Bang", "Space probes",
        "Meteors and shooting stars", "Gravity", "Life beyond Earth",
    ],
    "Art": [
        "Famous painters", "Sculpture", "Colours and colour mixing", "The Impressionists",
        "Ancient art", "Photography", "Architecture", "Pop art", "Street art",
        "Pottery", "Drawing", "Museums", "Renaissance artists", "Modern art",
        "Textiles and weaving", "Mosaics", "Portraits", "Japanese art",
        "Comics and cartoons", "Famous paintings",
    ],
    "Nature": [
        "Rainforests", "Oceans", "Deserts", "Mountains", "Birds", "Insects", "Trees",
        "Flowers", "Weather", "Volcanoes", "Rivers and lakes", "The polar regions",
        "Coral reefs", "Mammals", "Reptiles", "The seasons", "Caves", "Islands",
        "Big cats", "Endangered animals",
    ],
    "Science": [
        "The human body", "Chemical elements", "Electricity", "Magnets",
        "Light and colour", "Sound", "Dinosaurs", "Famous inventors", "Robots",
        "Computers", "The brain", "DNA and genes", "Energy", "Cells and microscopes",
        "Famous scientists", "Forces and motion", "Medicine", "Climate", "Atoms",
        "Fossils",
    ],
    "Music": [
        "The orchestra", "Jazz", "Rock and roll", "Classical composers", "Opera",
        "Notes and rhythm", "Guitars", "The piano", "Music around the world",
        "Hip hop", "Singing and choirs", "Drums and percussion", "Brass instruments",
        "Musicals", "Folk music", "Film music", "Dance styles", "Pop music",
        "The blues", "Woodwind instruments",
    ],
}

FEATURED_THEMES = tuple(ANGLES)


def _canonical(theme: Optional[str]) -> Optional[str]:
    wanted = " ".join((theme or "").split()).lower()
    return next((t for t in ANGLES if t.lower() == wanted), None)


def angle_for(theme: Optional[str], day: date) -> Optional[str]:
    """Today's angle for a featured theme (any spelling), None for other themes.

    Each theme walks through its own shuffled list, one angle per day, so all
    of a theme's angles come round before any repeats, and the themes do not
    move in step with each other.
    """
    name = _canonical(theme)
    if name is None:
        return None
    order = ANGLES[name][:]
    random.Random(name).shuffle(order)
    return order[day.toordinal() % len(order)]


def prompt_theme(theme: Optional[str], day: date) -> Optional[str]:
    """What the AI is asked for: 'Ancient Egypt (History)' for a featured
    theme, the theme itself otherwise."""
    angle = angle_for(theme, day)
    return f"{angle} ({_canonical(theme)})" if angle else theme


def featured_today(day: date) -> List[Dict[str, str]]:
    return [{"theme": t, "angle": angle_for(t, day)} for t in FEATURED_THEMES]
