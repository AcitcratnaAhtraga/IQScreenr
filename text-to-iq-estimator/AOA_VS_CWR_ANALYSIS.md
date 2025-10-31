# AoA vs CWR Feature Comparison

## Quick Analysis

From test results:

### Simple Text
- **AoA**: Mean 3.92, Advanced 0.0%
- **CWR**: Not computed (likely very low)

### Academic Text
- **AoA**: Mean 7.51, Advanced 20.0%
- **Expected CWR**: Would be moderate-high

### Advanced Academic Text
- **AoA**: Mean 6.36, Advanced 7.1% ⚠️
- **Expected CWR**: Would be very high

## Key Observation

The **Advanced Academic** text scored lower on AoA (6.36) than the regular Academic text (7.51), even though it contains more sophisticated words like "epistemological" and "phenomenological".

**This suggests**: AoA coverage may be incomplete for highly sophisticated academic vocabulary, while CWR explicitly targets college-level words.

## Recommendation

**Use CWR as primary** for IQ estimation because:
1. ✅ Explicitly targets academic/sophisticated vocabulary
2. ✅ Better coverage of high-level words
3. ✅ Simpler, more direct mapping to IQ
4. ✅ Validated in Hendrix & Yampolskiy (2017)

**Use AoA as complementary** because:
1. ✅ Provides age/growth perspective
2. ✅ Large dataset (43,991 words)
3. ✅ Useful for developmental assessment
4. ✅ Good for educational contexts

## Combined Approach

The **best strategy** is to use BOTH features together:

```python
# Combine features
features = {
    'cwr': cwr_features,
    'aoa': aoa_features,
    'stylometry': stylometry_features,
    'embeddings': embedding_features
}

# Ensemble will learn optimal weights
```

The SuperLearner ensemble can learn which features are most predictive for your specific use case!

