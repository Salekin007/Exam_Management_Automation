import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PASSWORD = 'Student@1234';
const EXAM_CODE = '418116';

interface User {
  email: string;
}

function loadUsers(): User[] {
  const csvPath = path.resolve(__dirname, '..', 'data', 'users.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
  const users: User[] = [];
  for (let i = 1; i < lines.length; i++) {
    const email = lines[i].trim();
    if (email) {
      users.push({ email });
    }
  }
  return users;
}

const users = loadUsers();

for (const user of users) {
  test(`Exam for ${user.email}`, async ({ page }) => {
    test.setTimeout(600_000); // 10 min to cover 3-min wait + exam

    // Login
    await page.goto('https://exam-ai-lms.eatlbd.com/login');
    await page.getByRole('textbox', { name: 'Enter your email' }).waitFor();
    await page.getByRole('textbox', { name: 'Enter your email' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Enter your password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Enter Exam Portal' }).click();

    // Enter Exam - target the General Surgery exam card
    const examCard = page.getByRole('article').filter({ hasText: 'General Surgery' });
    await examCard.getByRole('button', { name: 'Enter Exam' }).waitFor();
    await examCard.getByRole('button', { name: 'Enter Exam' }).click();

    // Accept terms
    await page.locator('.flex.h-5').waitFor();
    await page.locator('.flex.h-5').click();
    await page.getByRole('button', { name: 'Proceed to Exam' }).click();

    // Enter exam code
    await page.getByRole('textbox', { name: 'Exam Code' }).waitFor();
    await page.getByRole('textbox', { name: 'Exam Code' }).fill(EXAM_CODE);
    await page.getByRole('button', { name: 'Verify & Enter Exam' }).click();

    // Wait 3 minutes in the exam before answering
    await page.waitForTimeout(180_000);

    // Answer questions with random selections
    let questionCount = 0;
    const maxQuestions = 50;

    while (questionCount < maxQuestions) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      const submitBtn = page.getByRole('button', { name: 'Submit' });

      // Pick random answer options - target label elements wrapping checkboxes
      const answerLabels = page.locator('label:has(input[type="checkbox"]), label:has(input[type="radio"])');
      let optionCount = await answerLabels.count();

      // Fallback: try role-based checkboxes/radios if no labels found
      if (optionCount === 0) {
        const checkboxes = page.getByRole('checkbox');
        const radios = page.getByRole('radio');
        optionCount = await checkboxes.count();
        if (optionCount > 0) {
          const idx = Math.floor(Math.random() * optionCount);
          await checkboxes.nth(idx).click();
        } else {
          optionCount = await radios.count();
          if (optionCount > 0) {
            const idx = Math.floor(Math.random() * optionCount);
            await radios.nth(idx).click();
          }
        }
      } else {
        const firstIdx = Math.floor(Math.random() * optionCount);
        await answerLabels.nth(firstIdx).click();

        // Sometimes select a second option
        if (optionCount > 1 && Math.random() > 0.5) {
          let secondIdx = Math.floor(Math.random() * optionCount);
          if (secondIdx === firstIdx) {
            secondIdx = (firstIdx + 1) % optionCount;
          }
          await answerLabels.nth(secondIdx).click();
        }
      }

      // If Submit button is visible, this is the last question
      const submitVisible = await submitBtn.isVisible().catch(() => false);
      if (submitVisible) {
        await submitBtn.click();
        await page.getByRole('button', { name: 'Submit and Exit' }).click();
        break;
      }

      await nextBtn.click();
      await page.waitForTimeout(1000);
      questionCount++;
    }

    // Return to dashboard and logout
    await page.getByRole('button', { name: 'Return to Dashboard' }).waitFor();
    await page.getByRole('button', { name: 'Return to Dashboard' }).click();
    await page.getByRole('button', { name: 'Logout' }).waitFor();
    await page.getByRole('button', { name: 'Logout' }).click();
  });
}
