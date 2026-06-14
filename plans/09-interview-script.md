# Customer Interview Script

## Target Respondents
- developers using Claude, Codex, Cursor, or similar tools
- dev agency owners
- freelance full-stack developers
- technical founders
- fractional CTOs
- internal-tools consultants

## Call Goal
Learn whether the respondent has a repeated, expensive problem that microservices.sh can solve.

Do not pitch first. Understand their current workflow.

## Opening
Thanks for taking the time. I am researching how developers and agencies use AI agents to build real applications. I am especially interested in where agent-built apps break before production.

## Current Workflow
1. What have you asked an AI coding agent to build recently?
2. Was it for a real project, client, internal tool, or experiment?
3. Which agent or tools did you use?
4. How much of the generated code did you keep?
5. What parts did you have to rewrite manually?

## Pain Discovery
6. Where did the generated app break or become unreliable?
7. Which parts do you rebuild across projects?
8. What is the most annoying production concern: auth, data, payments, webhooks, emails, deploys, permissions, background jobs, or something else?
9. What happens if this part is wrong?
10. How do you currently test or verify agent-generated code?

## Alternatives
11. Do you use boilerplates, templates, frameworks, Supabase, Firebase, Clerk, Medusa, or other tools?
12. What do you like about those options?
13. What still slows you down?
14. Have you tried deploying AI-generated apps to Cloudflare?
15. Would you rather own the infrastructure or use managed infrastructure?

## Concept Test
After discovery, show the concept:

> microservices.sh lets you bring Claude, Codex, or Cursor, compose verified modules like Auth, Customer, Booking, Payment, Email, and Admin, customize them safely, and deploy to managed Cloudflare without setup.

Ask:

16. What is immediately clear?
17. What is confusing?
18. What would you not trust?
19. What would make this useful enough to try?
20. Would you want managed deploy, BYO Cloudflare, or repo export?

## Pricing
21. If this saved you 5 to 10 hours per project, what would it be worth?
22. Would you pay monthly or one-time?
23. Would you compare this to hosting, boilerplates, or developer labor?
24. Cloudflare direct is cheap. What would make this worth paying for anyway?
25. Would $49/month make sense for one managed app?
26. Would $99/month make sense for three managed apps?
27. Would $299/month make sense for an agency plan with 10 managed apps and client workspaces?
28. What would need to be included for you to pay?

## Commitment
29. Would you test a booking-system MVP?
30. Do you have a real project we could use as a pilot?
31. Would you pay for early access if we helped you get the first app working?
32. Can we watch you try the agent workflow?
33. Who else should we talk to?

## Scoring
| Score | Meaning |
|-------|---------|
| 0 | Not target customer. No agent usage or no production app need. |
| 1 | Uses agents, but only experiments. No strong pain. |
| 2 | Uses agents for real work, has pain, but low urgency. |
| 3 | Repeated pain and clear workflow fit. Wants prototype. |
| 4 | Strong pain, real project, willing to pay or pilot. |
| 5 | Agency/team with repeated projects and urgent paid need. |

## Strong Buying Signals
- "We rebuild this every client project."
- "AI gets us 70% there, then we spend days fixing the production parts."
- "If this worked, I would use it next week."
- "Can we use this for a current client?"
- "How much is the agency plan?"

## Weak Signals
- "Cool idea."
- "I might try it someday."
- "I just want a free template."
- "I want a visual no-code builder."
- "I do not deploy real apps with agents."
