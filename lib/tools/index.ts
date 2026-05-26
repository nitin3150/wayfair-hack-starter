import { finopsTools } from "./finops";

export { finopsTools };

// Chat mode: order lookup, eligibility check, and claim scoring
export const chatTools = {
  lookupOrder: finopsTools.lookupOrder,
  getCustomerHistory: finopsTools.getCustomerHistory,
  checkReturnEligibility: finopsTools.checkReturnEligibility,
  scoreRefundClaim: finopsTools.scoreRefundClaim,
};

// Agent mode gets the full Track 3 toolset
export const agentTools = finopsTools;
