"""Quick verification script to check current calibration."""

from src.pipeline import TextToIQUnderEstimator
from src.utils import load_graded_samples

def main():
    estimator = TextToIQUnderEstimator('config/config.yaml')
    samples = load_graded_samples()

    within_count = 0
    total_error = 0

    print("Calibration Verification")
    print("="*50)

    for sample in samples:
        result = estimator.estimate(sample['text'])
        est = result['iq_estimate']
        exp = sample['iq']
        error = abs(est - exp)
        within = error <= 15

        if within:
            within_count += 1

        total_error += error

        status = '✓' if within else '✗'
        print(f"{status} IQ {exp:3} → {est:5.1f} | {error:4.1f} pts")

    print("="*50)
    print(f"Result: {within_count}/{len(samples)} within ±15 ({100*within_count/len(samples):.0f}%)")
    print(f"Average error: {total_error/len(samples):.2f} points")

if __name__ == '__main__':
    main()

