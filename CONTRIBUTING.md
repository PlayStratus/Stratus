# Contributing Guide

  

## Code of Conduct

We expect all team members to be respectful, collaborative, and supportive. If a team member experiences or witnesses unacceptable behavior, they should report it to the instructor or a TA.

  

## Getting Started

After downloading or cloning the repository locally, run the following steps in the `frontend` directory to get started:

  

1. `pnpm install` or `npm install`

2. `pnpm run dev` or `npm dev`

3. Open `http://localhost:3000` in your browser.

  

## Branching & Workflow

We use GitFlow as our branching model. The default branch is main. Branch names should be descriptive. For example, `implement-feature-x` and `fix-bug-y` are preferred to `temp` or `branch-123`. Use rebase for local feature branches to keep a clean history, and merge for merging into the main branch.

  

## Issues & Planning

When filing an issue, use the repository’s issue template and apply the appropriate issue labels (e.g. bug, feature, etc). Team members will coordinate using GitHub projects to determine when the issue will be addressed according to its severity, urgency, and estimated size.

  

## Commit Messages

We follow the Conventional Commits standard. For example, `feat: add new authentication module`, `fix: correct typo in README`, and `docs: update API usage example` are all acceptable commit messages. Associated issues should be referenced by writing `Fixes #123` if the commit fixes issue #123.

  

## Code Style, Linting & Formatting

A eslint linter for [Next.js](http://next.js) will be used to ensure adherence to best practices. The tool should be run to enforce code style and formatting via a command such as `npm run lint`.

  

## Testing

Expected coverage threshold is 80%. New/updated tests are mandatory for all new features or significant bug fixes. Tests should be runnable via a command such as `npm test`. For compiled parts of the projects, all warnings should be enabled and must be addressed prior to merging to the main branch.

  

## Pull Requests & Reviews

Pull requests should be submitted with a filled-in copy of the repository’s PR template. The PR author should request a review from 2 other team members, and these team members should provide a review within three business days. All CI tests must pass before a PR can be merged to the main branch. Both reviewers must approve a PR before it may be merged.

  

## CI/CD

Pipeline definitions are located in the .github/workflows directory. You can view logs and re-run jobs in the Actions tab of the GitHub repository. All CI tasks must pass before merging pull requests into the main branch or creating a new release.

  

## Security & Secrets

To report vulnerabilities, team members should reach out to the team members responsible for the associated part(s) of the codebase directly via our Discord server rather than creating a public issue on GitHub. All secrets (e.g. AWS tokens, passwords, etc.) must be passed to programs via environment variables, rather than being hardcoded. Each subteam should regularly update the dependencies in their portion of the code base using tools such as npm’s audit and fix commands.

  

## Documentation Expectations

Each change must update the appropriate REAMDE files to reflect the changes made. Thorough comments must be made throughout the codebase to ensure clarity, maintainability, and collaboration among developers.

  

## Release Process

We use semantic versioning, where each version takes the format `MAJOR.MINOR.PATCH`. Bumping the major version indicates a major breaking change, or, in the case of the 1.0.0 release, that the relevant code is finally considered to be stable. To deploy a new release of the frontend, run:

  

```

pnpm install --frozen-lockfile

pnpm dlx vercel@latest pull --yes --environment=production --token=$VERCEL_TOKEN

pnpm dlx vercel@latest build --prod --token=$VERCEL_TOKEN

pnpm dlx vercel@latest deploy --prebuilt --prod --token=$VERCEL_TOKEN

```

  

## Support & Contact

Reach out to team members via our Discord server for support or to get questions answered. Responses may be expected within three business days. If a member is unreachable by discord our backup method of communication is via our school emails. This is linked in our github README.