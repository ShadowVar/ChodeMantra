import pyautogui
import time
import random
import string

# Goal: Practical 80+ WPM with full realism
typo_probability = 1 / 20
typo_chars = string.ascii_lowercase

def get_char_delay(char, index):
    # Slightly sharper distribution: centered lower, same realism logic
    base = random.triangular(0.015, 0.08, 0.038)  # Lowered mode for speed

    # Preserve human typing realism
    if char in string.punctuation:
        base += random.uniform(0.04, 0.08)
    elif char in string.whitespace:
        base -= random.uniform(0.015, 0.035)
    elif char in string.ascii_uppercase:
        base += random.uniform(0.025, 0.06)

    # Keep realistic fatigue/hesitation
    if index % random.randint(24, 36) == 0:
        base += random.uniform(0.12, 0.3)

    return max(0.012, base)

# Load text
temp_file = "snippet_temp.txt"
try:
    with open(temp_file, "r", encoding="utf-8") as file:
        lines = file.readlines()
except FileNotFoundError:
    lines = []

processed_lines = [line.lstrip() for line in lines]

# Allow time to switch windows
time.sleep(3)

word_counter = 0
char_index = 0

for line in processed_lines:
    line = line.rstrip()
    words = line.split()

    for word in words:
        for char in word:
            if random.random() < typo_probability:
                wrong_char = random.choice(typo_chars.replace(char.lower(), ''))
                pyautogui.write(wrong_char)
                time.sleep(get_char_delay(wrong_char, char_index))
                pyautogui.press('backspace')
                time.sleep(get_char_delay(char, char_index))

            pyautogui.write(char)
            time.sleep(get_char_delay(char, char_index))
            char_index += 1

        pyautogui.write(' ')
        time.sleep(get_char_delay(' ', char_index))
        char_index += 1
        word_counter += 1

        # Pause after some words — human hesitation
        if random.random() < 0.13 and word_counter % random.randint(6, 12) == 0:
            time.sleep(random.uniform(0.6, 1.7))

    pyautogui.press("enter")
    time.sleep(random.uniform(0.1, 0.22))
