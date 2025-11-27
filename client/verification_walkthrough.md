# Verification and Deployment Walkthrough

## 1. Build Verification
We have successfully resolved the linting errors and implemented the new test modes. To verify the build locally:

1.  Open a terminal in the `client` directory.
2.  Run the build command:
    ```bash
    npx vite build
    ```

## 2. Feature Verification
Please verify the following features in the application:

### Admin Side (`/student-management`)
1.  **Per-Book Settings:**
    *   Go to Student Management.
    *   Select a student and click "Edit".
    *   In the "Active Books" section, check a book to make it active.
    *   **Verify:** A settings panel appears below the checked book.
    *   **Test Mode:** Select different modes ("Word Typing", "Sentence Click", "Sentence Type").
    *   **Words Per Session:** Set a specific number for that book (e.g., 5).
    *   Save settings.

### Student Side (`/student`)
1.  **Dashboard:**
    *   Log in as the student.
    *   Select the book you configured.
    *   **Verify:** The "Today's Study" range reflects the *per-book* words per session setting (e.g., 5 words).

2.  **Test Interface:**
    *   Start the test for that book.
    *   **Sentence Click Mode:** Verify sentences are scrambled and you click words to order them.
    *   **Sentence Type Mode:** Verify sentences are scrambled (displayed as text blocks) and you must TYPE the full sentence correctly.
    *   **Word Typing Mode:** Verify standard word typing behavior.

## 3. Deployment
Once verified, deploy the changes to Firebase Hosting:

```bash
firebase deploy --only hosting
```
