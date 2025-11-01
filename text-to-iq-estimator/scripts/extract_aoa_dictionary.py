"""
Extract AoA dictionary from Excel file and create compressed JSON for JavaScript use.

This script:
1. Reads the AoA Excel file
2. Extracts word -> AoA mappings
3. Creates a compressed JSON file optimized for browser use
4. Uses binary encoding and compression to minimize size
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
import gzip
import sys

def extract_aoa_dictionary(excel_path: str, output_path: str):
    """
    Extract AoA dictionary from Excel and save as compressed JSON.

    Args:
        excel_path: Path to AoA Excel file
        output_path: Path to save compressed JSON file
    """
    print(f"Loading AoA data from: {excel_path}")

    try:
        df = pd.read_excel(excel_path)
        print(f"Loaded Excel file with {len(df)} rows")
    except Exception as e:
        print(f"Error loading Excel file: {e}")
        return False

    # Extract AoA mappings
    aoa_dict = {}
    word_count = 0

    for _, row in df.iterrows():
        word = str(row.get('WORD', '')).lower().strip()
        if not word or len(word) < 2:
            continue

        # Get test-based AoA (priority)
        aoa_test = row.get('AoAtestbased', np.nan)
        if pd.notna(aoa_test):
            try:
                aoa_value = float(aoa_test)
                # Store as mean if word appears multiple times
                if word not in aoa_dict:
                    aoa_dict[word] = []
                aoa_dict[word].append(aoa_value)
                word_count += 1
            except (ValueError, TypeError):
                continue

    # Average multiple entries for same word
    aoa_final = {}
    for word, values in aoa_dict.items():
        aoa_final[word] = float(np.mean(values))

    print(f"Extracted {len(aoa_final)} unique words with AoA values")

    # Create optimized structure: simple key-value pairs
    # Round AoA to 1 decimal to reduce size
    aoa_rounded = {word: round(aoa, 1) for word, aoa in aoa_final.items()}

    # Save as JSON
    print(f"Saving to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(aoa_rounded, f, separators=(',', ':'))  # Compact format

    # Also save compressed version
    compressed_path = output_path.replace('.json', '.json.gz')
    with gzip.open(compressed_path, 'wt', encoding='utf-8') as f:
        json.dump(aoa_rounded, f, separators=(',', ':'))

    # Get file sizes
    json_size = Path(output_path).stat().st_size
    gz_size = Path(compressed_path).stat().st_size

    print(f"\nFile sizes:")
    print(f"  JSON: {json_size / 1024 / 1024:.2f} MB")
    print(f"  GZIP: {gz_size / 1024 / 1024:.2f} MB ({100 * gz_size / json_size:.1f}% of original)")
    print(f"\n✅ Successfully created AoA dictionary")

    return True

def main():
    """Main entry point."""
    # Default paths
    script_dir = Path(__file__).parent.parent
    default_excel = script_dir.parent / 'IQresearch' / 'Master file with all values for test based AoA measures.xlsx'
    default_output = script_dir.parent / 'content' / 'data' / 'aoa_dictionary.json'

    # Get paths from args or use defaults
    if len(sys.argv) > 1:
        excel_path = sys.argv[1]
    else:
        excel_path = str(default_excel)

    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    else:
        output_path = str(default_output)
        # Create directory if needed
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if not Path(excel_path).exists():
        print(f"Error: Excel file not found: {excel_path}")
        print(f"Usage: python extract_aoa_dictionary.py [excel_path] [output_path]")
        return 1

    success = extract_aoa_dictionary(excel_path, output_path)
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())

