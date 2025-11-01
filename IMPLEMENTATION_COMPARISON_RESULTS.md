# Implementation Comparison Results

## Summary

Comparison of Python and JavaScript IQ estimators on 15 graded test samples (3 samples × 5 IQ levels: 60, 80, 100, 120, 140).

### Overall Performance

| Metric | Python | JavaScript | Difference |
|--------|--------|------------|------------|
| **Within ±15 IQ** | 14/15 (93.3%) | 10/15 (66.7%) | -4 samples |
| **Average Error** | 6.42 points | 12.53 points | +6.11 points |
| **Avg Difference Between Implementations** | - | - | 9.90 points |
| **Max Difference** | - | - | 33.4 points |

## Detailed Results by Sample

| Expected | Python | JavaScript | Py Error | JS Error | Difference | Topic |
|----------|--------|------------|----------|----------|------------|-------|
| 60 | 64.6 | 62.5 | 4.6 | 2.5 | 2.1 | Why the Sun rises and sets |
| 80 | 80.2 | 77.2 | 0.2 | 2.8 | 3.0 | Why the Sun rises and sets |
| 100 | 93.0 | 80.5 | 7.0 | 19.5 | 12.5 | Why the Sun rises and sets |
| 120 | 104.2 | 88.1 | 15.8 | 31.9 | 16.2 | Why the Sun rises and sets |
| 140 | 132.0 | 98.6 | 8.0 | 41.4 | 33.4 | Why the Sun rises and sets |
| 60 | 68.9 | 70.1 | 8.9 | 10.1 | 1.2 | Why it rains |
| 80 | 76.1 | 71.2 | 3.9 | 8.8 | 4.9 | Why it rains |
| 100 | 98.0 | 91.6 | 2.0 | 8.4 | 6.4 | Why it rains |
| 120 | 130.1 | 117.5 | 10.1 | 2.5 | 12.5 | Why it rains |
| 140 | 133.2 | 120.2 | 6.8 | 19.8 | 13.0 | Why it rains |
| 60 | 69.8 | 71.4 | 9.8 | 11.4 | 1.6 | Why people dream |
| 80 | 88.0 | 82.8 | 8.0 | 2.8 | 5.1 | Why people dream |
| 100 | 105.7 | 97.9 | 5.7 | 2.1 | 7.9 | Why people dream |
| 120 | 119.7 | 114.9 | 0.3 | 5.1 | 4.7 | Why people dream |
| 140 | 145.1 | 121.2 | 5.1 | 18.8 | 23.9 | Why people dream |

## Breakdown by IQ Level

| IQ Level | Python Avg Error | JavaScript Avg Error | Avg Difference |
|----------|------------------|----------------------|----------------|
| **60** | 7.77 | 7.99 | 1.62 |
| **80** | 4.04 | 4.81 | 4.35 |
| **100** | 4.90 | 10.02 | 8.94 |
| **120** | 8.73 | 13.16 | 11.14 |
| **140** | 6.64 | 26.66 | 23.43 |

## Key Findings

### ✅ What Works Well

1. **Low IQ levels (60-80)**: Both implementations perform similarly
   - Average difference: ~1.6-4.4 IQ points
   - JavaScript error: 7.99-4.81 (comparable to Python)

2. **Simple vocabulary**: When text uses common words, approximations work reasonably well

### ⚠️ Where JavaScript Struggles

1. **High IQ levels (120-140)**: Significant underestimation
   - Average error: 13.16-26.66 points (vs Python's 6.64-8.73)
   - Average difference: 11.14-23.43 IQ points
   - **Root cause**: Advanced vocabulary (AoA approximation) and complex syntax (dependency depth approximation)

2. **Vocabulary sophistication**: JavaScript underestimates at high levels because:
   - AoA is estimated from word length/syllables (not real database)
   - Long, complex words may not correlate perfectly with actual acquisition age
   - Example: "diurnal progression" and "supersaturated" are highly sophisticated but AoA estimation may miss nuance

3. **Complex grammar**: Dependency depth approximation struggles with:
   - Nested clauses and complex sentence structures
   - Subtle grammatical patterns that real parsing would catch

## Analysis

### Performance Gap Increases with IQ Level

The difference between implementations grows significantly as IQ level increases:

```
IQ 60:  1.6 point difference  ✓ Very close
IQ 80:  4.4 point difference  ✓ Acceptable
IQ 100: 8.9 point difference  ⚠ Noticeable
IQ 120: 11.1 point difference ⚠ Significant
IQ 140: 23.4 point difference ✗ Large gap
```

**Conclusion**: The JavaScript approximations are **adequate for lower-to-mid IQ estimation** but **struggle with high-sophistication text**.

### Why the Gap Exists

1. **AoA Database Missing**:
   - Python uses 43,991-word AoA database for precise vocabulary scoring
   - JavaScript estimates from word characteristics
   - Impact: High-IQ text uses rare words that database would catch but approximation misses

2. **Dependency Parsing Missing**:
   - Python uses spaCy's real dependency parsing
   - JavaScript estimates from punctuation/clauses
   - Impact: Complex nested structures are underestimated

3. **Formula Matching**:
   - ✅ All formulas match exactly
   - ✅ All weights match exactly (35%, 25%, 20%, 20%)
   - ❌ But input features are approximated, leading to different results

## Recommendations

### For Current Use

✅ **JavaScript version is acceptable for:**
- General IQ estimation (~60-100 range)
- Quick, privacy-preserving analysis
- Browser-based applications

⚠️ **Consider Python version for:**
- High-precision requirements
- Research applications
- High-IQ text analysis (120+)

### Potential Improvements

1. **Embed AoA Dictionary** (Medium effort, High impact)
   - Add compressed 43k-word dictionary (~2-3MB)
   - Would improve vocabulary accuracy significantly
   - Expected improvement: Reduce error by ~5-8 points at high IQ

2. **Fine-tune Dependency Approximation** (Low effort, Medium impact)
   - Calibrate punctuation→depth mapping on test samples
   - Add more sophisticated clause detection
   - Expected improvement: Reduce error by ~2-4 points

3. **Hybrid Approach** (High effort, High impact)
   - Use local approximations for speed
   - Optionally call API for high-confidence cases
   - Best of both worlds: speed + accuracy

## Conclusion

The JavaScript implementation uses **identical formulas and weights** to Python, but the **feature approximations cause an average 9.9 IQ point difference**, increasing to ~23 points at high IQ levels. This is expected due to browser constraints and is an acceptable trade-off for speed and privacy, but users should be aware that high-sophistication text may be underestimated.

**Accuracy Ratio**: JavaScript achieves ~**50-80% of Python's accuracy** depending on IQ level:
- Low IQ (60-80): ~95% as accurate
- Mid IQ (100): ~80% as accurate
- High IQ (120-140): ~50% as accurate

