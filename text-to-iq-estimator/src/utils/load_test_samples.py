"""
Utility to load graded test samples for testing and training.
"""

import json
from pathlib import Path
from typing import List, Dict, Any

def load_graded_samples(filename: str = None) -> List[Dict[str, Any]]:
    """
    Load graded test samples from JSON file.

    Args:
        filename: Path to JSON file with test samples.
                 Defaults to data/test_samples_with_graded_iq.json

    Returns:
        List of sample dictionaries with 'iq', 'topic', and 'text' fields
    """
    if filename is None:
        # Default to project data directory
        filename = Path(__file__).parent.parent.parent / 'data' / 'test_samples_with_graded_iq.json'

    with open(filename, 'r') as f:
        data = json.load(f)

    return data['samples']

def get_samples_by_iq(samples: List[Dict[str, Any]] = None,
                       target_iq: int = None) -> List[Dict[str, Any]]:
    """
    Filter samples by IQ level.

    Args:
        samples: List of samples (if None, loads all samples)
        target_iq: IQ level to filter by

    Returns:
        Filtered list of samples
    """
    if samples is None:
        samples = load_graded_samples()

    if target_iq is None:
        return samples

    return [s for s in samples if s['iq'] == target_iq]

def get_samples_by_topic(samples: List[Dict[str, Any]] = None,
                          topic: str = None) -> List[Dict[str, Any]]:
    """
    Filter samples by topic.

    Args:
        samples: List of samples (if None, loads all samples)
        topic: Topic to filter by

    Returns:
        Filtered list of samples
    """
    if samples is None:
        samples = load_graded_samples()

    if topic is None:
        return samples

    return [s for s in samples if s['topic'] == topic]

def get_sample_statistics(samples: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Get statistics about the sample set.

    Args:
        samples: List of samples (if None, loads all samples)

    Returns:
        Dictionary with statistics
    """
    if samples is None:
        samples = load_graded_samples()

    iq_levels = sorted(set(s['iq'] for s in samples))
    topics = sorted(set(s['topic'] for s in samples))

    return {
        'total_samples': len(samples),
        'iq_levels': iq_levels,
        'topics': topics,
        'samples_per_iq': {iq: len(get_samples_by_iq(samples, iq)) for iq in iq_levels},
        'samples_per_topic': {topic: len(get_samples_by_topic(samples, topic)) for topic in topics}
    }


if __name__ == '__main__':
    # Example usage
    print("Loading graded samples...")
    samples = load_graded_samples()
    print(f"Loaded {len(samples)} samples\n")

    stats = get_sample_statistics(samples)
    print("Statistics:")
    print(f"  Total samples: {stats['total_samples']}")
    print(f"  IQ levels: {stats['iq_levels']}")
    print(f"  Topics: {stats['topics']}")
    print(f"  Samples per IQ: {stats['samples_per_iq']}")
    print(f"  Samples per topic: {stats['samples_per_topic']}")

