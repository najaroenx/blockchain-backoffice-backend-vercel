export interface AisTransferInParams {
  /** Unique transaction ID for idempotency */
  transactionID: string;
  /** Customer phone number (msisdn) to receive points */
  msisdn: string;
  /** Number of AIS points to transfer */
  points: number;
  /** Optional session ID (auto-generated if not provided) */
  sessionID?: string;
  /** Optional IP address (defaults to 0.0.0.0) */
  ipAddress?: string;
}

export interface AisTransferReverseParams {
  /** The original transactionID to reverse */
  transactionID: string;
  /** Customer phone number (msisdn) */
  msisdn: string;
  /** Optional session ID (auto-generated if not provided) */
  sessionID?: string;
  /** Optional IP address (defaults to 0.0.0.0) */
  ipAddress?: string;
}

export interface AisTransferRequestBody {
  transactionID: string;
  username: string;
  password: string;
  ipAddress: string;
  msisdn: string;
  sessionID: string;
  referenceCode: string;
  points: string;
  partnerCardNo: string;
}

export interface AisTransferReverseRequestBody {
  transactionID: string;
  username: string;
  password: string;
  ipAddress: string;
  msisdn: string;
  sessionID: string;
}

export interface AisTransferResponse {
  success: boolean;
  transactionID: string;
  data?: any;
  error?: string;
}
