export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS hr_employees",
    "HR People Ops module migration owns employees."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS hr_leave_requests",
    "HR People Ops module migration owns leave requests."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS hr_attendance_records",
    "HR People Ops module migration owns attendance."
  );
}
