-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "totalOccurrences" INTEGER,
    "occurrencesCreated" INTEGER NOT NULL DEFAULT 0,
    "nextDueDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "splitEqually" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecurringExpense" ("amount", "categoryId", "createdAt", "description", "endDate", "frequency", "id", "isActive", "nextDueDate", "notes", "occurrencesCreated", "startDate", "totalOccurrences", "updatedAt", "userId") SELECT "amount", "categoryId", "createdAt", "description", "endDate", "frequency", "id", "isActive", "nextDueDate", "notes", "occurrencesCreated", "startDate", "totalOccurrences", "updatedAt", "userId" FROM "RecurringExpense";
DROP TABLE "RecurringExpense";
ALTER TABLE "new_RecurringExpense" RENAME TO "RecurringExpense";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
