# For Cursor agents

You are installing the **ContentMaxima** skill for the user.

1. Locate this package root (folder containing `SKILL.md`, `INSTALL.md`, and `setup.sh` / `setup.ps1`).
2. **Read and execute [INSTALL.md](INSTALL.md)** end-to-end.
3. Ask the user only for credentials they have not already provided:
   - `CONTENT_MAXIMA_EMAIL` + `CONTENT_MAXIMA_PASSWORD` for official exports
   - `OPENAI_API_KEY` for reverse-engineered matrices
4. After install, tell the user to **start a new Agent chat**, then try:

```
@contentmaxima generate a content maxima matrix for <their keyword>
```

Do not skip smoke tests. Do not invent credentials. Do not commit `.env`.
