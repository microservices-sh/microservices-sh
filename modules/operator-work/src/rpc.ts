export const rpcContract = {
  exposes: [
    { method: "getOperatorWorkbench", scope: "operator-work.read", public: false },
    { method: "listOperatorTasks", scope: "operator-work.read", public: false },
    { method: "upsertOperatorTask", scope: "operator-work.write", public: false },
    { method: "updateOperatorTaskStatus", scope: "operator-work.write", public: false },
    { method: "listFocusBlocks", scope: "operator-work.read", public: false },
    { method: "upsertFocusBlock", scope: "operator-work.write", public: false },
    { method: "listDailyReviews", scope: "operator-work.read", public: false },
    { method: "saveDailyReview", scope: "operator-work.write", public: false }
  ],
  calls: []
} as const;
