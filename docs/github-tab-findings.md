## GitHub Repository Tab Exploration — Findings

| Tab | What it's for | Practical notes |
|---|---|---|
| **Code** | The repo's files, folders, branches, and README. | Default landing page. Use the branch dropdown to switch branches, **Go to file** (`t`) to search, and the green **Code** button to get the clone URL or open in GitHub Desktop. |
| **Issues** | Tracking bugs, tasks, and feature requests. | Each issue has a discussion thread, labels, assignees, and milestones. Mention an issue in a commit (`Fixes #12`) to link or auto-close it. |
| **Pull requests** | Proposing, reviewing, and merging changes from one branch into another. | Shows the diff, review comments, and status checks. Main place for code review before changes reach `main`. |
| **Agents** | Assigning tasks to GitHub Copilot's coding agent and tracking its sessions. | You describe a task (or assign an issue to Copilot); the agent works on a branch and opens a pull request for you to review. |
| **Actions** | CI/CD automation — workflows that run on events like push or PR. | Workflows live in `.github/workflows/*.yml`. Used for running tests, linting, building, and deploying. Shows run logs and pass/fail history. |
| **Projects** | Planning boards (Kanban/table/roadmap) linked to issues and PRs. | Good for organizing work across sprints: drag cards between columns like *Todo → In progress → Done*. |
| **Security** | Security policy, vulnerability alerts, and scanning results. | Includes Dependabot alerts for vulnerable dependencies, code scanning, and secret scanning (e.g., catches committed API keys). |
| **Insights** | Repository activity and statistics. | Contributors, commit frequency, traffic, dependency graph, and network of forks/branches. Useful for seeing project health at a glance. |
| **Settings** | Repository configuration (owner/admin only). | Rename repo, change visibility, manage collaborators (**Collaborators** / access page), branch protection rules, webhooks, Pages, and secrets for Actions. |

**Key takeaway:** Code, Issues, and Pull requests are the everyday tabs; Actions and Security automate quality and safety; Projects and Insights help with planning and visibility; Settings controls who can do what.
