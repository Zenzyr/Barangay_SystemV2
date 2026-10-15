export const DEFAULT_DOCUMENT_PRICES: Record<string, number> = {
  certificateOfResidency: 35,
  certificateOfIndigency: 30,
  barangayBusinessClearance: 80,
  certificateOfAttestation: 30,
  certificationOfTreesCutting: 50,
  barangayCertification: 30,
  certificateOfFirstTimeJobseeker: 0,
  firstTimeJobseekerOath: 0,
  certificateOfLowIncome: 30,
  endorsementLetter: 30,
  certificationOfCohabitant: 30,
  soloCertification: 30,
};

export const isValidFee = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
