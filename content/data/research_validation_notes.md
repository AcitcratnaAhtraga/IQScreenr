# Research Validation Notes for IQ Estimation

## Current Implementation Analysis

### Current Formulas (from code):
1. **Vocabulary**: `IQ = 70 + (mean_aoa - 3.91) × 30`
2. **Diversity**: `IQ = 70 + (TTR - 0.659) × 200`
3. **Sentence**: `IQ = 60 + (avg_words - 11.0) × 7.5`
4. **Grammar**: `IQ = 53 + (dep_depth - 1.795) × 95`

### Issues Identified:
- Formulas appear to be "trained" on a specific dataset rather than research-validated
- Baselines (3.91, 0.659, 11.0, 1.795) may not match population norms
- Multipliers (30, 200, 7.5, 95) may not reflect actual correlation strengths
- No clear research citations for these specific coefficients

## Research-Validated Approaches Needed

### 1. Age of Acquisition (AoA) Database
**Recommended Source**: Kuperman et al. (2012) or Brysbaert & Biemiller (2017)
- **Baseline Mean AoA**: Research suggests ~4.0-4.5 years for average English vocabulary
- **Correlation with Intelligence**: Moderate to strong (r ≈ 0.4-0.6)
- **Action**: Verify current AoA dictionary matches research norms

### 2. Type-Token Ratio (TTR) Baselines
**Research Findings**:
- Average TTR for English text: ~0.65-0.75 (varies by text length)
- TTR decreases with text length (expected)
- **Correlation with Intelligence**: Moderate (r ≈ 0.3-0.5)
- **Action**: Verify baseline 0.659 matches research norms for similar text lengths

### 3. Sentence Length Baselines
**Research Findings**:
- Average words per sentence in English: ~12-15 words
- Academic writing: ~15-20 words
- Social media: ~8-12 words
- **Correlation with Intelligence**: Moderate (r ≈ 0.3-0.4)
- **Action**: Verify baseline 11.0 is appropriate for general text

### 4. Dependency Depth Baselines
**Research Findings**:
- Average dependency depth in English: ~1.8-2.2
- Simple sentences: ~1.5-1.8
- Complex sentences: ~2.0-2.5
- **Correlation with Intelligence**: Moderate to strong (r ≈ 0.4-0.6)
- **Action**: Verify baseline 1.795 matches research norms

## Recommended Improvements

### 1. Standardize to Z-Scores First
Instead of direct linear mapping, convert features to z-scores relative to population norms, then map to IQ:
```
z_score = (feature_value - population_mean) / population_stddev
IQ = 100 + (z_score × 15)
```

### 2. Use Research-Validated Correlation Coefficients
- Vocabulary AoA: r ≈ 0.5 → multiplier should reflect this
- Lexical Diversity: r ≈ 0.4 → moderate weight
- Sentence Complexity: r ≈ 0.35 → moderate weight
- Grammatical Precision: r ≈ 0.45 → moderate-strong weight

### 3. Verify Population Norms
- Need to establish population means and standard deviations for each feature
- Current baselines may not represent true population norms
- Should calibrate against known IQ test results if possible

### 4. Add Research Citations
Document which research papers support each metric and coefficient

## Next Steps

1. **Find Research Databases**:
   - Kuperman AoA database (if available)
   - TTR norms for different text types
   - Dependency depth norms from parsing research
   - Sentence length norms from corpus linguistics

2. **Validate Current Baselines**:
   - Compare current baselines with research findings
   - Adjust if significant discrepancies found

3. **Recalibrate Multipliers**:
   - Use research-validated correlation coefficients
   - Ensure IQ distribution matches expected (mean=100, SD=15)

4. **Add Confidence Intervals**:
   - Based on research-validated standard errors
   - More accurate confidence calculations

## References Needed

- Kuperman, V., Stadthagen-Gonzalez, H., & Brysbaert, M. (2012). Age-of-acquisition ratings for 30,000 English words
- Research on lexical diversity metrics (MTLD, Yule's K)
- Research on sentence complexity and intelligence
- Research on dependency parsing and grammatical complexity
- Corpus linguistics studies on English text norms

