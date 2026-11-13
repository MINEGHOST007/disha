import type { ProposalStatus } from "./types";

const transitions: Record<ProposalStatus, readonly ProposalStatus[]> = {
  PROPOSED: ["APPROVED", "REJECTED"],
  APPROVED: ["EXECUTED", "FAILED"],
  REJECTED: [],
  EXECUTED: [],
  FAILED: [],
};

export function canTransition(from: ProposalStatus, to: ProposalStatus) {
  return transitions[from].includes(to);
}
