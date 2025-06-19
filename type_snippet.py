# -*- coding: utf-8 -*-
import pyautogui
import time
import random
import string
import os
import tempfile
import signal
import sys

# Goal: Practical 85–90 WPM with full realism
typo_probability = 1 / 20
typo_chars = string.ascii_lowercase

def get_char_delay(char, index):
    # Slightly sharper distribution: centered lower, same realism logic
    base = random.triangular(0.012, 0.07, 0.035)  # Lowered mode for speed

    # Preserve human typing realism
    if char in string.punctuation:
        base += random.uniform(0.04, 0.08)
    elif char in string.whitespace:
        base -= random.uniform(0.015, 0.035)
    elif char in string.ascii_uppercase:
        base += random.uniform(0.025, 0.06)

    # Rhythmic burst typing: reduce delay briefly every 20–30 characters
    if index % random.randint(20, 30) == 0:
        base *= random.uniform(0.6, 0.85)  # Simulate confident burst

    # Occasional hesitation remains unchanged
    if index % random.randint(24, 36) == 0:
        base += random.uniform(0.12, 0.3)

    return max(0.01, base)

# Define paths
temp_file = os.path.join(tempfile.gettempdir(), 'snippet_temp.txt')
stop_file = os.path.join(tempfile.gettempdir(), 'autotyper_stop.txt')

def should_stop():
    return os.path.exists(stop_file)

def read_snippet():
    try:
        if os.path.exists(temp_file):
            with open(temp_file, 'r', encoding='utf-8') as file:
                return file.readlines()
        else:
            print(f"Error: {temp_file} not found", file=sys.stderr)
            return []
    except Exception as e:
        print(f"Error reading {temp_file}: {str(e)}", file=sys.stderr)
        return []

def signal_handler(sig, frame):
    print(f"Received signal {sig}, exiting...", file=sys.stderr)
    sys.exit(0)

def type_snippet(lines):
    try:
        if not lines:
            print("No snippet provided", file=sys.stderr)
            return
        word_counter = 0
        char_index = 0
        for line in lines:
            if should_stop():
                print("Stop signal received via stop file", file=sys.stderr)
                return
            line = line.rstrip()
            words = line.split()
            for word in words:
                if should_stop():
                    print("Stop signal received via stop file", file=sys.stderr)
                    return
                for char in word:
                    if should_stop():
                        print("Stop signal received via stop file", file=sys.stderr)
                        return
                    if random.random() < typo_probability:
                        wrong_char = random.choice(typo_chars.replace(char.lower(), ''))
                        pyautogui.write(wrong_char)
                        time.sleep(get_char_delay(wrong_char, char_index))
                        if should_stop():
                            print("Stop signal received via stop file", file=sys.stderr)
                            return
                        pyautogui.press('backspace')
                        time.sleep(get_char_delay(char, char_index))
                    pyautogui.write(char)
                    time.sleep(get_char_delay(char, char_index))
                    char_index += 1
                pyautogui.write(' ')
                time.sleep(get_char_delay(' ', char_index))
                char_index += 1
                word_counter += 1
                if random.random() < 0.13 and word_counter % random.randint(6, 12) == 0:
                    time.sleep(random.uniform(0.6, 1.7))
                    if should_stop():
                        print("Stop signal received via stop file", file=sys.stderr)
                        return
            pyautogui.press("enter")
            time.sleep(random.uniform(0.1, 0.22))
            if should_stop():
                print("Stop signal received via stop file", file=sys.stderr)
                return
    except Exception as e:
        print(f"Error during typing: {str(e)}", file=sys.stderr)

def main():
    try:
        # Register signal handlers
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        # Ensure stop file doesn't exist at start
        if os.path.exists(stop_file):
            os.remove(stop_file)

        # Allow time to switch windows
        time.sleep(3)

        # Read and type snippet once
        lines = read_snippet()
        processed_lines = [line.lstrip() for line in lines]
        type_snippet(processed_lines)
    except Exception as e:
        print(f"Main loop error: {str(e)}", file=sys.stderr)
    finally:
        print("Script exiting", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()
