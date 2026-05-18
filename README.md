# Exam Management Automation

Automated Playwright test suite for the **Item Exam System** (exam-ai-lms.eatlbd.com). It logs in multiple students from a CSV, enters an exam, waits, answers MCQs randomly, submits, and logs out — all in parallel.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npx playwright install chromium
```

## Configuration

### Users CSV (`data/users.csv`)

Add one student email per line with a header row:

```csv
email
student1@gmail.com
student2@gmail.com
```

### Test Config (`playwright.config.ts`)

| Setting      | Value                        | Description                          |
| ------------ | ---------------------------- | ------------------------------------ |
| `reporter`   | `html` + `allure-playwright` | Both HTML and Allure reports         |
| `trace`      | `on`                         | Trace captured for every test        |
| `screenshot` | `on`                         | Screenshots captured for every test  |
| `video`      | `on`                         | Video recorded for every test        |
| `headless`   | `false`                      | Browser visible during execution     |
| `timeout`    | 600,000ms (10 min)           | Per-test timeout                     |
| `projects`   | Chromium only                | Runs on Desktop Chrome               |

### Exam Credentials (in `tests/exam-management.spec.ts`)

```ts
const PASSWORD = 'Student@1234';
const EXAM_CODE = '418116';
```

Update `EXAM_CODE` to match the active exam session code.

## Running Tests

```bash
# Run all tests
npx playwright test

# Run with headed browser (default)
npx playwright test --headed

# Run a specific test file
npx playwright test tests/exam-management.spec.ts
```

## Test Flow

Each student goes through these steps:

1. **Login** — Navigate to login page, enter email + password, submit
2. **Enter Exam** — Find the "General Surgery" exam card and click "Enter Exam"
3. **Accept Terms** — Check the security policy agreement checkbox and proceed
4. **Exam Code** — Enter the exam verification code
5. **Wait** — 3-minute wait to simulate realistic exam-taking behavior
6. **Answer MCQs** — Randomly select answers for up to 50 questions (supports radio buttons and checkboxes)
7. **Submit** — Click "Submit" then "Submit and Exit" on the last question
8. **Logout** — Return to dashboard and log out

## Reports

### HTML Report

```bash
npx playwright show-report
```

### Allure Report

```bash
npx allure generate ./allure-results --clean
npx allure open
```

## Project Structure

```
├── data/
│   └── users.csv                  # Student email list
├── tests/
│   └── exam-management.spec.ts    # Main test suite
├── playwright.config.ts           # Playwright configuration
├── package.json
└── README.md
```
