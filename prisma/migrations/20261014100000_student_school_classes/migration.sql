CREATE TABLE "SchoolClass" (
  "id" TEXT NOT NULL,
  "academicYear" VARCHAR(20) NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "departmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Student" ADD COLUMN "schoolClassId" TEXT;

CREATE INDEX "SchoolClass_departmentId_idx" ON "SchoolClass"("departmentId");
CREATE INDEX "SchoolClass_academicYear_name_idx" ON "SchoolClass"("academicYear", "name");
CREATE UNIQUE INDEX "SchoolClass_academicYear_name_departmentId_key" ON "SchoolClass"("academicYear", "name", "departmentId");
CREATE INDEX "Student_schoolClassId_idx" ON "Student"("schoolClassId");

ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolClassId_fkey"
  FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
