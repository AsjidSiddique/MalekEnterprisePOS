/** Shape of the billing job's result, shared with the browser (the job itself only runs on the server). */
export interface BillingSummary {
  date: string; invoicesCreated: number; markedOverdue: number; remindersQueued: number; statusChanges: number;
  licencesExtended: number; licenceWarnings: number; emailsSent: number; emailsFailed: number;
}
