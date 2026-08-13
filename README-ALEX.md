# GI Smart — My Project Reflection

## What I Worked On

My work on GI Smart focused on making the application more personalized, reliable, and useful for
daily health tracking. The main features I worked on include:

- Improving daily tracking so each user has one log per day instead of duplicate records.
- Supporting water-only logs without displaying misleading GI or calorie values.
- Adding the ability to edit and delete a daily tracking log with an accessible confirmation dialog.
- Calculating GI and calories from the foods in the user's actual meal plan.
- Making meal selections directly editable so unchecking a meal removes it and recalculates the log.
- Generating balanced meals with multiple foods and realistic portion sizes.
- Personalizing daily calorie targets using age, weight, height, activity level, and health goal.
- Personalizing daily hydration targets using body weight and activity level.
- Adding persistent meal-plan shuffle functionality with suitable food alternatives.
- Making shuffled meals feed into tracking calculations.
- Reducing repeated weekly menus by classifying recognizable uncategorized foods at runtime and
  rotating foods based on recent use.
- Adding Omnivore, Vegetarian, Vegan, and Gluten-free profile preferences.
- Applying dietary preferences consistently to generation, shuffle, saved meals, and tracking.
- Auditing dietary coverage with read-only Neo4j queries while leaving shared food nodes unchanged.
- Securing profile, meal-plan, and tracking APIs with Better Auth server-session validation.
- Adding an interactive focus mode to the Graph Explorer so connected nodes are easier to study.

## Challenges

One of the biggest challenges was keeping data consistent across different parts of the application.
For example, a shuffled meal needed to appear correctly in the meal plan, remain saved after a page
refresh, and also be used when calculating tracking calories and GI. Solving this required the meal
plan and tracking features to read from the same Neo4j data instead of using separate formulas.

Another challenge was daily tracking. The original implementation created a new Neo4j
`TrackingDay` every time the user saved. I changed this behavior so the application updates the
existing record for that user and date. I also had to account for older duplicate records and ensure
that editing or deleting a log updated its relationships correctly.

Meal generation was also challenging because the available food categories are uneven. Some
categories have many foods, while others have only one or two suitable low-GI foods. This affected
meal variety, calorie targets, and shuffle results. I learned that recommendation quality depends
not only on the algorithm but also on the quality, consistency, and coverage of the underlying data.

The live graph also did not contain vegan, vegetarian, or gluten-free properties. More than 200
usable low-GI foods were labeled `Uncategorized`. Instead of rewriting shared Neo4j data, I added conservative application-side classification and ran read-only coverage
audits. This provided more weekly variety and enough options for the supported preferences while
keeping the shared database unchanged. The application also warns users to verify product labels
for allergies because inferred preference data is not a medical guarantee.

## Learning Curve

I had not taken a Big Data 2 course before working on this project, so graph databases were new to me.
At first, I was more familiar with relational databases, tables, and foreign keys. Neo4j required me
to think in terms of nodes, relationships, paths, and graph patterns.

While working on GI Smart, I learned how to:

- Write Cypher queries using `MATCH`, `MERGE`, `OPTIONAL MATCH`, and relationship patterns.
- Model users, foods, meal plans, tracking days, goals, and selections as connected graph data.
- Create idempotent updates so repeated saves do not create unwanted duplicate nodes.
- Store and replace relationships when a meal is edited or shuffled.
- Query a user's connected foods and tracking history.
- Use graph relationships to find food alternatives.
- Audit graph data coverage before exposing a new recommendation filter.
- Keep shared Neo4j data unchanged by applying safe planning classifications in application code.
- Connect a Next.js API route to Neo4j Aura using the Neo4j JavaScript driver.
- Combine PostgreSQL authentication with Neo4j application data.

The Graph Explorer helped me understand the model visually. Adding node-focus behavior also showed
me how useful graph visualization can be when a dataset contains many different relationship types.

## AI Assistance

I used Claude and Github Copilot as an AI development assistant during this project. Because I did not have previous coursework in Big Data 2 or graph databases,
AI helped me understand Neo4j concepts, Cypher syntax, debugging strategies, and how the graph model
connected to the Next.js application.

AI also helped with:

- Suggesting Cypher queries and graph-model improvements.
- Identifying issues with duplicate tracking records and inconsistent calorie calculations.
- Investigating limited food categories, repeated menus, and dietary-filter coverage.
- Implementing and checking TypeScript and Next.js changes.
- Running type checks, lint checks, and production builds after changes.

I did not treat AI output as automatically correct. I reviewed the proposed changes, tested the
application behavior, inspected live Neo4j records, and continued refining the implementation when
results were incorrect. This process helped me learn the technology instead of only copying a
solution.

## What I Learned

This project taught me that building a data-driven application involves more than displaying values
from a database. The data model, calculation rules, authentication, UI behavior, and update logic
must all agree.

I gained practical experience with Next.js, TypeScript, Better Auth, PostgreSQL, Neo4j Aura, Cypher,
graph visualization, API design, and debugging across the full stack. Most importantly, I became
more comfortable working with graph databases and understanding when relationship-based modeling is
useful.

