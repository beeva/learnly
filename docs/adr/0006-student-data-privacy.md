# 6. Student data minimisation for classrooms

Date: 2025-05-19
Status: Accepted

## Context

Classrooms let educators see student activity. Student data is subject to COPPA and
FERPA in the US and to the Data Privacy Act in the Philippines.

## Decision

- Students join with a code. Educators never see a student's email address.
- Insights are aggregated per skill. Individual responses are visible only for students
  in the educator's own classroom.
- Analytics events carry no free text and no personal data. Event names and props are allow-listed.
- Attempts older than 3 years are aggregated and deleted by a scheduled job.

## Consequences

Some support workflows (e.g. "which email is this student?") must go through an admin.
