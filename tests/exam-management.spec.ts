/**
 * ============================================================
 * Automated Exam Management Test Suite
 * ============================================================
 *
 * This test suite automates the complete student exam flow:
 *   1. Reads student emails from a CSV file (data/users.csv)
 *   2. For each student, logs into the exam portal
 *   3. Enters a specific exam (General Surgery)
 *   4. Accepts the exam security policy terms
 *   5. Enters the exam code to verify access
 *   6. Waits 3 minutes (simulating a real student taking time)
 *   7. Answers all MCQ questions with random selections
 *   8. Submits the exam and logs out
 *
 * Prerequisites:
 *   - data/users.csv must exist with a "email" header and one email per line
 *   - The exam must be active/open on the portal
 *   - The EXAM_CODE must match the active exam's code
 *
 * ============================================================
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration Constants ───────────────────────────────────────────────

// Common password shared by all student accounts
const PASSWORD = 'Student@1234';

// Unique exam code provided by the invigilator/system to verify exam entry
const EXAM_CODE = '418116';

// ─── User Interface & CSV Loader ───────────────────────────────────────────

/**
 * Represents a single student user loaded from the CSV file.
 * Each user has an email address used to log into the exam portal.
 */
interface User {
  email: string;
}

/**
 * Reads student emails from data/users.csv and returns an array of User objects.
 *
 * CSV format expected:
 *   email
 *   student1@gmail.com
 *   student2@gmail.com
 *
 * - Line 1 is treated as the header row and skipped (i = 1 starts from line 2)
 * - Empty lines are ignored
 * - Trailing whitespace around emails is trimmed
 *
 * @returns {User[]} Array of user objects, each containing an email
 */
function loadUsers(): User[] {
  // Resolve the CSV path relative to this test file's directory (__dirname)
  const csvPath = path.resolve(__dirname, '..', 'data', 'users.csv');

  // Read the entire CSV file, trim leading/trailing whitespace, split into lines
  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');

  const users: User[] = [];

  // Start from index 1 to skip the header row ("email")
  for (let i = 1; i < lines.length; i++) {
    const email = lines[i].trim();
    if (email) {
      users.push({ email });
    }
  }
  return users;
}

// Load all users once at module level — tests are generated dynamically from this list
const users = loadUsers();

// ─── Dynamic Test Generation ───────────────────────────────────────────────

/**
 * Loop over each user loaded from the CSV and create a separate test case.
 * This means if users.csv has 5 emails, 5 independent tests are created.
 * With fullyParallel enabled in playwright.config.ts, these tests run in parallel
 * using multiple browser workers, speeding up execution for large user lists.
 */
