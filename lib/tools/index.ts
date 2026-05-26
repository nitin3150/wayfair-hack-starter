import { finopsTools } from "./finops";

export { finopsTools };

// Chat mode gets a minimal subset — fast Q&A without full fraud pipeline
export const chatTools = {
  lookupOrder: finopsTools.lookupOrder,
  checkReturnEligibility: finopsTools.checkReturnEligibility,
};

// Agent mode gets the full Track 3 toolset
export const agentTools = finopsTools;
