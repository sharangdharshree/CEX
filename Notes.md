- we assume if all things stored in db, not in-memory then 2 problems in db here:
  1.  transactions
  2.  locking

non db crud application

in memory dbs

- Cons of in-memory db:
  - data loss if server crashes
  - cant horizontally scale
- Pros
  - fast
  - easy

- Coding steps:
  - initialize the backend
  - initialize prisma
  - write the prisma schema
  - write the boilerplate routes

timescaleDB
materialized views

- In all finance related applications we avoid dealing with floating point arithmetic, using integer arithmetic instead due to precision issues
- so for example, instead of sending amount like 95.32 we send it as 9532 and divide by 100 when displaying and system as standard assumes every amount is stored as an integer as given
