You are a senior software engineer. Do a full project review and then publish the updated version to GitHub.

STEP 1 — FULL CODE REVIEW:
Review every file in the project looking for:
- Bugs and logic errors
- Security issues (unprotected routes, exposed env vars, missing auth checks)
- Performance issues (N+1 queries, missing indexes, unnecessary re-renders)
- TypeScript errors and implicit any types
- Responsive design issues (mobile 320px, tablet 768px, desktop 1280px)
- Missing error handling in API routes
- Dead code and unused imports
Search the web for references whenever in doubt.

STEP 2 — FIX ALL ISSUES FOUND:
Fix every issue found in STEP 1.
Show a summary of what was fixed before moving to next step.

STEP 3 — BUILD CHECK:
Run: npm run build
If build fails: fix all errors and run again until build passes with 0 errors and 0 warnings.

STEP 4 — PUBLISH TO GITHUB:
Run the following commands in order:
git add .
git commit -m "fix: full code review and optimizations"
git push origin main

After push confirm with message in Portuguese:
"Versao publicada com sucesso no GitHub!"
Show the repository URL.

Report everything in Portuguese.
Take your time. Be thorough.
