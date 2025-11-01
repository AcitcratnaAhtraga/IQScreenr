/**
 * Test JavaScript IQ Estimator on 15 graded samples
 * Run with: node test_js_estimator.js
 */

// Use CommonJS require by creating a proper context
const Module = require('module');
const fs = require('fs');
const path = require('path');

// Create a custom require function for the estimator file
const originalRequire = Module.prototype.require;

// Load the ComprehensiveIQEstimator by requiring it directly
// We need to construct the path and load it
const estimatorPath = path.join(__dirname, 'content', 'comprehensiveIQEstimator.js');
const estimatorCode = fs.readFileSync(estimatorPath, 'utf8');

// Create a new module context
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
    Error: Error
};

// Execute the estimator code in the sandbox
vm.createContext(sandbox);
vm.runInContext(estimatorCode, sandbox);

// Get the class
const ComprehensiveIQEstimator = sandbox.module.exports;

// Load test samples
const samplesPath = path.join(__dirname, 'text-to-iq-estimator', 'data', 'test_samples_with_graded_iq.json');
const samplesData = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
const samples = samplesData.samples;

const estimator = new ComprehensiveIQEstimator();

const results = [];

for (const sample of samples) {
    const result = estimator.estimate(sample.text);
    const error = result.iq_estimate !== null ? Math.abs(result.iq_estimate - sample.iq) : null;

    results.push({
        expected_iq: sample.iq,
        estimated_iq: result.iq_estimate,
        topic: sample.topic,
        text: sample.text.length > 100 ? sample.text.substring(0, 100) + '...' : sample.text,
        confidence: result.confidence,
        dimensions: result.dimension_scores,
        error: error,
        is_valid: result.is_valid
    });
}

console.log(JSON.stringify(results, null, 2));
