# How I worked

This directory is the working trail for the exercise: the calls I made, the questions I would have
taken to a PM, and what I cut. It is written as I go and is not polished afterwards.

```
file            holds
--------------  ------------------------------------------------------------------
design.md       what the service does and why: the API, the storage model, the
                  refresh and staleness policy, the scoring tables, the cut list
plan.md         the design cut into nine tasks, each a GitHub issue under #4
decisions.md    dated decisions - the question, the options, the call, why
questions.md    open product questions and the assumption I went with for each
journal/        one file per working session - what I tried, what changed course,
                  what I cut and why
```

GitHub issues and pull requests on this repo are part of the trail too: an issue carries the
problem and its acceptance criteria, and its pull request carries the change.

## Tools and AI

I worked in Claude Code inside a personal harness: rules, skills and checklists I built and use on
my day job. I used the most capable Claude model (Fable 5.1) to talk the brief through, write the
design and cut the plan, and Opus 5.5 to build it ticket by ticket. Every pull request was
reviewed by a separate agent that saw only the diff, and its findings are fixed in the commits
that follow, each saying what the review found.

I set the direction, made the calls and checked the output against a running service. Where I
overruled the model - or it got something wrong, like the claim that Nest's default test runner
is Jest - the entry that records the call says so. Commits and code carry no tool attribution;
this section is where I say how AI was used.
