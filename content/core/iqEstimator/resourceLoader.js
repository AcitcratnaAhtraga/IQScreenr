/**
 * Resource Loader for IQ Estimator
 * Handles loading AoA dictionary, metaphor patterns, population norms, and calibration data
 */

class ResourceLoader {
  constructor(options = {}) {
    this.aoaDictionary = null;
    this.aoaDictionaryKeys = null;
    this.aoaDictionaryLoaded = false;
    this.aoaDictionaryLoadFailed = false;
    this.aoaDictionaryPath = options.aoaDictionaryPath || 'content/data/aoa_dictionary.json';
    
    this.metaphorPatterns = null;
    this.metaphorPatternsLoaded = false;
    this.metaphorPatternsPath = options.metaphorPatternsPath || 'content/data/metaphor_patterns.json';
    
    this.casualLanguagePatterns = null;
    this.casualLanguagePatternsLoaded = false;
    this.casualLanguagePatternsPath = options.casualLanguagePatternsPath || 'content/data/casual_language_patterns.json';
    
    this.populationNorms = null;
    this.populationNormsLoaded = false;
    this.populationNormsPath = options.populationNormsPath || 'content/data/population_norms.json';
    
    this.defaultNorms = {
      vocabulary: { mean: 9.02, stddev: 3.76 },
      diversity: { mean: 0.65, stddev: 0.12 },
      sentence: { mean: 12.5, stddev: 4.5 },
      sentence_twitter: { mean: 8.5, stddev: 3.0 },
      grammar: { mean: 1.95, stddev: 0.35 }
    };
    
    this.depDepthCalibration = {
      intercept: 1.795,
      punctuation_coefficient: 0.3,
      clause_coefficient: 0.2
    };
    this.calibrationPath = options.calibrationPath || 'content/data/dependency_depth_calibration.json';
  }

  /**
   * Safely parse JSON, handling cases where multiple JSON objects might be concatenated
   */
  _safeParseJSON(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to find and parse the first valid JSON object
      let braceCount = 0;
      let startIndex = -1;
      
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
          if (startIndex === -1) {
            startIndex = i;
          }
          braceCount++;
        } else if (text[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            try {
              const jsonStr = text.substring(startIndex, i + 1);
              return JSON.parse(jsonStr);
            } catch (parseError) {
              startIndex = -1;
              braceCount = 0;
            }
          }
        }
      }
      
      return null;
    }
  }

  /**
   * Load all resources asynchronously
   */
  async loadResources() {
    try {
      if (typeof fetch !== 'undefined') {
        const getResourceURL = (path) => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL(path);
          }
          return path;
        };

        // Load AoA dictionary
        try {
          const aoaUrl = getResourceURL(this.aoaDictionaryPath);
          const response = await fetch(aoaUrl);
          if (response.ok) {
            const text = await response.text();
            const parsed = this._safeParseJSON(text);
            if (parsed && typeof parsed === 'object') {
              this.aoaDictionary = parsed;
              this.aoaDictionaryKeys = Object.keys(this.aoaDictionary);
              this.aoaDictionaryLoaded = true;
            }
          }
        } catch (error) {
          this.aoaDictionaryLoadFailed = true;
        }

        // Load metaphor patterns
        try {
          const metaphorUrl = getResourceURL(this.metaphorPatternsPath);
          const response = await fetch(metaphorUrl);
          if (response.ok) {
            const text = await response.text();
            const parsed = this._safeParseJSON(text);
            if (parsed && typeof parsed === 'object') {
              this.metaphorPatterns = parsed;
              this.metaphorPatternsLoaded = true;
            }
          }
        } catch (error) {
          // Silent fail
        }

        // Load casual language patterns
        try {
          const casualUrl = getResourceURL(this.casualLanguagePatternsPath);
          const response = await fetch(casualUrl);
          if (response.ok) {
            const text = await response.text();
            const parsed = this._safeParseJSON(text);
            if (parsed && typeof parsed === 'object') {
              this.casualLanguagePatterns = parsed;
              this.casualLanguagePatternsLoaded = true;
            }
          }
        } catch (error) {
          // Silent fail
        }

        // Load population norms
        try {
          const normsUrl = getResourceURL(this.populationNormsPath);
          const response = await fetch(normsUrl);
          if (response.ok) {
            const text = await response.text();
            const parsed = this._safeParseJSON(text);
            if (parsed && typeof parsed === 'object') {
              this.populationNorms = parsed;
              this.populationNormsLoaded = true;
            }
          }
        } catch (error) {
          // Silent fail - use defaults
        }

        // Load dependency depth calibration
        try {
          const calibrationUrl = getResourceURL(this.calibrationPath);
          const response = await fetch(calibrationUrl);
          if (response.ok) {
            const text = await response.text();
            const parsed = this._safeParseJSON(text);
            if (parsed && typeof parsed === 'object') {
              this.depDepthCalibration = { ...this.depDepthCalibration, ...parsed };
            }
          }
        } catch (error) {
          // Silent fail - use defaults
        }
      }
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Load resources synchronously (for Node.js/testing environments)
   */
  loadResourcesSync(fs, pathModule) {
    try {
      const aoaPath = pathModule.join(__dirname, this.aoaDictionaryPath);
      if (fs.existsSync(aoaPath)) {
        const content = fs.readFileSync(aoaPath, 'utf8');
        const parsed = this._safeParseJSON(content);
        if (parsed) {
          this.aoaDictionary = parsed;
          this.aoaDictionaryKeys = Object.keys(this.aoaDictionary);
          this.aoaDictionaryLoaded = true;
        }
      }

      const metaphorPath = pathModule.join(__dirname, this.metaphorPatternsPath);
      if (fs.existsSync(metaphorPath)) {
        const content = fs.readFileSync(metaphorPath, 'utf8');
        const parsed = this._safeParseJSON(content);
        if (parsed) {
          this.metaphorPatterns = parsed;
          this.metaphorPatternsLoaded = true;
        }
      }

      const casualPath = pathModule.join(__dirname, this.casualLanguagePatternsPath);
      if (fs.existsSync(casualPath)) {
        const content = fs.readFileSync(casualPath, 'utf8');
        const parsed = this._safeParseJSON(content);
        if (parsed) {
          this.casualLanguagePatterns = parsed;
          this.casualLanguagePatternsLoaded = true;
        }
      }

      const normsPath = pathModule.join(__dirname, this.populationNormsPath);
      if (fs.existsSync(normsPath)) {
        const content = fs.readFileSync(normsPath, 'utf8');
        const parsed = this._safeParseJSON(content);
        if (parsed) {
          this.populationNorms = parsed;
          this.populationNormsLoaded = true;
        }
      }

      const calibrationPath = pathModule.join(__dirname, this.calibrationPath);
      if (fs.existsSync(calibrationPath)) {
        const content = fs.readFileSync(calibrationPath, 'utf8');
        const parsed = this._safeParseJSON(content);
        if (parsed) {
          this.depDepthCalibration = { ...this.depDepthCalibration, ...parsed };
        }
      }
    } catch (error) {
      // Silent fail
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ResourceLoader = ResourceLoader;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceLoader;
}

