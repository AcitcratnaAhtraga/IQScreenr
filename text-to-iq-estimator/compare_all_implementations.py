"""
Compare Python vs JavaScript Ultimate implementation
on 15 graded test samples.
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

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
            'error': error,
            'is_valid': est is not None
        })

    return results

def run_javascript_estimator(script_path, name):
    """Run JavaScript estimator on samples via Node.js."""
    print(f"Running {name}...")

    if not script_path.exists():
        print(f"Error: Script not found: {script_path}")
        return None

    try:
        result = subprocess.run(
            ['node', str(script_path)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )

        if result.returncode != 0:
            print(f"Error running {name}: {result.stderr}")
            return None

        # Extract JSON from output
        stdout = result.stdout.strip()
        json_start = -1
        for i, char in enumerate(stdout):
            if char in '[{':
                json_start = i
                break

        if json_start == -1:
            return None

        json_output = stdout[json_start:]

        try:
            js_results = json.loads(json_output)
            return js_results
        except json.JSONDecodeError:
            # Try to find complete JSON structure
            bracket_count = 0
            brace_count = 0
            json_end = len(json_output)
            in_string = False
            escape_next = False

            for i, char in enumerate(json_output):
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\':
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if in_string:
                    continue

                if char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                    if bracket_count == 0 and json_output[0] == '[':
                        json_end = i + 1
                        break
                elif char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0 and json_output[0] == '{':
                        json_end = i + 1
                        break

            try:
                js_results = json.loads(json_output[:json_end])
                return js_results
            except:
                return None

    except Exception as e:
        print(f"Error running {name}: {e}")
        return None

def compare_results(py_results, js_ultimate_results):
    """Compare and display results from Python vs Ultimate implementations."""
    print("\n" + "="*100)
    header = "COMPARISON: Python vs JavaScript Ultimate"
    print(header)
    print("="*100)

    # Header row
    print(f"\n{'Expected':<8} {'Python':<10} {'JS Ultimate':<12} {'Py Err':<8} {'Ult Err':<9} {'Diff':<8} {'Topic':<40}")
    print("-"*100)

    stats = {
        'py': {'errors': [], 'within': 0},
        'js_ultimate': {'errors': [], 'within': 0},
        'ultimate_vs_py': []
    }

    for i in range(len(py_results)):
        py = py_results[i]
        js_ult = js_ultimate_results[i] if js_ultimate_results else None

        exp = py['expected_iq']
        py_est = py['estimated_iq']
        py_err = py['error'] if py['error'] is not None else float('inf')

        if py_err != float('inf'):
            stats['py']['errors'].append(py_err)
            if py_err <= 15:
                stats['py']['within'] += 1

        py_str = f"{py_est:.1f}" if py_est is not None else "N/A"

        if js_ult:
            js_ult_est = js_ult['estimated_iq']
            js_ult_err = js_ult['error'] if js_ult['error'] is not None else float('inf')
            js_ult_str = f"{js_ult_est:.1f}" if js_ult_est is not None else "N/A"

            if js_ult_err != float('inf'):
                stats['js_ultimate']['errors'].append(js_ult_err)
                if js_ult_err <= 15:
                    stats['js_ultimate']['within'] += 1

            if py_est is not None and js_ult_est is not None:
                diff = abs(py_est - js_ult_est)
                stats['ultimate_vs_py'].append(diff)
            else:
                diff = None
        else:
            js_ult_str = "N/A"
            js_ult_err = None
            diff = None

        # Format error strings
        py_err_str = f"{py_err:.1f}" if py_err != float('inf') else "N/A"
        js_ult_err_str = f"{js_ult_err:.1f}" if js_ult_err and js_ult_err != float('inf') else "N/A"
        diff_str = f"{diff:.1f}" if diff is not None else "N/A"

        topic = py['topic'][:37] + '...' if len(py['topic']) > 40 else py['topic']

        print(f"{exp:<8} {py_str:<10} {js_ult_str:<12} {py_err_str:<8} {js_ult_err_str:<9} {diff_str:<8} {topic:<40}")

    print("-"*100)

    # Summary statistics
    n = len(py_results)
    print(f"\nPython Results:")
    if stats['py']['errors']:
        print(f"  Within ±15 IQ: {stats['py']['within']}/{n} ({100*stats['py']['within']/n:.1f}%)")
        print(f"  Average error: {sum(stats['py']['errors'])/len(stats['py']['errors']):.2f} points")

    if js_ultimate_results and stats['js_ultimate']['errors']:
        print(f"\nJavaScript Ultimate Results:")
        print(f"  Within ±15 IQ: {stats['js_ultimate']['within']}/{n} ({100*stats['js_ultimate']['within']/n:.1f}%)")
        print(f"  Average error: {sum(stats['js_ultimate']['errors'])/len(stats['js_ultimate']['errors']):.2f} points")
        if stats['ultimate_vs_py']:
            print(f"  Avg difference from Python: {sum(stats['ultimate_vs_py'])/len(stats['ultimate_vs_py']):.2f} points")

def main():
    samples = load_graded_samples()
    print(f"Loaded {len(samples)} test samples\n")

    # Run all estimators
    py_results = run_python_estimator(samples)

    js_ultimate_script = Path(__file__).parent.parent / 'test_ultimate_estimator.js'
    js_ultimate_results = run_javascript_estimator(js_ultimate_script, "JavaScript Ultimate")

    # Compare results
    compare_results(py_results, js_ultimate_results)

if __name__ == '__main__':
    main()
