# Browser preference

Prefer the host's built-in browser tools whenever available and suitable for the task, especially the in-app browser in Codex Desktop. Use agent-browser or other external browser automation only when the built-in browser is unavailable, cannot perform a required operation, or the user explicitly requests the external tool. Browser-related skills should respect this preference rather than overriding it.

# Source and publishing

The workspace root is the primary GitHub repository. Edit the application under `site/`. The ignored `.sites-publish/` directory is a separate Sites publishing checkout; preserve its Git metadata and sync application files from `site/` before packaging a publication. Keep the existing Site identity and private audience.
