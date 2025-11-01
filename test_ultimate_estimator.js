/**
 * Test Ultimate JavaScript IQ Estimator on 15 graded samples
 */

const fs = require('fs');
const path = require('path');

// Load the Ultimate estimator
const estimatorPath = path.join(__dirname, 'content', 'comprehensiveIQEstimatorUltimate.js');
const estimatorCode = fs.readFileSync(estimatorPath, 'utf8');

// Create module context
const vm = require('vm');
const sandbox = {
    module: { exports: {} },
    exports: {},
    console: console,
    Math: Math,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Set: Set,
    RegExp: RegExp,
    Error: Error,
    __dirname: __dirname
};

vm.createContext(sandbox);
vm.runInContext(estimatorCode, sandbox);

const ComprehensiveIQEstimatorUltimate = sandbox.module.exports;

// Load test samples
const samplesPath = path.join(__dirname, 'text-to-iq-estimator', 'data', 'test_samples_with_graded_iq.json');
const samplesData = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
const samples = samplesData.samples;

// Set up paths
const aoaPath = path.join(__dirname, 'content', 'data', 'aoa_dictionary.json');
const calPath = path.join(__dirname, 'content', 'data', 'dependency_depth_calibration.json');

// Create estimator
const estimator = new ComprehensiveIQEstimatorUltimate({
    aoaDictionaryPath: aoaPath,
    calibrationPath: calPath
});

estimator.aoaDictionaryPath = aoaPath;
estimator.calibrationPath = calPath;

// Suppress console
const originalLog = console.log;
const originalWarn = console.warn;
console.log = () => {};
console.warn = () => {};

// Load resources
estimator._loadResourcesSync(fs, path);

// Restore console
console.log = originalLog;
console.warn = originalWarn;

// Note: In Node.js, spaCy parser won't be available, so it will use approximation
// This is expected behavior - real dependency parsing only works in browser with Pyodide

async function runTests() {
    const results = [];

    for (const sample of samples) {
        // Use async estimate method (will use approximation in Node.js)
        const result = await estimator.estimate(sample.text);
        const error = result.iq_estimate !== null ? Math.abs(result.iq_estimate - sample.iq) : null;

        results.push({
            expected_iq: sample.iq,
            estimated_iq: result.iq_estimate,
            topic: sample.topic,
            text: sample.text.length > 100 ? sample.text.substring(0, 100) + '...' : sample.text,
            confidence: result.confidence,
            dimensions: result.dimension_scores,
            error: error,
            is_valid: result.is_valid,
            improvements_used: result.improvements_used
        });
    }

    console.log(JSON.stringify(results, null, 2));
}

// Run async tests
runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});

