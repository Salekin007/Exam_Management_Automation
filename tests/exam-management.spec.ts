/**
 * ============================================================
 * Automated Exam Management Test Suite
 * ============================================================
 *
 * This test suite automates the complete student exam flow:
 *   1. Reads student emails from a CSV file (data/users.csv)
 *   2. For each student, logs into the exam portal
 *   3. Grants camera & microphone access
 *   4. Enters a specific exam (General Surgery)
 *   5. Accepts the exam security policy terms
 *   6. Enters the exam code to verify access
 *   7. Waits 3 minutes (simulating a real student taking time)
 *   8. Answers all MCQ questions with random selections
 *   9. Submits the exam and logs out
 *
 * Prerequisites:
 *   - data/users.csv must exist with a "email" header and one email per line
 *   - The exam must be active/open on the portal
 *   - The EXAM_CODE must match the active exam's code
 *
 * ============================================================
 */

import { test } from '@playwright/test';
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

for (const user of users) {
  test(`Exam for ${user.email}`, async ({ page, context }) => {
    test.setTimeout(600_000);

    // ─── Step 1: Login ────────────────────────────────────────────────────
    // Pre-grant camera and microphone permissions before navigating
    await context.grantPermissions(['camera', 'microphone'], {
      origin: 'https://exam-ai-lms.eatlbd.com',
    });

    await page.goto('https://exam-ai-lms.eatlbd.com/login');
    await page.getByRole('textbox', { name: 'Enter your email' }).waitFor();
    await page.getByRole('textbox', { name: 'Enter your email' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Enter your password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Enter Exam Portal' }).click();

    // ─── Step 2: Grant Camera & Mic Access ─────────────────────────────────
    // Find the General Surgery exam card and click "Grant Access" if visible.
    // Uses JavaScript evaluate to bypass any overlay or interception issues.
    // The browser permission prompt is auto-accepted by --use-fake-ui-for-media-stream.
    const examCard = page.getByRole('article').filter({ hasText: 'General Surgery' });

    // Click "Grant Access" button via JavaScript to bypass any blockers
    await page.evaluate(() => {
      const btn = document.querySelector('button');
      const allBtns = Array.from(document.querySelectorAll('button'));
      const grantBtn = allBtns.find(b => b.textContent?.includes('Grant Access'));
      if (grantBtn) {
        grantBtn.click();
      }
    });
    await page.waitForTimeout(3000);

    // ─── Step 3: Enter Exam ───────────────────────────────────────────────
    // Click "Enter Exam" on the exam card
    await examCard.getByRole('button', { name: 'Enter Exam' }).waitFor();
    await examCard.getByRole('button', { name: 'Enter Exam' }).click();

    // ─── Step 4: Accept Exam Terms ────────────────────────────────────────
    // Check the agreement checkbox and proceed
    await page.locator('.flex.h-5').waitFor();
    await page.locator('.flex.h-5').click();
    await page.getByRole('button', { name: 'Proceed to Exam' }).click();

    // ─── Step 5: Enter Exam Code ──────────────────────────────────────────
    await page.getByRole('textbox', { name: 'Exam Code' }).waitFor();
    await page.getByRole('textbox', { name: 'Exam Code' }).fill(EXAM_CODE);
    await page.getByRole('button', { name: 'Verify & Enter Exam' }).click();

    // ─── Step 6: Wait 3 Minutes (keep page alive) ─────────────────────────
    // Simulate a real student by keeping the page active for 3 minutes.
    // Mouse moves prevent the exam from detecting inactivity and closing.
    const waitUntil = Date.now() + 180_000;
    while (Date.now() < waitUntil) {
      await page.mouse.move(
        300 + Math.random() * 400,
        200 + Math.random() * 400,
      ).catch(() => {});
      await page.waitForTimeout(10_000);
    }

    // ─── Step 7: Answer MCQ Questions ─────────────────────────────────────
    let questionCount = 0;
    const maxQuestions = 50;

    while (questionCount < maxQuestions) {
      // Use JavaScript to select a random answer option
      // This bypasses any fullscreen/overlay issues that block Playwright clicks
      await page.evaluate(() => {
        // Try labels wrapping radio/checkbox inputs first
        const labels = document.querySelectorAll(
          'label:has(input[type="checkbox"]), label:has(input[type="radio"])'
        );
        if (labels.length > 0) {
          const idx = Math.floor(Math.random() * labels.length);
          (labels[idx] as HTMLElement).click();
          return;
        }
        // Fallback: try standalone radio buttons
        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          const idx = Math.floor(Math.random() * radios.length);
          (radios[idx] as HTMLElement).click();
          return;
        }
        // Fallback: try standalone checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
          const idx = Math.floor(Math.random() * checkboxes.length);
          (checkboxes[idx] as HTMLElement).click();
        }
      });

      await page.waitForTimeout(1000);

      // Check if Submit button is visible (last question)
      const submitVisible = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.textContent?.trim() === 'Submit' && !b.disabled);
      });

      if (submitVisible) {
        // Click Submit via JavaScript
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const submitBtn = btns.find(b => b.textContent?.trim() === 'Submit' && !b.disabled);
          if (submitBtn) submitBtn.click();
        });
        await page.waitForTimeout(1000);

        // Click "Submit and Exit" confirmation
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find(b => b.textContent?.includes('Submit and Exit'));
          if (confirmBtn) confirmBtn.click();
        });
        break;
      }

      // Click Next button via JavaScript
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent?.trim() === 'Next' && !b.disabled);
        if (nextBtn) nextBtn.click();
      });
      await page.waitForTimeout(1000);
      questionCount++;
    }

    // ─── Step 8: Return to Dashboard & Logout ─────────────────────────────
    await page.getByRole('button', { name: 'Return to Dashboard' }).waitFor();
    await page.getByRole('button', { name: 'Return to Dashboard' }).click();
    await page.getByRole('button', { name: 'Logout' }).waitFor();
    await page.getByRole('button', { name: 'Logout' }).click();
  });
}