for (const user of users) {
  test(`Exam for ${user.email}`, async ({ page }) => {
    // Set per-test timeout to 10 minutes (600,000ms) to accommodate:
    //   - Page navigation and loading
    //   - 3-minute wait inside the exam
    //   - Time to answer up to 50 questions
    test.setTimeout(600_000);

    // ─── Step 1: Login ────────────────────────────────────────────────────
    // Navigate to the exam portal login page
    await page.goto('https://exam-ai-lms.eatlbd.com/login');

    // Wait for the email input field to appear (placeholder: "Enter your email")
    // Using waitFor() ensures the page has fully loaded before interacting
    await page.getByRole('textbox', { name: 'Enter your email' }).waitFor();

    // Fill in the student's email address from the CSV
    await page.getByRole('textbox', { name: 'Enter your email' }).fill(user.email);

    // Fill in the common student password
    await page.getByRole('textbox', { name: 'Enter your password' }).fill(PASSWORD);

    // Click the login button to submit credentials and navigate to the dashboard
    await page.getByRole('button', { name: 'Enter Exam Portal' }).click();

    // ─── Step 2: Enter Exam ───────────────────────────────────────────────
    // The dashboard shows multiple exam cards (articles). We filter for the
    // one containing "General Surgery" text to target the correct exam,
    // then click its "Enter Exam" button.
    const examCard = page.getByRole('article').filter({ hasText: 'General Surgery' });
    await examCard.getByRole('button', { name: 'Enter Exam' }).waitFor();
    await examCard.getByRole('button', { name: 'Enter Exam' }).click();

    // ─── Step 3: Accept Exam Terms ────────────────────────────────────────
    // A dialog appears with exam security rules. We need to:
    //   a) Check the agreement checkbox (located via CSS class .flex.h-5)
    //   b) Click "Proceed to Exam" to continue
    await page.locator('.flex.h-5').waitFor();
    await page.locator('.flex.h-5').click();
    await page.getByRole('button', { name: 'Proceed to Exam' }).click();

    // ─── Step 4: Enter Exam Code ──────────────────────────────────────────
    // An exam code input appears. Fill in the code and click verify.
    // This code is unique per exam session and set at the top of this file.
    await page.getByRole('textbox', { name: 'Exam Code' }).waitFor();
    await page.getByRole('textbox', { name: 'Exam Code' }).fill(EXAM_CODE);
    await page.getByRole('button', { name: 'Verify & Enter Exam' }).click();

    // ─── Step 5: Wait 3 Minutes ───────────────────────────────────────────
    // Simulate a real student spending time in the exam before answering.
    // 180,000ms = 3 minutes. This helps mimic realistic exam-taking behavior.
    await page.waitForTimeout(180_000);

    // ─── Step 6: Answer MCQ Questions ─────────────────────────────────────
    // Loop through up to 50 questions, selecting random answers for each.
    let questionCount = 0;
    const maxQuestions = 50;

    while (questionCount < maxQuestions) {
      // Locate the "Next" and "Submit" buttons on the current question page.
      // "Next" moves to the next question, "Submit" appears on the last question.
      const nextBtn = page.getByRole('button', { name: 'Next' });
      const submitBtn = page.getByRole('button', { name: 'Submit' });

      // Try to find answer option labels that wrap checkbox or radio inputs.
      // These are the clickable MCQ choices (e.g., <label><input type="radio"/>Option A</label>)
      const answerLabels = page.locator('label:has(input[type="checkbox"]), label:has(input[type="radio"])');
      let optionCount = await answerLabels.count();

      // Fallback strategy: if no label-wrapped options are found, try locating
      // checkboxes and radio buttons directly by their ARIA roles
      if (optionCount === 0) {
        const checkboxes = page.getByRole('checkbox');
        const radios = page.getByRole('radio');

        // Try checkboxes first (for multiple-answer questions)
        optionCount = await checkboxes.count();
        if (optionCount > 0) {
          // Pick a random checkbox option and click it
          const idx = Math.floor(Math.random() * optionCount);
          await checkboxes.nth(idx).click();
        } else {
          // Fall back to radio buttons (single-answer questions)
          optionCount = await radios.count();
          if (optionCount > 0) {
            // Pick a random radio option and click it
            const idx = Math.floor(Math.random() * optionCount);
            await radios.nth(idx).click();
          }
        }
      } else {
        // Label-wrapped options found — select one randomly
        const firstIdx = Math.floor(Math.random() * optionCount);
        await answerLabels.nth(firstIdx).click();

        // 50% chance to also select a second option (for multi-select / checkbox questions)
        // This simulates a student sometimes choosing multiple answers
        if (optionCount > 1 && Math.random() > 0.5) {
          let secondIdx = Math.floor(Math.random() * optionCount);
          // Avoid selecting the same option twice — pick the next one instead
          if (secondIdx === firstIdx) {
            secondIdx = (firstIdx + 1) % optionCount;
          }
          await answerLabels.nth(secondIdx).click();
        }
      }

      // Check if we've reached the last question by looking for the "Submit" button.
      // If visible, click it and confirm with "Submit and Exit" to finalize the exam.
      const submitVisible = await submitBtn.isVisible().catch(() => false);
      if (submitVisible) {
        await submitBtn.click();
        await page.getByRole('button', { name: 'Submit and Exit' }).click();
        break; // Exit the loop — exam is submitted
      }

      // Not the last question — click "Next" to move to the following question
      // and wait 1 second for the page to settle before the next iteration
      await nextBtn.click();
      await page.waitForTimeout(1000);
      questionCount++;
    }

    // ─── Step 7: Return to Dashboard & Logout ─────────────────────────────
    // After submission, click "Return to Dashboard" to go back to the main page,
    // then click "Logout" to end the session cleanly for this student.
    await page.getByRole('button', { name: 'Return to Dashboard' }).waitFor();
    await page.getByRole('button', { name: 'Return to Dashboard' }).click();
    await page.getByRole('button', { name: 'Logout' }).waitFor();
    await page.getByRole('button', { name: 'Logout' }).click();
  });
}
