"""
Compare Python and JavaScript implementations on 15 graded test samples.
"""

import json
import subprocess
import sys
from pathlib import Path
from src.pipeline import TextToIQUnderEstimator
from src.utils import load_graded_samples


def run_python_estimator(samples):
    """Run Python estimator on samples."""
    print("Running Python estimator...")
    estimator = TextToIQUnderEstimator('config/config.yaml')

    results = []
    for sample in samples:
        result = estimator.estimate(sample['text'])
        est = result.get('iq_estimate')
        exp = sample['iq']
        error = abs(est - exp) if est is not None else None

        results.append({
            'expected_iq': exp,
            'estimated_iq': est,
            'topic': sample['topic'],
            'text': sample['text'][:100] + '...' if len(sample['text']) > 100 else sample['text'],
            'confidence': result.get('confidence'),
            'dimensions': result.get('dimension_scores', {}),
            'error': error,
            'is_valid': est is not None
        })

    return results

def run_javascript_estimator(samples):
    """Run JavaScript estimator on samples via Node.js."""
    print("Running JavaScript estimator...")

    # Use existing test script
    js_script = Path(__file__).parent.parent / 'test_js_estimator.js'

    if not js_script.exists():
        print(f"Error: JavaScript test script not found at {js_script}")
        return None

    try:
        # Run Node.js script
        result = subprocess.run(
            ['node', str(js_script)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )

        if result.returncode != 0:
            print(f"Error running JavaScript estimator: {result.stderr}")
            print(f"STDOUT: {result.stdout}")
            return None

        # Parse JSON output
        js_results = json.loads(result.stdout)
        return js_results

    except json.JSONDecodeError as e:
        print(f"Error parsing JSON output: {e}")
        print(f"Output was: {result.stdout[:500]}")
        return None
    except Exception as e:
        print(f"Error running JavaScript: {e}")
        import traceback
        traceback.print_exc()
        return None

def compare_results(py_results, js_results):
    """Compare and display results."""
    if not py_results or not js_results:
        print("Error: Missing results from one or both estimators")
        return

    print("\n" + "="*100)
    print("COMPARISON: Python vs JavaScript Implementation")
    print("="*100)
    print(f"\n{'Expected':<8} {'Python':<12} {'JS':<12} {'Py Error':<10} {'JS Error':<10} {'Diff':<10} {'Topic':<30}")
    print("-"*100)

    total_py_error = 0
    total_js_error = 0
    total_diff = 0
    py_within = 0
    js_within = 0
    valid_count = 0

    for i, (py, js) in enumerate(zip(py_results, js_results)):
        exp = py['expected_iq']
        py_est = py['estimated_iq']
        js_est = js['estimated_iq']

        py_err = py['error'] if py['error'] is not None else float('inf')
        js_err = js['error'] if js['error'] is not None else float('inf')

        diff = abs(py_est - js_est) if (py_est is not None and js_est is not None) else None

        if diff is not None:
            total_diff += diff
            valid_count += 1

        if py_err <= 15:
            py_within += 1
        if js_err <= 15:
            js_within += 1

        if py_err != float('inf'):
            total_py_error += py_err
        if js_err != float('inf'):
            total_js_error += js_err

        py_str = f"{py_est:.1f}" if py_est is not None else "N/A"
        js_str = f"{js_est:.1f}" if js_est is not None else "N/A"
        py_err_str = f"{py_err:.1f}" if py_err != float('inf') else "N/A"
        js_err_str = f"{js_err:.1f}" if js_err != float('inf') else "N/A"
        diff_str = f"{diff:.1f}" if diff is not None else "N/A"

        topic = py['topic'][:27] + '...' if len(py['topic']) > 30 else py['topic']

        print(f"{exp:<8} {py_str:<12} {js_str:<12} {py_err_str:<10} {js_err_str:<10} {diff_str:<10} {topic:<30}")

    print("-"*100)

    # Summary statistics
    n = len(py_results)
    print(f"\nPython Results:")
    print(f"  Within ±15 IQ: {py_within}/{n} ({100*py_within/n:.1f}%)")
    print(f"  Average error: {total_py_error/n:.2f} points")

    print(f"\nJavaScript Results:")
    print(f"  Within ±15 IQ: {js_within}/{n} ({100*js_within/n:.1f}%)")
    print(f"  Average error: {total_js_error/n:.2f} points")

    if valid_count > 0:
        print(f"\nDifference Between Implementations:")
        print(f"  Average difference: {total_diff/valid_count:.2f} IQ points")
        print(f"  Max difference: {max(abs(py['estimated_iq'] - js['estimated_iq']) for py, js in zip(py_results, js_results) if py['estimated_iq'] is not None and js['estimated_iq'] is not None):.1f} IQ points")

    # Detailed breakdown by IQ level
    print(f"\n{'='*100}")
    print("Breakdown by Expected IQ Level:")
    print(f"{'IQ Level':<12} {'Py Avg Error':<15} {'JS Avg Error':<15} {'Avg Difference':<15}")
    print("-"*100)

    for iq_level in [60, 80, 100, 120, 140]:
        py_level_errors = [r['error'] for r in py_results if r['expected_iq'] == iq_level and r['error'] is not None]
        js_level_errors = [r['error'] for r in js_results if r['expected_iq'] == iq_level and r['error'] is not None]
        level_diffs = [abs(py['estimated_iq'] - js['estimated_iq']) for py, js in zip(py_results, js_results)
                      if py['expected_iq'] == iq_level and py['estimated_iq'] is not None and js['estimated_iq'] is not None]

        py_avg = sum(py_level_errors) / len(py_level_errors) if py_level_errors else 0
        js_avg = sum(js_level_errors) / len(js_level_errors) if js_level_errors else 0
        diff_avg = sum(level_diffs) / len(level_diffs) if level_diffs else 0

        print(f"{iq_level:<12} {py_avg:<15.2f} {js_avg:<15.2f} {diff_avg:<15.2f}")

def main():
    # Load test samples
    samples = load_graded_samples()
    print(f"Loaded {len(samples)} test samples\n")

    # Run both estimators
    py_results = run_python_estimator(samples)
    js_results = run_javascript_estimator(samples)

    # Compare results
    compare_results(py_results, js_results)

if __name__ == '__main__':
    main()

