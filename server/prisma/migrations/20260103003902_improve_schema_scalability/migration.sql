-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Category" ("color", "createdAt", "icon", "id", "isDefault", "name", "updatedAt") SELECT "color", "createdAt", "icon", "id", "isDefault", "name", "updatedAt" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_isDeleted_idx" ON "Category"("isDeleted");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "usage" REAL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptImage" TEXT,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "categoryId" TEXT,
    "recurringExpenseId" TEXT,
    CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "categoryId", "createdAt", "createdById", "date", "description", "id", "isLocked", "notes", "receiptImage", "recurringExpenseId", "updatedAt", "usage", "userId") SELECT "amount", "categoryId", "createdAt", "createdById", "date", "description", "id", "isLocked", "notes", "receiptImage", "recurringExpenseId", "updatedAt", "usage", "userId" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_isDeleted_idx" ON "Expense"("isDeleted");
CREATE TABLE "new_ExpenseSplit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseSplit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseSplit" ("amount", "createdAt", "expenseId", "id", "userId") SELECT "amount", "createdAt", "expenseId", "id", "userId" FROM "ExpenseSplit";
DROP TABLE "ExpenseSplit";
ALTER TABLE "new_ExpenseSplit" RENAME TO "ExpenseSplit";
CREATE INDEX "ExpenseSplit_userId_idx" ON "ExpenseSplit"("userId");
CREATE INDEX "ExpenseSplit_expenseId_idx" ON "ExpenseSplit"("expenseId");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "description" TEXT,
    "receiptImage" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "createdById", "date", "description", "fromUserId", "id", "isLocked", "receiptImage", "status", "toUserId", "updatedAt") SELECT "amount", "createdAt", "createdById", "date", "description", "fromUserId", "id", "isLocked", "receiptImage", "status", "toUserId", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_fromUserId_idx" ON "Payment"("fromUserId");
CREATE INDEX "Payment_toUserId_idx" ON "Payment"("toUserId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_isDeleted_idx" ON "Payment"("isDeleted");
CREATE TABLE "new_RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
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
INSERT INTO "new_RecurringExpense" ("amount", "categoryId", "createdAt", "description", "endDate", "frequency", "id", "isActive", "nextDueDate", "notes", "occurrencesCreated", "splitEqually", "startDate", "totalOccurrences", "updatedAt", "userId") SELECT "amount", "categoryId", "createdAt", "description", "endDate", "frequency", "id", "isActive", "nextDueDate", "notes", "occurrencesCreated", "splitEqually", "startDate", "totalOccurrences", "updatedAt", "userId" FROM "RecurringExpense";
DROP TABLE "RecurringExpense";
ALTER TABLE "new_RecurringExpense" RENAME TO "RecurringExpense";
CREATE INDEX "RecurringExpense_nextDueDate_idx" ON "RecurringExpense"("nextDueDate");
CREATE INDEX "RecurringExpense_isActive_idx" ON "RecurringExpense"("isActive");
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");
CREATE TABLE "new_SplitBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "taxPercent" REAL,
    "serviceCharge" REAL NOT NULL DEFAULT 0,
    "servicePercent" REAL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptImage" TEXT,
    "notes" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SplitBill" ("categoryId", "createdAt", "date", "id", "notes", "receiptImage", "serviceCharge", "servicePercent", "taxAmount", "taxPercent", "title", "totalAmount", "updatedAt") SELECT "categoryId", "createdAt", "date", "id", "notes", "receiptImage", "serviceCharge", "servicePercent", "taxAmount", "taxPercent", "title", "totalAmount", "updatedAt" FROM "SplitBill";
DROP TABLE "SplitBill";
ALTER TABLE "new_SplitBill" RENAME TO "SplitBill";
CREATE INDEX "SplitBill_date_idx" ON "SplitBill"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DeleteRequest_status_idx" ON "DeleteRequest"("status");

-- CreateIndex
CREATE INDEX "DeleteRequest_recordType_recordId_idx" ON "DeleteRequest"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "SplitBillItem_splitBillId_idx" ON "SplitBillItem"("splitBillId");

-- CreateIndex
CREATE INDEX "SplitBillItem_userId_idx" ON "SplitBillItem"("userId");
